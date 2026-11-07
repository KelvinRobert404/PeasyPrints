// Listing lifecycle rules: effective status, reservations, expiry, the one-time
// "still available?" nudge, price drops, duplicate titles, number plates and
// document validity. Pure and dependency free so node tests can import it.
// Timestamps are ISO strings (or Date / epoch ms); date-only values are IST days.

export type Instant = Date | string | number;

export type ListingStatus =
  | 'active'
  | 'reserved'
  | 'needs_confirmation'
  | 'expired'
  | 'sold'
  | 'filled'
  | 'closed'
  | 'removed';

export interface LifecycleFields {
  status: ListingStatus;
  reservedUntil?: string | null;
  hardExpiresAt?: string | null;
  availabilityExpiresAt?: string | null;
}

/** Listing kinds with a natural end. Any other kind uses `availableUntil`. */
export type ExpiryKind = 'ride' | 'ticket' | 'pass' | 'coupon' | (string & {});

export interface ExpiryDetails {
  departure?: string | null;
  showtime?: string | null;
  availableUntil?: string | null;
  validUntil?: string | null;
}

export interface ListingExpiry {
  hardExpiresAt: string | null;
  availabilityExpiresAt: string;
}

export type PlateState =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'valid'; normalized: string; formatted: string; region: string };

export type DocumentValidity = 'valid' | 'expiring' | 'expired';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const RESERVE_MS = 24 * HOUR_MS;
export const AVAILABILITY_MS = 7 * DAY_MS;
export const STILL_AVAILABLE_NUDGE_MS = 72 * HOUR_MS;
export const PRICE_DROP_BADGE_MS = 7 * DAY_MS;
export const DOCUMENT_EXPIRING_MS = 30 * DAY_MS;

const OPEN_STATUSES: ReadonlySet<ListingStatus> = new Set(['active', 'reserved', 'needs_confirmation']);

function toMs(value: Instant): number {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : parseInstant(value);
  if (!Number.isFinite(ms)) throw new RangeError('Invalid date');
  return ms;
}

/** Date-only 'YYYY-MM-DD' means the end of that IST day; anything else goes to Date.parse. */
function parseInstant(value: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const start = Date.parse(`${value}T00:00:00.000+05:30`);
    return Number.isFinite(start) ? start + DAY_MS - 1 : Number.NaN;
  }
  return Date.parse(value);
}

/** Optional timestamp: missing or unreadable values are null. */
function optionalMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = parseInstant(value);
  return Number.isFinite(ms) ? ms : null;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * The status a viewer should see right now. Stored status can lag behind time:
 * open listings past hardExpiresAt are expired; a lapsed reservation is active
 * again; an active listing past availabilityExpiresAt needs confirmation.
 */
export function effectiveStatus(listing: LifecycleFields, now: Instant): ListingStatus {
  const at = toMs(now);
  if (!OPEN_STATUSES.has(listing.status)) return listing.status;
  const hard = optionalMs(listing.hardExpiresAt);
  if (hard !== null && at >= hard) return 'expired';
  let status = listing.status;
  if (status === 'reserved') {
    const until = optionalMs(listing.reservedUntil);
    if (until !== null && at < until) return 'reserved';
    status = 'active';
  }
  if (status === 'active') {
    const availability = optionalMs(listing.availabilityExpiresAt);
    if (availability !== null && at >= availability) return 'needs_confirmation';
  }
  return status;
}

/** A reservation holds for 24 hours. */
export function reserveUntil(now: Instant): string {
  return iso(toMs(now) + RESERVE_MS);
}

function hardExpiryField(kind: ExpiryKind): keyof ExpiryDetails {
  if (kind === 'ride') return 'departure';
  if (kind === 'ticket') return 'showtime';
  if (kind === 'pass' || kind === 'coupon') return 'validUntil';
  return 'availableUntil';
}

/**
 * Hard expiry comes from the kind's natural end (ride departure, ticket showtime,
 * pass validUntil, else availableUntil). Availability lasts 7 days, never past the hard expiry.
 */
