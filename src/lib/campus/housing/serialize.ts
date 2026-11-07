// Housing listing doc -> what a viewer sees: effective status (a lapsed reserve
// is active again), a distance from the viewer's campus, the price-drop flag and
// the owner's "still available?" nudge. Coordinates and the author id never leave.
// Pure module: node tests import it, so '@/...' only as `import type`.
import type { GenderPref, ListingPlace } from '@/types/campus';
import type {
  Brokerage,
  Furnishing,
  HouseRule,
  HousingListing,
  HousingStatus,
  HousingStayType,
  RentInclusion,
  RentPeriod,
  RentTerms,
  RoommatePrefs,
} from '@/types/housing';
import { haversineMeters, roundForPrivacy } from '../../format/distance.ts';
import { NUDGE_DAYS } from '../constants.ts';
import { effectiveStatus, priceDropActive, type ListingStatus } from '../listingRules.ts';
import { HOUSING_KINDS, POSTED_AS, RENT_TERMS, type HousingKind, type PostedAs, type RentTermsKind } from './model.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The owner is asked "Still available?" this long after the last confirm. */
export const HOUSING_NUDGE_MS = NUDGE_DAYS * DAY_MS;

/** Structural doc snapshot, so the Admin SDK, the fixture DB and tests all fit. */
export interface HousingDocSnapshot {
  id: string;
  data(): unknown;
}

/** The viewer's campus point. Distances are measured from here. */
export interface ViewerOrigin {
  campusId: string;
  lat: number;
  lng: number;
}

/** Roommate prefs, plus the v2 group fields the create form sends. */
export type SerializedHousingRoommate = RoommatePrefs & {
  groupSize: number | null;
  languages: string[];
  homeState: string | null;
};

/** Housing listing as the API sends it. Fits HousingListingCard as is. */
export type SerializedHousingListing = Omit<HousingListing, 'status' | 'postedAs' | 'rentTerms' | 'roommate'> & {
  kind: HousingKind;
  status: HousingStatus | 'reserved';
  postedAs: PostedAs;
  /** v2 posts store the terms kind; older docs the period struct. */
  rentTerms: RentTerms | RentTermsKind;
  roommate: SerializedHousingRoommate | null;
  /** End of the reserve, only while it holds. */
  reservedUntil: string | null;
  /** Rent per person before the last drop, rupees. */
  previousRentPp: number | null;
  priceDroppedAt: string | null;
  /** True while the price-drop badge should show. */
  priceDropped: boolean;
  /** Rough metres from the viewer's campus, or null when unknown. */
  distanceM: number | null;
  /** Owner only: time to confirm the room is still free. */
  needsNudge: boolean;
};

type Raw = Record<string, unknown>;

const STAY_TYPES: readonly HousingStayType[] = ['pg', 'flat', 'hostel'];
const FURNISHINGS: readonly Furnishing[] = ['furnished', 'semi_furnished', 'unfurnished'];
const HOUSE_RULES: readonly HouseRule[] = ['no_smoking', 'no_drinking', 'no_overnight_guests', 'curfew', 'quiet_hours', 'veg_only'];
const RENT_PERIODS: readonly RentPeriod[] = ['monthly', 'quarterly', 'semester', 'yearly'];
const RENT_INCLUSIONS: readonly RentInclusion[] = ['electricity', 'water', 'wifi', 'cleaning', 'laundry', 'maintenance'];
const HOUSING_STATUSES: readonly (HousingStatus | 'reserved')[] = [
  'active',
  'reserved',
  'needs_confirmation',
  'booked',
  'filled',
  'expired',
  'closed',
  'removed',
];
const NUDGE_STATUSES: ReadonlySet<string> = new Set(['active', 'needs_confirmation']);

function asRecord(value: unknown): Raw {
  return value && typeof value === 'object' ? (value as Raw) : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

function nullableOneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Timestamp, Date, ISO string or epoch ms -> ISO string, else null. */
export function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof (value as { toDate?: unknown }).toDate === 'function') date = (value as { toDate(): Date }).toDate();
  else if (typeof value === 'string' || typeof value === 'number') date = new Date(value);
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function iso(value: unknown): string {
  return isoOrNull(value) ?? new Date(0).toISOString();
}

function toMs(now: Date | number): number {
  return now instanceof Date ? now.getTime() : now;
}

export function readHousingPlace(value: unknown): ListingPlace | null {
  if (!value || typeof value !== 'object') return null;
  const place = value as Raw;
  return {
    landmarkId: typeof place.landmarkId === 'string' && place.landmarkId !== 'other' ? place.landmarkId : null,
    label: asString(place.label),
    area: asString(place.area),
    lat: asNumber(place.lat),
    lng: asNumber(place.lng),
    campusId: asString(place.campusId),
    roughDistanceM: asNumber(place.roughDistanceM),
  };
}

/**
 * Metres from the viewer's campus. Coordinates win; a typed rough distance only
 * counts on the poster's campus, since it was measured from there.
 */
export function housingDistanceM(place: ListingPlace | null, origin: ViewerOrigin | null): number | null {
  if (!place || !origin) return null;
  if (place.lat !== null && place.lng !== null) {
    return roundForPrivacy(haversineMeters({ lat: origin.lat, lng: origin.lng }, { lat: place.lat, lng: place.lng }));
  }
  if (place.roughDistanceM !== null && place.campusId !== '' && place.campusId === origin.campusId) return place.roughDistanceM;
  return null;
}

