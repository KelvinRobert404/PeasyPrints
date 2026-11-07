import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { isFixtureMode } from '@/lib/firebase/fixtureMode';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal, requireAdminPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS, DEAL_CATEGORY_LABELS } from '@/lib/campus/constants';
import { getCampus } from '@/lib/campus/catalog';
import { loadCollegeConfig } from '@/lib/campus/collegeConfig';
import { SAMPLE_DEAL_CREATOR } from '@/lib/campus/fixtures/utilities';
import { haversineMeters, roundForPrivacy } from '@/lib/format/distance';
import { isDealLive, publicDealDistance, sortByDistance, type StudentDeal, type StudentDealsPayload } from '@/lib/campus/studentDeals';
import type { ListingPlace } from '@/types/campus';
import type { GeoOrigin } from '@/types/college';
import type { DealCategory } from '@/types/utilities';

// Student deals: free for verified students, never paid.
// GET is for verified students. POST, PATCH and DELETE are admin only (no Godview UI yet).

const NO_STORE = { 'Cache-Control': 'private, no-store' };
/** Firestore caps an 'in' filter at 30 values. */
const MAX_CAMPUSES = 30;
const MAX_DEALS = 200;

const DEAL_CATEGORIES = Object.keys(DEAL_CATEGORY_LABELS) as [DealCategory, ...DealCategory[]];

const docId = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((id) => !id.includes('/'), 'Invalid deal id');

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);

/**
 * PATCH version of optionalText: a missing field stays undefined (left as is),
 * only a present '' or null clears it. The POST version turns missing into null.
 */
const optionalPatchText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

const dealFields = {
  category: z.enum(DEAL_CATEGORIES),
  merchantName: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(80),
  offer: z.string().trim().min(2).max(80),
  code: optionalText(24),
  howToClaim: optionalText(160),
  /** A landmark of the deal's campus, or null for no place. */
  landmarkId: z.string().trim().max(200).nullable().optional(),
  /** ISO date-time the deal ends, or null for no end date. */
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
};

const createSchema = z.object({ campusId: z.string().trim().min(1).max(100), ...dealFields });

const patchSchema = z
  .object({
    id: docId,
    category: dealFields.category.optional(),
    merchantName: dealFields.merchantName.optional(),
    title: dealFields.title.optional(),
    offer: dealFields.offer.optional(),
    code: optionalPatchText(24),
    howToClaim: optionalPatchText(160),
    landmarkId: dealFields.landmarkId,
    validUntil: dealFields.validUntil,
    status: z.enum(['active', 'expired']).optional(),
  })
  .strict();

/** The catalog campus with runtime overrides (landmarks can be added in config). */
async function loadCampus(campusId: string) {
  const fromCatalog = getCampus(campusId);
  if (!fromCatalog) throw new CampusHttpError(400, 'Unknown campus');
  const config = await loadCollegeConfig(fromCatalog.collegeId);
  return config?.campuses.find((campus) => campus.id === campusId) ?? fromCatalog;
}

/** A listing place at one of the campus landmarks. Null clears the place. */
async function placeFor(campusId: string, landmarkId: string | null): Promise<ListingPlace | null> {
  if (!landmarkId) return null;
  const campus = await loadCampus(campusId);
  const landmark = campus.landmarks.find((item) => item.id === landmarkId);
  if (!landmark) throw new CampusHttpError(400, 'Pick a landmark from this campus');
  return {
    landmarkId: landmark.id,
    label: landmark.label,
    area: landmark.area,
    lat: landmark.lat,
    lng: landmark.lng,
    campusId,
    roughDistanceM: roundForPrivacy(haversineMeters(campus.origin, landmark)),
  };
}

function endTime(value: string | null | undefined, now: Date): Timestamp | null {
  if (!value) return null;
  const end = new Date(value);
  if (end.getTime() <= now.getTime()) throw new CampusHttpError(400, 'End date must be in the future');
  return Timestamp.fromDate(end);
}

