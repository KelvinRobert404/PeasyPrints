// Student deals (KADA-18, J5): free for verified students, never paid.
// Pure module: node tests import it, so '@/...' is type-only and runtime imports are relative.
import type { Deal, DealStatus } from '@/types/utilities';
import { haversineMeters, roundForPrivacy, type LatLng } from '../format/distance.ts';

/** A deal as the deals API sends it: no coordinates, a rough distance, a sample flag. */
export type StudentDeal = Deal & {
  /** Rough metres from the viewer's campus, rounded for privacy. Null when unknown. */
  distanceM: number | null;
  /** Seeded example. The UI must never present it as a real offer. */
  sample: boolean;
};

/** GET /api/campus/student-deals payload. */
export interface StudentDealsPayload {
  deals: StudentDeal[];
  campus: { id: string; code: string; label: string } | null;
}

/** A time as stored (DocTime), sent (ISO string) or built in code (Date). */
export type DealTime = { toMillis(): number } | Date | string | null | undefined;

/** The fields liveness needs. Works on stored docs and API rows. */
export interface DealLiveFields {
  status: DealStatus | string;
  validUntil?: DealTime;
}

/** The fields distance needs. lat/lng are server side only. */
export interface DealPlaceFields {
  place?: {
    lat?: number | null;
    lng?: number | null;
    roughDistanceM?: number | null;
  } | null;
}

/** Milliseconds of a stored, sent or built time; null when missing or unreadable. */
export function dealTimeMillis(value: DealTime): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * True when students should see the deal: active and not past its end.
 * No end date means it runs until an admin ends it. Unreadable end dates hide the deal.
 */
export function isDealLive(deal: DealLiveFields, now: Date | number): boolean {
  if (deal.status !== 'active') return false;
  if (deal.validUntil === null || deal.validUntil === undefined) return true;
  const end = dealTimeMillis(deal.validUntil);
  if (end === null) return false;
  const at = typeof now === 'number' ? now : now.getTime();
  return end > at;
}

/**
 * Metres from origin to the deal. Exact from coordinates when both exist,
 * else the stored rough distance, else null.
 */
export function dealDistanceMeters(deal: DealPlaceFields, origin: LatLng | null | undefined): number | null {
  const place = deal.place;
  if (!place) return null;
  if (origin && typeof place.lat === 'number' && typeof place.lng === 'number' && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    return haversineMeters(origin, { lat: place.lat, lng: place.lng });
  }
  const rough = place.roughDistanceM;
  return typeof rough === 'number' && Number.isFinite(rough) && rough >= 0 ? rough : null;
}

/**
 * Nearest first. Deals without a distance go last. Ties keep their input order (stable).
 * Returns a new array; the input is not changed.
 */
export function sortByDistance<T extends DealPlaceFields>(deals: readonly T[], origin: LatLng | null | undefined): T[] {
  return deals
    .map((deal, index) => ({ deal, index, distance: dealDistanceMeters(deal, origin) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map((item) => item.deal);
}

/** The rough distance students see, rounded so a shop pin is not exact. */
export function publicDealDistance(deal: DealPlaceFields, origin: LatLng | null | undefined): number | null {
  const meters = dealDistanceMeters(deal, origin);
  return meters === null ? null : roundForPrivacy(meters);
}

/* Copy helpers. IST, built by hand so server and client always agree. */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function istParts(ms: number) {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    weekday: DAYS[d.getUTCDay()],
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
  };
}

/**
 * The deal's end shown to students, in IST. A deal ends at its validUntil instant,
 * so the label shows the last moment it still works: 'Valid till 30 Nov'.
 */
export function validTillLabel(validUntil: DealTime): string {
  const end = dealTimeMillis(validUntil);
  if (end === null) return 'No end date';
  const { day, month } = istParts(end - 1);
  return `Valid till ${day} ${month}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Live counter clock in IST: '4:05:09 pm'. */
export function counterClock(now: Date | number): string {
  const ms = typeof now === 'number' ? now : now.getTime();
  const { hours, minutes, seconds } = istParts(ms);
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${pad(minutes)}:${pad(seconds)} ${hours < 12 ? 'am' : 'pm'}`;
}

/** Counter date in IST: 'Sat 7 Nov'. */
export function counterDate(now: Date | number): string {
  const ms = typeof now === 'number' ? now : now.getTime();
  const { weekday, day, month } = istParts(ms);
  return `${weekday} ${day} ${month}`;
}

/** First word of a display name, else 'Student'. */
export function firstName(displayName: string | null | undefined): string {
  const first = (displayName ?? '').trim().split(/\s+/)[0];
  return first ? first.slice(0, 24) : 'Student';
}
