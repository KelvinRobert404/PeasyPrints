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
