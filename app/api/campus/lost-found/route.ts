import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal, type CampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { MAX_ROUGH_DISTANCE_M } from '@/lib/campus/housing/schema';
import {
  ANSWER_MAX,
  CONTACT_KINDS,
  DESCRIPTION_MAX,
  LOST_FOUND_CATEGORIES,
  MAX_PHOTOS,
  QUESTION_MAX,
  TITLE_MAX,
  normalizeContact,
  redactForViewer,
  sortNewestFirst,
  type LostFoundContactKind,
  type LostFoundRecord,
} from '@/lib/campus/lostFound';
import { assertOwnedCampusMedia } from '@/lib/campus/media';
import { PICK_COLLEGE_FIRST_MESSAGE } from '@/lib/campus/membership';
import { haversineMeters, roundForPrivacy } from '@/lib/format/distance';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import type { CampusRef, ListingPlace } from '@/types/campus';
import type { LostFoundCategory } from '@/types/utilities';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const FEED_LIMIT = 200;
const MAX_HAPPENED_DAYS = 60;

const placeSchema = z.object({
  /** A landmark id of the poster's campus, or null for a typed area. */
  landmarkId: z.string().trim().min(1).max(80).nullable(),
  area: z.string().trim().max(60).optional(),
  roughDistanceM: z.number().int().min(0).max(MAX_ROUGH_DISTANCE_M, 'That looks too far').nullable().optional(),
});

const createSchema = z
  .object({
    kind: z.enum(['lost', 'found'], { errorMap: () => ({ message: 'Pick lost or found' }) }),
    category: z.enum(LOST_FOUND_CATEGORIES as [LostFoundCategory, ...LostFoundCategory[]], {
      errorMap: () => ({ message: 'Pick what it is' }),
    }),
    title: z.string().trim().min(3, 'Add a short title').max(TITLE_MAX, 'Keep the title short'),
    description: z.string().trim().max(DESCRIPTION_MAX, 'Keep the details short').optional().default(''),
    place: placeSchema.nullable().optional(),
    happenedAt: z.string().datetime({ offset: true }).nullable().optional(),
    keptAt: z.string().trim().max(60, 'Keep it short').nullable().optional(),
    images: z.array(z.string().max(300)).max(MAX_PHOTOS, `Add up to ${MAX_PHOTOS} photos`).optional().default([]),
    claimQuestion: z.string().trim().max(QUESTION_MAX, 'Keep the question short').nullable().optional(),
    claimAnswer: z.string().trim().max(ANSWER_MAX, 'Keep the answer short').nullable().optional(),
    contact: z.object({
      kind: z.enum(CONTACT_KINDS as [LostFoundContactKind, ...LostFoundContactKind[]], {
        errorMap: () => ({ message: 'Pick how to reach you' }),
      }),
      value: z.string().max(140),
    }),
  })
  .superRefine((input, ctx) => {
    if (input.claimQuestion && !input.claimAnswer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['claimAnswer'], message: 'Add the answer to your question' });
    }
    const contact = normalizeContact(input.contact.kind, input.contact.value);
    if (!contact.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contact', 'value'], message: contact.error });
  });

type CreateInput = z.output<typeof createSchema>;

async function lostFoundPrincipal() {
  const principal = await getCampusPrincipal({ requireVerified: true, product: 'lostFound' });
  if (principal.blocked) throw new CampusHttpError(403, 'Your account is paused');
  if (!principal.campus) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
  return principal as CampusPrincipal & { campus: CampusRef };
}

/** Turns the poster's pick into a stored place on their own campus. */
function resolvePlace(principal: CampusPrincipal & { campus: CampusRef }, pick: CreateInput['place']): ListingPlace | null {
  if (!pick) return null;
  const campus = principal.config?.campuses.find((item) => item.id === principal.campus.id);
  if (!campus) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
  if (pick.landmarkId) {
    const landmark = campus.landmarks.find((item) => item.id === pick.landmarkId);
    if (!landmark) throw new CampusHttpError(400, 'Pick a place from the list');
    return {
      landmarkId: landmark.id,
      label: landmark.label,
      area: landmark.area,
      lat: landmark.lat,
      lng: landmark.lng,
      campusId: campus.id,
      roughDistanceM: roundForPrivacy(haversineMeters(campus.origin, landmark)),
    };
  }
  const area = pick.area?.trim() ?? '';
  if (area.length < 2) throw new CampusHttpError(400, 'Type the area');
  if (pick.roughDistanceM === null || pick.roughDistanceM === undefined) throw new CampusHttpError(400, 'Add a rough distance');
  return { landmarkId: null, label: area, area, lat: null, lng: null, campusId: campus.id, roughDistanceM: pick.roughDistanceM };
}

function happenedAtOf(value: string | null | undefined, now: Date): Timestamp {
  if (!value) return Timestamp.fromDate(now);
  const date = new Date(value);
  const oldest = now.getTime() - MAX_HAPPENED_DAYS * 24 * 60 * 60 * 1000;
  if (date.getTime() > now.getTime() + 5 * 60 * 1000 || date.getTime() < oldest) {
    throw new CampusHttpError(400, 'Pick a date in the last two months');
  }
  return Timestamp.fromDate(date);
}

/** Open lost and found posts on the viewer's campus, redacted for the viewer. */
export async function GET() {
  try {
    const principal = await lostFoundPrincipal();
    // Two equality filters need no composite index; newest first is sorted here.
    const snapshot = await getAdminDb()
      .collection(CAMPUS_COLLECTIONS.lostFound)
      .where('campusId', '==', principal.campus.id)
      .where('status', '==', 'open')
      .limit(FEED_LIMIT)
      .get();
    const items = sortNewestFirst(
      snapshot.docs.map((doc) => redactForViewer({ ...(doc.data() as LostFoundRecord), id: doc.id }, principal.userId)),
    );
    return NextResponse.json({ items, campus: principal.campus }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

/** Creates a lost or found post on the poster's campus. */
export async function POST(request: NextRequest) {
  try {
    const principal = await lostFoundPrincipal();
    const input = createSchema.parse(await request.json());
    const rate = await checkRateLimit('lost-found-post', principal.userId, 10, 24 * 3600);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

    const images = [...new Set(input.images)];
    if (images.length) await assertOwnedCampusMedia(images, principal.userId, 'campus');
    const contact = normalizeContact(input.contact.kind, input.contact.value);
    if (!contact.ok) throw new CampusHttpError(400, contact.error);

    const now = new Date();
    const stamp = Timestamp.fromDate(now);
    const record: LostFoundRecord = {
      authorId: principal.userId,
      campusId: principal.campus.id,
      kind: input.kind,
      category: input.category,
      status: 'open',
      title: input.title,
      description: input.description,
      images,
      place: resolvePlace(principal, input.place),
      happenedAt: happenedAtOf(input.happenedAt, now),
      keptAt: input.kind === 'found' ? input.keptAt?.trim() || null : null,
      posterDisplayName: principal.displayName,
      claimQuestion: input.claimQuestion?.trim() || null,
      claimAnswer: input.claimQuestion?.trim() ? input.claimAnswer?.trim() || null : null,
      contact: contact.contact,
      claims: {},
      createdAt: stamp,
      updatedAt: stamp,
    };
    const ref = getAdminDb().collection(CAMPUS_COLLECTIONS.lostFound).doc();
    await ref.set(record);
    return NextResponse.json({ item: redactForViewer({ ...record, id: ref.id }, principal.userId) }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid post' }, { status: 400, headers: NO_STORE });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid post' }, { status: 400, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}
