import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal, type CampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { PICK_COLLEGE_FIRST_MESSAGE } from '@/lib/campus/membership';
import { createCampusContentWithSerial } from '@/lib/campus/serial';
import { orderCampusItems } from '@/lib/campus/policy';
import { assertOwnedCampusMedia } from '@/lib/campus/media';
import { marketCreateSchema, type MarketCreate } from '@/lib/campus/marketSchema';
import { computeExpiry, isDuplicateTitle, type ExpiryDetails, type ExpiryKind } from '@/lib/campus/listingRules';
import { serializeMarketListing, type ViewerOrigin } from '@/lib/campus/marketSerialize';
import { haversineMeters, roundForPrivacy } from '@/lib/format/distance';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import type { CampusAudience, ListingPlace } from '@/types/campus';
import type { Campus } from '@/types/college';

/** Per-user contact numbers, one per audience. Server only (rules deny clients). */
const PRIVATE_PROFILES = 'campus_private_profiles';
/** Per-post contact numbers, read by the contact-request flow. */
const PRIVATE_CONTACTS = 'campus_private_contacts';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const LIVE_STATUSES = new Set(['active', 'reserved']);
const OPEN_STATUSES = new Set(['active', 'reserved', 'needs_confirmation']);
const DUPLICATE_ERROR = 'You already posted this';
const NUMBER_ERROR = 'Add your WhatsApp number';

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

async function savedMarketIds(userId: string): Promise<Set<string>> {
  const saves = await getAdminDb().collection(CAMPUS_COLLECTIONS.saves).where('userId', '==', userId).limit(500).get();
  return new Set(
    saves.docs
      .map((item) => item.data())
      .filter((data) => data.contentType === 'marketplace' && typeof data.contentId === 'string')
      .map((data) => data.contentId as string),
  );
}