function readRentTerms(value: unknown): RentTerms | RentTermsKind {
  if (typeof value === 'string') return oneOf(value, RENT_TERMS, 'fixed');
  if (!value || typeof value !== 'object') return 'fixed';
  const terms = value as Raw;
  return {
    period: oneOf(terms.period, RENT_PERIODS, 'monthly'),
    includes: strings(terms.includes).filter((item): item is RentInclusion => (RENT_INCLUSIONS as readonly string[]).includes(item)),
    noticeMonths: asNumber(terms.noticeMonths),
  };
}

function readBrokerage(value: unknown): Brokerage {
  const brokerage = asRecord(value);
  const charged = brokerage.charged === true;
  return { charged, amount: charged ? asNumber(brokerage.amount) : null };
}

function readRoommate(value: unknown): SerializedHousingRoommate | null {
  if (!value || typeof value !== 'object') return null;
  const roommate = value as Raw;
  const homeState = asString(roommate.homeState).trim();
  const note = asString(roommate.note).trim();
  return {
    sleep: nullableOneOf(roommate.sleep, ['early', 'late', 'flexible'] as const),
    tidiness: nullableOneOf(roommate.tidiness, ['tidy', 'relaxed'] as const),
    smoking: nullableOneOf(roommate.smoking, ['no', 'outside', 'ok'] as const),
    note: note || null,
    groupSize: asNumber(roommate.groupSize),
    languages: strings(roommate.languages).map((item) => item.trim()).filter(Boolean),
    homeState: homeState || null,
  };
}

function readWhoCanStay(value: unknown): GenderPref {
  return value === 'girls' || value === 'boys' ? value : 'anyone';
}

/**
 * True when the owner should confirm the room is still free: 3 days after the
 * last confirm (or the post date), while the post is open and not reserved.
 */
export function housingNeedsNudge(
  listing: { status: string; confirmedAt: string | null; createdAt: string },
  isOwner: boolean,
  now: Date | number,
): boolean {
  if (!isOwner || !NUDGE_STATUSES.has(listing.status)) return false;
  const since = Date.parse(listing.confirmedAt ?? listing.createdAt);
  if (!Number.isFinite(since)) return false;
  return toMs(now) - since >= HOUSING_NUDGE_MS;
}

export function serializeHousingListing(
  snapshot: HousingDocSnapshot,
  viewerId: string,
  savedIds: ReadonlySet<string> = new Set(),
  origin: ViewerOrigin | null = null,
  now: Date | number = Date.now(),
): SerializedHousingListing {
  const data = asRecord(snapshot.data());
  const storedStatus = oneOf(data.status, HOUSING_STATUSES, 'closed');
  const reservedUntil = isoOrNull(data.reservedUntil);
  const availabilityExpiresAt = iso(data.availabilityExpiresAt);
  // 'booked' is not a lifecycle status; effectiveStatus passes closed states through untouched.
  const status = effectiveStatus(
    { status: storedStatus as ListingStatus, reservedUntil, availabilityExpiresAt },
    now,
  ) as HousingStatus | 'reserved';

  const rentPp = asNumber(data.rentPp) ?? 0;
  const previousRentPp = asNumber(data.previousRentPp);
  const priceDroppedAt = isoOrNull(data.priceDroppedAt);
  const place = readHousingPlace(data.place);
  const distanceM = housingDistanceM(place, origin);
  const isOwner = asString(data.authorId) !== '' && asString(data.authorId) === viewerId;
  const createdAt = iso(data.createdAt);
  const confirmedAt = isoOrNull(data.confirmedAt);
  const audience = data.audience === 'girls' ? 'girls' : 'campus';

  return {
    id: snapshot.id,
    serial: asString(data.serial),
    collegeId: asString(data.collegeId),
    collegeCode: asString(data.collegeCode),
    campusId: asString(data.campusId),
    audience,
    kind: oneOf(data.kind, HOUSING_KINDS, 'room'),
    postedAs: oneOf(data.postedAs, POSTED_AS, 'tenant'),
    stayType: oneOf(data.stayType, STAY_TYPES, 'pg'),
    status,
    title: asString(data.title),
    description: asString(data.description),
    brokerage: readBrokerage(data.brokerage),
    whoCanStay: audience === 'girls' ? 'girls' : readWhoCanStay(data.whoCanStay),
    // Empty means no restrictions.
    houseRules: strings(data.houseRules).filter((item): item is HouseRule => (HOUSE_RULES as readonly string[]).includes(item)),
    moveIn: isoOrNull(data.moveIn),
    bedsLeft: asNumber(data.bedsLeft) ?? 0,
    sharing: asNumber(data.sharing),
    rentPp,
    deposit: asNumber(data.deposit),
    rentTerms: readRentTerms(data.rentTerms),
    furnishing: nullableOneOf(data.furnishing, FURNISHINGS),
    amenities: strings(data.amenities),
    images: strings(data.images),
    // Coordinates stay on the server. The rough distance is the viewer's own.
    place: {
      landmarkId: place?.landmarkId ?? null,
      label: place?.label ?? '',
      area: place?.area ?? '',
      campusId: place?.campusId ?? '',
      roughDistanceM: distanceM,
    },
    roommate: readRoommate(data.roommate),
    poster: { displayName: asString(data.posterDisplayName) || 'Student', verified: true },
    promotionEligible: audience !== 'girls' && data.promotionEligible !== false,
    reservedUntil: status === 'reserved' ? reservedUntil : null,
    previousRentPp,
    priceDroppedAt,
    priceDropped: priceDropActive({ price: rentPp, previousPrice: previousRentPp, priceDroppedAt }, now),
    distanceM,
    needsNudge: housingNeedsNudge({ status, confirmedAt, createdAt }, isOwner, now),
    confirmedAt,
    createdAt,
    updatedAt: iso(data.updatedAt ?? data.createdAt),
    availabilityExpiresAt,
    isSaved: savedIds.has(snapshot.id),
    isOwner,
  };
}
