import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { effectiveStatus, type ListingStatus } from './listingRules';

export function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIso(value: any): string {
  return toDate(value)?.toISOString() || new Date(0).toISOString();
}

function isoOrNull(value: any): string | null {
  return toDate(value)?.toISOString() ?? null;
}

/**
 * The status a listing has right now (v2 Market and Housing). A lapsed reserve
 * is active again; an active post past its availability needs confirmation;
 * closed states (booked, sold, filled, expired, closed, removed) pass through.
 */
export function liveStatus(data: any, now: Date | number = Date.now()): string {
  const status = typeof data?.status === 'string' ? data.status : 'closed';
  return effectiveStatus(
    {
      status: status as ListingStatus,
      reservedUntil: isoOrNull(data?.reservedUntil),
      hardExpiresAt: isoOrNull(data?.hardExpiresAt),
      availabilityExpiresAt: toIso(data?.availabilityExpiresAt),
    },
    now,
  );
}

/** Live for contact: active, or reserved (an approved contact survives a reserve). */
export function isAvailable(data: any, now: Date | number = Date.now()) {
  const status = liveStatus(data, now);
  return status === 'active' || status === 'reserved';
}

export function serializeMarketplace(
  snapshot: QueryDocumentSnapshot | DocumentSnapshot,
  viewerId: string,
  savedIds: Set<string> = new Set()
) {
  const data = snapshot.data() as any;
  return {
    id: snapshot.id,
    serial: data.serial,
    collegeId: data.collegeId,
    collegeCode: data.collegeCode,
    collegeName: data.collegeName,
    audience: data.audience,
    postType: data.postType,
    category: data.category,
    status: isAvailable(data) ? 'active' : data.status === 'active' ? 'needs_confirmation' : data.status,
    title: data.title,
    description: data.description || '',
    price: typeof data.price === 'number' ? data.price : null,
    negotiable: Boolean(data.negotiable),
    condition: data.condition || null,
    images: Array.isArray(data.images) ? data.images : [],
    pickupPointId: data.pickupPointId || null,
    pickupLabel: data.pickupLabel || null,
    area: data.area || null,
    seller: { displayName: data.sellerDisplayName || 'Student', verified: true as const },
    promotionEligible: data.audience === 'campus' && data.promotionEligible !== false,
    isSaved: savedIds.has(snapshot.id),
    isOwner: data.authorId === viewerId,
    createdAt: toIso(data.createdAt),
    availabilityExpiresAt: toIso(data.availabilityExpiresAt),
  };
}

export function serializeHousing(
  snapshot: QueryDocumentSnapshot | DocumentSnapshot,
  viewerId: string,
  savedIds: Set<string> = new Set()
) {
  const data = snapshot.data() as any;
  return {
    id: snapshot.id,
    serial: data.serial,
    collegeId: data.collegeId,
    collegeCode: data.collegeCode,
    collegeName: data.collegeName,
    audience: data.audience,
    postType: data.postType,
    status: isAvailable(data) ? 'active' : data.status === 'active' ? 'needs_confirmation' : data.status,
    title: data.title,
    description: data.description || '',
    rent: typeof data.rent === 'number' ? data.rent : null,
    deposit: typeof data.deposit === 'number' ? data.deposit : null,
    availableFrom: data.availableFrom || null,
    area: data.area || '',
    commuteLabel: data.commuteLabel || null,
    occupancy: data.occupancy || null,
    furnishing: data.furnishing || null,
    amenities: Array.isArray(data.amenities) ? data.amenities : [],
    images: Array.isArray(data.images) ? data.images : [],
    compatibility: data.compatibility || null,
    poster: { displayName: data.posterDisplayName || 'Student', verified: true as const },
    promotionEligible: data.audience === 'campus' && data.promotionEligible !== false,
    isSaved: savedIds.has(snapshot.id),
    isOwner: data.authorId === viewerId,
    createdAt: toIso(data.createdAt),
    availabilityExpiresAt: toIso(data.availabilityExpiresAt),
  };
}