export function computeExpiry(kind: ExpiryKind, details: ExpiryDetails, now: Instant): ListingExpiry {
  const at = toMs(now);
  const hard = optionalMs(details[hardExpiryField(kind)]);
  const availability = hard === null ? at + AVAILABILITY_MS : Math.min(at + AVAILABILITY_MS, hard);
  return { hardExpiresAt: hard === null ? null : iso(hard), availabilityExpiresAt: iso(availability) };
}

export interface NudgeFields extends LifecycleFields {
  createdAt: string;
  lastConfirmedAt?: string | null;
  stillAvailableNudgedAt?: string | null;
}

/** "Still available?" goes once, 72 h after posting (or the last confirmation), to active listings only. */
export function stillAvailableDue(listing: NudgeFields, now: Instant): boolean {
  if (listing.stillAvailableNudgedAt) return false;
  if (effectiveStatus(listing, now) !== 'active') return false;
  const since = optionalMs(listing.lastConfirmedAt) ?? optionalMs(listing.createdAt);
  if (since === null) return false;
  return toMs(now) - since >= STILL_AVAILABLE_NUDGE_MS;
}

/** Price can only go down, stay a whole positive rupee amount, and only on open listings. */
export function canLowerPrice(listing: { status: ListingStatus; price: number | null }, nextPrice: number): boolean {
  if (!OPEN_STATUSES.has(listing.status)) return false;
  if (listing.price === null || !Number.isFinite(listing.price) || listing.price <= 0) return false;
  return Number.isInteger(nextPrice) && nextPrice > 0 && nextPrice < listing.price;
}

/** The price-drop badge shows for 7 days after a real drop. */
export function priceDropActive(
  listing: { price: number | null; previousPrice?: number | null; priceDroppedAt?: string | null },
  now: Instant,
): boolean {
  const dropped = optionalMs(listing.priceDroppedAt);
  if (dropped === null || listing.price === null || listing.previousPrice == null) return false;
  if (listing.price >= listing.previousPrice) return false;
  const elapsed = toMs(now) - dropped;
  return elapsed >= 0 && elapsed < PRICE_DROP_BADGE_MS;
}

export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** True when the title matches one of the poster's other titles, ignoring case, spacing and punctuation. */
export function isDuplicateTitle(title: string, existingTitles: readonly string[]): boolean {
  const normalized = normalizeTitle(title);
  if (!normalized) return false;
  return existingTitles.some((existing) => normalizeTitle(existing) === normalized);
}

const STANDARD_PLATE = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
const BHARAT_PLATE = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/;

/** Reads an Indian number plate, e.g. 'ka-01 ab 1234' -> KA 01 AB 1234, or a BH series plate. */
export function plateState(input: string | null | undefined): PlateState {
  const normalized = (input ?? '').toUpperCase().replace(/[\s.\-]/g, '');
  if (!normalized) return { status: 'empty' };
  const standard = STANDARD_PLATE.exec(normalized);
  if (standard) {
    const [, region, rto, series, number] = standard;
    if (Number(rto) === 0 || Number(number) === 0) return { status: 'invalid' };
    const formatted = [region, rto, series, number].filter(Boolean).join(' ');
    return { status: 'valid', normalized, formatted, region };
  }
  const bharat = BHARAT_PLATE.exec(normalized);
  if (bharat) {
    const [, year, number, series] = bharat;
    if (Number(number) === 0) return { status: 'invalid' };
    return { status: 'valid', normalized, formatted: `${year} BH ${number} ${series}`, region: 'BH' };
  }
  return { status: 'invalid' };
}

/** Document (licence, RC, insurance, pass) validity: expired, expiring within 30 days, or valid. */
export function documentValidity(expiresOn: Instant, now: Instant): DocumentValidity {
  const left = toMs(expiresOn) - toMs(now);
  if (left < 0) return 'expired';
  if (left < DOCUMENT_EXPIRING_MS) return 'expiring';
  return 'valid';
}
