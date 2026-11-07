// Market listing doc -> what a viewer sees: effective status, a distance from
// the viewer's campus, the price-drop flag, and no coordinates or author id.
// Pure: runtime imports are relative with the .ts extension so node tests can load it.

import type { ListingPlace } from '@/types/campus';
import type { MarketListing, MarketListingDoc, MarketStatus } from '@/types/market';
import { effectiveStatus, priceDropActive, type ListingStatus } from './listingRules.ts';
import { haversineMeters, roundForPrivacy } from '../format/distance.ts';

/** Structural doc snapshot, so the Admin SDK, the fixture DB and tests all fit. */
export interface MarketDocSnapshot {
  id: string;
  data(): unknown;
}

/** The viewer's campus point. Distances are measured from here. */
export interface ViewerOrigin {
  campusId: string;
  lat: number;
  lng: number;
}

/** Market listing as the API sends it. */
export type SerializedMarketListing = MarketListing & {
  /** Rough metres from the viewer's campus, or null when unknown. */
  distanceM: number | null;
  /** True while the price-drop badge should show. */
  priceDropped: boolean;
  /** When the listing stops showing for good (showtime, departure), or null. */
  hardExpiresAt: string | null;
};

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value && typeof value === 'object' ? (value as Raw) : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

/** Deep copy with every timestamp turned into an ISO string. */
function plain(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date || typeof (value as { toDate?: unknown }).toDate === 'function') return isoOrNull(value);
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value as Raw).map(([key, item]) => [key, plain(item)]));
  return value;
}

/** The kind's natural end from its details, for docs stored without hardExpiresAt. */
function endFromDetails(details: Raw): string | null {
  switch (details.kind) {
    case 'seat':
      return isoOrNull(details.endsAt) ?? isoOrNull(details.startsAt);
    case 'cab_split':
      return isoOrNull(details.leavesAt);
    case 'ticket':
      return isoOrNull(details.happensAt);
    case 'pass':
      return isoOrNull(details.validUntil);
    default:
      return null;
  }
}

function readPlace(value: unknown): ListingPlace | null {
  if (!value || typeof value !== 'object') return null;
  const place = value as Raw;
  return {
    landmarkId: typeof place.landmarkId === 'string' ? place.landmarkId : null,
    label: asString(place.label),
    area: asString(place.area),
    lat: asNumber(place.lat),
    lng: asNumber(place.lng),
    campusId: asString(place.campusId),
    roughDistanceM: asNumber(place.roughDistanceM),
  };
}

/**
 * Metres from the viewer's campus. Coordinates win; a stored rough distance
 * only counts when it was measured from the viewer's own campus.
 */
export function placeDistanceM(place: ListingPlace | null, origin: ViewerOrigin | null): number | null {
  if (!place || !origin) return null;
  if (place.lat !== null && place.lng !== null) {
    return roundForPrivacy(haversineMeters({ lat: origin.lat, lng: origin.lng }, { lat: place.lat, lng: place.lng }));
  }
  if (place.roughDistanceM !== null && place.campusId === origin.campusId) return place.roughDistanceM;
  return null;
}

export function serializeMarketListing(
  snapshot: MarketDocSnapshot,
  viewerId: string,
  savedIds: ReadonlySet<string> = new Set(),
  origin: ViewerOrigin | null = null,
  now: Date | number = Date.now(),
): SerializedMarketListing {
  const data = asRecord(snapshot.data());
  const storedStatus = asString(data.status, 'closed') as MarketStatus;
  const reservedUntil = isoOrNull(data.reservedUntil);
  const details = asRecord(plain(data.details ?? { kind: asString(data.kind, 'item') }));
  const hardExpiresAt = isoOrNull(data.hardExpiresAt) ?? endFromDetails(details);
  const availabilityExpiresAt = iso(data.availabilityExpiresAt);
  // 'booked' is not a lifecycle status; effectiveStatus passes closed states through untouched.
  const status = effectiveStatus(
    { status: storedStatus as ListingStatus, reservedUntil, hardExpiresAt, availabilityExpiresAt },
    now,
  ) as MarketStatus;
  const price = asNumber(data.price);
  const previousPrice = asNumber(data.previousPrice);
  const priceDroppedAt = isoOrNull(data.priceDroppedAt);
  const place = readPlace(data.place);
  const distanceM = placeDistanceM(place, origin);
  const reservedBy = typeof data.reservedBy === 'string' ? data.reservedBy : null;

  return {
    id: snapshot.id,
    serial: asString(data.serial),
    collegeId: asString(data.collegeId),
    collegeCode: asString(data.collegeCode),
    campusId: asString(data.campusId),
    audience: data.audience === 'girls' ? 'girls' : 'campus',
    kind: asString(data.kind, 'item') as MarketListingDoc['kind'],
    category: asString(data.category, 'other') as MarketListingDoc['category'],
    status,
    title: asString(data.title),
    description: asString(data.description),
    price,
    priceTerms: asString(data.priceTerms, 'fixed') as MarketListingDoc['priceTerms'],
    previousPrice,
    priceDroppedAt,
    images: Array.isArray(data.images) ? data.images.filter((item): item is string => typeof item === 'string') : [],
    // Coordinates stay on the server. The rough distance is the viewer's own.
    place: place
      ? { landmarkId: place.landmarkId, label: place.label, area: place.area, campusId: place.campusId, roughDistanceM: distanceM }
      : null,
    genderPref: data.genderPref === 'girls' || data.genderPref === 'boys' ? data.genderPref : 'anyone',
    details: details as unknown as SerializedMarketListing['details'],
    promotionEligible: data.audience !== 'girls' && data.promotionEligible !== false,
    reservedUntil: status === 'reserved' ? reservedUntil : null,
    confirmedAt: isoOrNull(data.confirmedAt),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt ?? data.createdAt),
    availabilityExpiresAt,
    hardExpiresAt,
    seller: { displayName: asString(data.sellerDisplayName) || 'Student', verified: true },
    reservedByViewer: status === 'reserved' && reservedBy !== null && reservedBy === viewerId,
    isSaved: savedIds.has(snapshot.id),
    isOwner: asString(data.authorId) === viewerId,
    distanceM,
    priceDropped: priceDropActive({ price, previousPrice, priceDroppedAt }, now),
  };
}
