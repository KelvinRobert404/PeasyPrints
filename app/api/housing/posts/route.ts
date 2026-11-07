import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal, type CampusPrincipal } from '@/lib/campus/auth';
import { AVAILABILITY_DAYS, CAMPUS_COLLECTIONS, addDays } from '@/lib/campus/constants';
import { PICK_COLLEGE_FIRST_MESSAGE } from '@/lib/campus/membership';
import { createCampusContentWithSerial } from '@/lib/campus/serial';
import { orderCampusItems } from '@/lib/campus/policy';
import { assertOwnedCampusMedia } from '@/lib/campus/media';
import { NO_RESTRICTIONS, containsPhoneNumber } from '@/lib/campus/housing/model';
import { OTHER_PLACE, firstIssueMessage, housingCreateSchema, type HousingCreate } from '@/lib/campus/housing/schema';
import { serializeHousingListing, type ViewerOrigin } from '@/lib/campus/housing/serialize';
import { nextSemStart } from '@/lib/campus/season';
import { haversineMeters, roundForPrivacy } from '@/lib/format/distance';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import type { CampusAudience, ListingPlace } from '@/types/campus';
import type { Campus } from '@/types/college';
import type { HouseRule } from '@/types/housing';

/** Per-user contact numbers, one per audience. Server only (rules deny clients). */
const PRIVATE_PROFILES = 'campus_private_profiles';
/** Per-post contact numbers, read by the contact-request flow. */
const PRIVATE_CONTACTS = 'campus_private_contacts';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const LIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'reserved']);
const NUMBER_ERROR = 'Add your WhatsApp number';
const NO_PHONE = 'Remove phone numbers. Students reach you in chat.';

/** Indian mobile: 10 digits starting 6 to 9, optional +91, 91 or 0 in front. Stored as 10 digits. */
const contactSchema = z
  .object({
    whatsappNumber: z
      .string()
      .transform((value) => value.replace(/[\s\-().]/g, ''))
      .pipe(z.string().regex(/^(?:\+?91|0)?[6-9]\d{9}$/, 'Enter a 10 digit mobile number'))
      .transform((value) => value.slice(-10))
      .optional(),
    /** Use the number already saved on the profile. */
    useSavedNumber: z.boolean().optional(),
  })
  .refine((value) => !(value.whatsappNumber && value.useSavedNumber), {
    path: ['whatsappNumber'],
    message: 'Use the saved number or a new one',
  });

function routeAudience(request: NextRequest): CampusAudience {
  return request.nextUrl.pathname.startsWith('/api/girls-space/') ? 'girls' : 'campus';
}

/** The member's campus from the session config, never from the client. */
function memberCampus(principal: CampusPrincipal): Campus | null {
  const campusId = principal.campus?.id;
  if (!campusId || !principal.config) return null;
  return principal.config.campuses.find((campus) => campus.id === campusId) ?? null;
}

function originOf(campus: Campus | null): ViewerOrigin | null {
  return campus ? { campusId: campus.id, lat: campus.origin.lat, lng: campus.origin.lng } : null;
}

async function savedHousingIds(userId: string): Promise<Set<string>> {
  const saves = await getAdminDb().collection(CAMPUS_COLLECTIONS.saves).where('userId', '==', userId).limit(500).get();
  return new Set(
    saves.docs
      .map((item) => item.data())
      .filter((data) => data.contentType === 'housing' && typeof data.contentId === 'string')
      .map((data) => data.contentId as string),
  );
}