export async function GET(request: NextRequest) {
  try {
    const audience = routeAudience(request);
    const principal = await getCampusPrincipal({ requireVerified: true, audience, product: 'marketplace' });
    const mine = request.nextUrl.searchParams.get('mine') === '1';
    const collegeId = principal.membership!.collegeId;
    const campus = memberCampus(principal);
    const origin = originOf(campus);

    const listings = getAdminDb().collection(CAMPUS_COLLECTIONS.market);
    const query = mine
      ? listings.where('authorId', '==', principal.userId).limit(200)
      : listings.where('status', 'in', ['active', 'reserved']).limit(200);
    const [snapshot, savedIds] = await Promise.all([query.get(), savedMarketIds(principal.userId)]);
    const now = Date.now();

    const serialized = snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        return data.audience === audience && (mine || data.collegeId === collegeId);
      })
      .map((doc) => serializeMarketListing(doc, principal.userId, savedIds, origin, now))
      .filter((item) => mine || LIVE_STATUSES.has(item.status));
    const items = orderCampusItems(serialized, collegeId);

    const campusRef = principal.campus ? { id: principal.campus.id, code: principal.campus.code, label: principal.campus.label } : null;
    return NextResponse.json({ campus: campusRef, items }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

/** A date-time, or a date-only 'YYYY-MM-DD' read as the end of that IST day. */
function instant(value: string | null | undefined): Timestamp | null {
  if (!value) return null;
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T23:59:59.999+05:30`) : Date.parse(value);
  return Number.isFinite(ms) ? Timestamp.fromMillis(ms) : null;
}

/** The kind's natural end, for computeExpiry. */
function expiryInput(input: MarketCreate): { kind: ExpiryKind; details: ExpiryDetails } {
  switch (input.kind) {
    case 'seat':
      return { kind: 'ride', details: { departure: input.endsAt ?? input.departureAt } };
    case 'cab_split':
      return { kind: 'ride', details: { departure: input.departureAt } };
    case 'ticket':
      return { kind: 'ticket', details: { showtime: input.happensAt } };
    case 'pass':
      return { kind: 'pass', details: { validUntil: input.validUntil } };
    default:
      return { kind: input.kind, details: {} };
  }
}

/** Stored details for each kind. Dates become timestamps. */
function detailsFor(input: MarketCreate) {
  switch (input.kind) {
    case 'item':
      return { kind: input.kind, condition: input.condition, brand: input.brand };
    case 'wanted':
      return { kind: input.kind, budgetMax: input.budgetMax, neededBy: instant(input.neededBy) };
    case 'bundle':
      return { kind: input.kind, parts: input.parts.map((part) => ({ title: part.title, price: part.price })), splitOk: input.splitOk };
    case 'seat':
      return { kind: input.kind, seatFor: input.seatFor, startsAt: instant(input.departureAt), endsAt: instant(input.endsAt), seatsLeft: input.seatsLeft };
    case 'cab_split':
      return { kind: input.kind, from: input.from, to: input.to, leavesAt: instant(input.departureAt), seatsLeft: input.seatsLeft, totalFare: input.totalFare };
    case 'ticket':
      return { kind: input.kind, happensAt: instant(input.happensAt), venue: input.venue, quantity: input.quantity, faceValue: input.faceValue };
    case 'pass':
      return { kind: input.kind, passType: input.passType, validUntil: instant(input.validUntil) };
    case 'vehicle':
      return {
        kind: input.kind,
        vehicleType: input.vehicleType,
        offer: input.offer,
        year: input.year,
        kmDriven: input.kmDriven,
        papersOk: input.papersOk,
        plateState: input.plateState ?? null,
      };
  }
}

/**
 * The landmark the poster picked, looked up in the college config on the server.
 * The member's own campus first, then the college's other campuses.
 * Client coordinates are never read.
 */
function resolvePlace(principal: CampusPrincipal, home: Campus, landmarkId: string | undefined): ListingPlace | null {
  if (!landmarkId) return null;
  const campuses = [home, ...(principal.config?.campuses ?? []).filter((campus) => campus.id !== home.id)];
  for (const campus of campuses) {
    const landmark = campus.landmarks.find((item) => item.id === landmarkId);
    if (landmark) {
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
  }
  throw new CampusHttpError(400, 'Pick a place from the list');
}

/** The author's live or needs-confirmation post with the same title, if any. */
async function findDuplicate(userId: string, audience: CampusAudience, title: string): Promise<string | null> {
  const snapshot = await getAdminDb().collection(CAMPUS_COLLECTIONS.market).where('authorId', '==', userId).limit(200).get();
  const now = Date.now();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.audience !== audience || typeof data.title !== 'string') continue;
    if (!OPEN_STATUSES.has(serializeMarketListing(doc, userId, undefined, null, now).status)) continue;
    if (isDuplicateTitle(title, [data.title])) return doc.id;
  }
  return null;
}

/** The number for this post: the one typed, or the one saved for this audience. */
async function contactNumber(userId: string, audience: CampusAudience, input: MarketCreate): Promise<string> {
  if (input.whatsappNumber) return input.whatsappNumber;
  if (!input.useSavedNumber) throw new CampusHttpError(400, NUMBER_ERROR);
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
    const input = marketCreateSchema.parse(await request.json());
    const principal = await getCampusPrincipal({ requireVerified: true, audience, product: 'marketplace' });
    const membership = principal.membership!;
    const home = memberCampus(principal);
    if (!home) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);

    const now = new Date();
    const expiryFor = expiryInput(input);
    const expiry = computeExpiry(expiryFor.kind, expiryFor.details, now);
    if (expiry.hardExpiresAt && Date.parse(expiry.hardExpiresAt) <= now.getTime()) {
      throw new CampusHttpError(400, 'That date has already passed');
    }
    const place = resolvePlace(principal, home, input.landmarkId);

    const existingId = await findDuplicate(principal.userId, audience, input.title);
    if (existingId) return NextResponse.json({ existingId, error: DUPLICATE_ERROR }, { status: 409, headers: NO_STORE });

    const rate = await checkRateLimit('marketplace-create', principal.userId, 20, 86400);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    await assertOwnedCampusMedia(input.images, principal.userId, audience);
    const whatsappNumber = await contactNumber(principal.userId, audience, input);

    const createdAt = Timestamp.fromDate(now);
    const result = await createCampusContentWithSerial({
      // serial.ts still names the old collection in its type; the helper only passes it to db.collection().
      collection: CAMPUS_COLLECTIONS.market as string as 'marketplace_listings',
      collegeCode: membership.collegeCode,
      product: 'M',
      payload: {
        authorId: principal.userId,
        collegeId: membership.collegeId,
        collegeCode: membership.collegeCode,
        campusId: home.id,
        audience,
        kind: input.kind,
        category: input.category,
        status: 'active',
        title: input.title,
        description: input.description ?? '',
        price: input.priceTerms === 'free' || input.priceTerms === 'swap' ? null : input.price,
        priceTerms: input.priceTerms,
        previousPrice: null,
        priceDroppedAt: null,
        images: input.images,
        place,
        genderPref: input.genderPref,
        details: detailsFor(input),
        sellerDisplayName: principal.displayName,
        promotionEligible: audience === 'campus',
        reservedBy: null,
        reservedUntil: null,
        confirmedAt: null,
        createdAt,
        updatedAt: createdAt,
        availabilityExpiresAt: Timestamp.fromMillis(Date.parse(expiry.availabilityExpiresAt)),
        hardExpiresAt: expiry.hardExpiresAt ? Timestamp.fromMillis(Date.parse(expiry.hardExpiresAt)) : null,
        moderation: { reportCount: 0, lastReviewedAt: null },
      },
    });

    const db = getAdminDb();
    // Per post, so a number given on a Girls' Space post never reaches buyers of campus posts.
    await db.collection(PRIVATE_CONTACTS).doc(`marketplace_${result.id}`).set({
      authorId: principal.userId,
      audience,
      whatsappNumber,
      updatedAt: Timestamp.now(),
    });
    if (!input.useSavedNumber) {
      await db.collection(PRIVATE_PROFILES).doc(principal.userId).set(
        { lastNumber: { [audience]: whatsappNumber }, updatedAt: Timestamp.now() },
        { merge: true },
      );
    }

    return NextResponse.json(
      { ...result, hardExpiresAt: expiry.hardExpiresAt, availabilityExpiresAt: expiry.availabilityExpiresAt },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid listing' }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid listing' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