function iso(value: unknown): string | null {
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

function stringOr<T extends string | null>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/** A stored deal as students see it: no coordinates, no creator, a rough distance. */
function toStudentDeal(id: string, data: Record<string, unknown>, origin: GeoOrigin | null, fixtures: boolean): StudentDeal {
  const place = (data.place ?? null) as ListingPlace | null;
  return {
    id,
    campusId: String(data.campusId ?? ''),
    category: (data.category as DealCategory) ?? 'other',
    status: 'active',
    merchantName: stringOr(data.merchantName, 'Local shop'),
    title: stringOr(data.title, ''),
    offer: stringOr(data.offer, ''),
    code: stringOr(data.code, null),
    howToClaim: stringOr(data.howToClaim, null),
    place: place
      ? { landmarkId: place.landmarkId ?? null, label: place.label, area: place.area, campusId: place.campusId, roughDistanceM: place.roughDistanceM ?? null }
      : null,
    images: Array.isArray(data.images) ? data.images.filter((item): item is string => typeof item === 'string') : [],
    validUntil: iso(data.validUntil),
    createdAt: iso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(data.updatedAt) ?? new Date(0).toISOString(),
    distanceM: publicDealDistance({ place }, origin),
    // Every deal in fixture mode is seed data, and seeded examples are never real offers.
    sample: fixtures || data.createdBy === SAMPLE_DEAL_CREATOR,
  };
}

/** Live deals for the viewer's college, nearest to the viewer's campus first. */
export async function GET() {
  try {
    const principal = await getCampusPrincipal({ requireVerified: true, product: 'deals' });
    const config = principal.config;
    if (!config) throw new CampusHttpError(409, 'Pick your college first');
    const campus = principal.campus ? config.campuses.find((item) => item.id === principal.campus!.id) ?? null : null;
    const origin = campus?.origin ?? null;
    const campusIds = config.campuses.map((item) => item.id).slice(0, MAX_CAMPUSES);

    const now = Date.now();
    const snapshot = campusIds.length
      ? await getAdminDb().collection(CAMPUS_COLLECTIONS.deals).where('campusId', 'in', campusIds).limit(MAX_DEALS).get()
      : null;
    const live = (snapshot?.docs ?? []).filter((doc) => isDealLive(doc.data() as { status: string; validUntil?: Timestamp | null }, now));
    // Sort on stored coordinates, then drop them in toStudentDeal.
    const sorted = sortByDistance(
      live.map((doc) => ({ id: doc.id, data: doc.data(), place: (doc.data().place ?? null) as ListingPlace | null })),
      origin
    );
    const fixtures = isFixtureMode();
    const payload: StudentDealsPayload = {
      deals: sorted.map((item) => toStudentDeal(item.id, item.data, origin, fixtures)),
      campus: principal.campus ? { id: principal.campus.id, code: principal.campus.code, label: principal.campus.label } : null,
    };
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

/** Admin: add a deal for one campus. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminPrincipal();
    const body = createSchema.parse(await request.json());
    const campus = await loadCampus(body.campusId);
    const now = new Date();
    const doc = {
      campusId: campus.id,
      category: body.category,
      status: 'active' as const,
      merchantName: body.merchantName,
      title: body.title,
      offer: body.offer,
      code: body.code,
      howToClaim: body.howToClaim,
      place: await placeFor(campus.id, body.landmarkId ?? null),
      images: [] as string[],
      validUntil: endTime(body.validUntil, now),
      createdBy: admin.userId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };
    const ref = await getAdminDb().collection(CAMPUS_COLLECTIONS.deals).add(doc);
    return NextResponse.json({ id: ref.id }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid deal' }, { status: 400, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}

/** Admin: edit a deal, or end it early with status 'expired'. */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdminPrincipal();
    const { id, landmarkId, validUntil, ...fields } = patchSchema.parse(await request.json());
    const ref = getAdminDb().collection(CAMPUS_COLLECTIONS.deals).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Deal not found');
    const current = snapshot.data() ?? {};
    if (current.status === 'removed') throw new CampusHttpError(409, 'Deal was removed');

    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: Timestamp.fromDate(now) };
    for (const [key, value] of Object.entries(fields)) if (value !== undefined) updates[key] = value;
    if (landmarkId !== undefined) updates.place = await placeFor(String(current.campusId ?? ''), landmarkId);
    if (validUntil !== undefined) updates.validUntil = endTime(validUntil, now);
    await ref.set(updates, { merge: true });
    return NextResponse.json({ id }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid deal' }, { status: 400, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}

/** Admin: take a deal down. Soft delete (status 'removed') so it can be restored by hand. */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdminPrincipal();
    const id = docId.parse(request.nextUrl.searchParams.get('id') ?? '');
    const ref = getAdminDb().collection(CAMPUS_COLLECTIONS.deals).doc(id);
    if (!(await ref.get()).exists) throw new CampusHttpError(404, 'Deal not found');
    await ref.set({ status: 'removed', updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json({ id, status: 'removed' }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid deal id' }, { status: 400, headers: NO_STORE });
    return campusErrorResponse(error);
  }
}