export async function GET(request: NextRequest) {
  try {
    const audience = routeAudience(request);
    const principal = await getCampusPrincipal({ requireVerified: true, audience, product: 'housing' });
    const mine = request.nextUrl.searchParams.get('mine') === '1';
    const collegeId = principal.membership!.collegeId;
    const origin = originOf(memberCampus(principal));

    const listings = getAdminDb().collection(CAMPUS_COLLECTIONS.housing);
    const query = mine
      ? listings.where('authorId', '==', principal.userId).limit(200)
      : listings.where('status', 'in', ['active', 'reserved']).limit(200);
    const [snapshot, savedIds] = await Promise.all([query.get(), savedHousingIds(principal.userId)]);
    const now = Date.now();

    const serialized = snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        // The viewer's college only, checked in memory so the query needs no extra index.
        return data.audience === audience && (mine || data.collegeId === collegeId);
      })
      .map((doc) => serializeHousingListing(doc, principal.userId, savedIds, origin, now))
      .filter((item) => mine || LIVE_STATUSES.has(item.status));
    const items = orderCampusItems(serialized, collegeId);

    const campus = principal.campus ? { id: principal.campus.id, code: principal.campus.code, label: principal.campus.label } : null;
    return NextResponse.json({ campus, items }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

/**
 * The place on the poster's campus. A picked landmark comes from the college
 * config on the server; client coordinates are never read. An 'other' place
 * keeps only the typed area and rough distance.
 */
function resolvePlace(home: Campus, place: HousingCreate['place']): ListingPlace {
  if (place.landmarkId === OTHER_PLACE) {
    const area = place.area ?? '';
    return {
      landmarkId: null,
      label: area,
      area,
      lat: null,
      lng: null,
      campusId: home.id,
      roughDistanceM: place.roughDistanceM === null ? null : roundForPrivacy(place.roughDistanceM),
    };
  }
  const landmark = home.landmarks.find((item) => item.id === place.landmarkId);
  if (!landmark) throw new CampusHttpError(400, 'Pick a place from the list');
  return {
    landmarkId: landmark.id,
    label: landmark.label,
    area: landmark.area,
    lat: landmark.lat,
    lng: landmark.lng,
    campusId: home.id,
    roughDistanceM: roundForPrivacy(haversineMeters(home.origin, landmark)),
  };
}

/** 'now' -> null (right away); 'next_sem' and dates -> the start of that IST day. */
function moveInTime(moveIn: string, now: Date): Timestamp | null {
  if (moveIn === 'now') return null;
  const key = moveIn === 'next_sem' ? nextSemStart(now) : moveIn;
  const ms = Date.parse(`${key}T00:00:00.000+05:30`);
  return Number.isFinite(ms) ? Timestamp.fromMillis(ms) : null;
}

/** The number for this post: the one typed, or the one saved for this audience. */
async function contactNumber(userId: string, audience: CampusAudience, contact: z.output<typeof contactSchema>): Promise<string> {
  if (contact.whatsappNumber) return contact.whatsappNumber;
  if (!contact.useSavedNumber) throw new CampusHttpError(400, NUMBER_ERROR);
  const profile = await getAdminDb().collection(PRIVATE_PROFILES).doc(userId).get();
  const lastNumber = profile.exists ? profile.data()?.lastNumber : null;
  // Per audience: a Girls' Space number never fills a campus post.
  const saved = lastNumber && typeof lastNumber === 'object' ? (lastNumber as Record<string, unknown>)[audience] : null;
  if (typeof saved !== 'string' || !saved) throw new CampusHttpError(400, NUMBER_ERROR);
  return saved;
}

export async function POST(request: NextRequest) {
  try {
    const audience = routeAudience(request);
    const raw: unknown = await request.json();
    const principal = await getCampusPrincipal({ requireVerified: true, audience, product: 'housing' });
    const membership = principal.membership!;
    const home = memberCampus(principal);
    if (!home) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);

    // The girls' route forces who can stay to girls; places come from the poster's campus.
    const input = housingCreateSchema({ audience, landmarkIds: home.landmarks.map((item) => item.id) }).parse(raw);
    const contact = contactSchema.parse(raw);
    if ([input.place.area ?? '', ...input.amenities].some((text) => containsPhoneNumber(text))) {
      throw new CampusHttpError(400, NO_PHONE);
    }
    const place = resolvePlace(home, input.place);

    const rate = await checkRateLimit('housing-create', principal.userId, 10, 86400);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    await assertOwnedCampusMedia(input.images, principal.userId, audience);
    const whatsappNumber = await contactNumber(principal.userId, audience, contact);

    const now = new Date();
    const createdAt = Timestamp.fromDate(now);
    const result = await createCampusContentWithSerial({
      // serial.ts still names the old collection in its type; the helper only passes it to db.collection().
      collection: CAMPUS_COLLECTIONS.housing as string as 'housing_posts',
      collegeCode: membership.collegeCode,
      product: 'H',
      payload: {
        authorId: principal.userId,
        collegeId: membership.collegeId,
        collegeCode: membership.collegeCode,
        campusId: home.id,
        audience,
        kind: input.kind,
        postedAs: input.postedAs,
        stayType: input.stayType,
        status: 'active',
        title: input.title,
        description: input.description,
        brokerage: input.brokerage ?? { charged: false, amount: null },
        whoCanStay: audience === 'girls' ? 'girls' : input.whoCanStay,
        // Stored without 'no_restrictions': an empty list means no restrictions.
        houseRules: input.houseRules.filter((rule): rule is HouseRule => rule !== NO_RESTRICTIONS),
        moveIn: moveInTime(input.moveIn, now),
        bedsLeft: input.bedsLeft,
        sharing: input.sharing,
        rentPp: input.rentPp,
        deposit: input.deposit,
        rentTerms: input.rentTerms,
        furnishing: input.furnishing,
        amenities: input.amenities,
        images: input.images,
        place,
        roommate: input.roommate,
        posterDisplayName: principal.displayName,
        promotionEligible: audience === 'campus',
        previousRentPp: null,
        priceDroppedAt: null,
        reservedUntil: null,
        confirmedAt: null,
        stillAvailableNudgedAt: null,
        createdAt,
        updatedAt: createdAt,
        availabilityExpiresAt: Timestamp.fromDate(addDays(now, AVAILABILITY_DAYS)),
        moderation: { reportCount: 0, lastReviewedAt: null },
      },
    });

    const db = getAdminDb();
    // Per post, so a number given on a Girls' Space post never reaches viewers of campus posts.
    await db.collection(PRIVATE_CONTACTS).doc(`housing_${result.id}`).set({
      authorId: principal.userId,
      audience,
      whatsappNumber,
      updatedAt: Timestamp.now(),
    });
    if (!contact.useSavedNumber) {
      await db.collection(PRIVATE_PROFILES).doc(principal.userId).set(
        { lastNumber: { [audience]: whatsappNumber }, updatedAt: Timestamp.now() },
        { merge: true },
      );
    }

    return NextResponse.json(result, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: firstIssueMessage(error) }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid housing post' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
