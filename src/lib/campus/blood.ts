// Blood donor alerts: who can give to whom, which opted-in donors match a
// request, and what each viewer may see. Pure and dependency free so node
// tests can import it. Donor names, groups and numbers never leave the server
// except as counts; a requester sees only the first names of people who tapped
// 'I can help', and a responder sees the requester's WhatsApp only once shared.
import type { BloodDonorDoc, BloodGroup, BloodRequestDoc, BloodRequestStatus, BloodUrgency } from '@/types/utilities';
import { BLOOD_GROUPS } from './constants.ts';

export { BLOOD_GROUPS };

export const UNITS_MIN = 1;
export const UNITS_MAX = 6;
export const HOSPITAL_MIN = 3;
export const HOSPITAL_MAX = 80;
/** A request may ask for blood up to this many days ahead. */
export const NEEDED_BY_MAX_DAYS = 7;
/** Open requests drop off the list this long after their needed-by time. */
export const STALE_AFTER_HOURS = 12;
/** Whole-blood donors rest this long between donations (NBTC minimum). */
export const DONOR_REST_DAYS = 90;
/** Most people who can tap 'I can help' on one request. */
export const MAX_HELPERS = 30;
/** Bumped when the consent wording on the page changes. */
export const CONSENT_VERSION = 1;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function isBloodGroup(value: unknown): value is BloodGroup {
  return typeof value === 'string' && (BLOOD_GROUPS as readonly string[]).includes(value);
}

/* Compatibility --------------------------------------------------------- */

/** Red cell antigens a group carries: A, B and RhD. */
function antigens(group: BloodGroup): { a: boolean; b: boolean; rh: boolean } {
  const letters = group.slice(0, -1);
  return { a: letters.includes('A'), b: letters.includes('B'), rh: group.endsWith('+') };
}

/**
 * Whether red cells from `donor` are safe for `recipient`: the donor may not
 * carry an antigen the recipient lacks. O- gives to all, AB+ takes from all.
 */
export function canDonateTo(donor: BloodGroup, recipient: BloodGroup): boolean {
  const from = antigens(donor);
  const to = antigens(recipient);
  return (!from.a || to.a) && (!from.b || to.b) && (!from.rh || to.rh);
}

/** Groups whose donors can give to `recipient`, exact match first. */
export function donorGroupsFor(recipient: BloodGroup): BloodGroup[] {
  const groups = BLOOD_GROUPS.filter((group) => canDonateTo(group, recipient));
  return [recipient, ...groups.filter((group) => group !== recipient)];
}

/* Matching --------------------------------------------------------------- */

export type Instant = Date | string | number;

/** A donor as the matcher needs it. Extra fields pass through untouched. */
export interface MatchableDonor {
  userId: string;
  bloodGroup: BloodGroup;
  /** False when the donor paused alerts. Missing means available. */
  available?: boolean | null;
  lastDonatedAt?: Instant | null;
}

export interface MatchOptions {
  now?: Instant;
  /** Usually the requester, who is never alerted for their own request. */
  excludeUserId?: string | null;
  /** Days a donor rests after donating. Defaults to DONOR_REST_DAYS. */
  restDays?: number;
}

function toMs(value: Instant | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Opted-in donors who can give to `group`: available, not resting after a
 * recent donation, not excluded, one entry per user. Exact group first, then
 * the other compatible groups in donorGroupsFor order.
 */
export function matchDonors<T extends MatchableDonor>(donors: readonly T[], group: BloodGroup, options: MatchOptions = {}): T[] {
  const now = toMs(options.now ?? Date.now()) ?? Date.now();
  const restMs = (options.restDays ?? DONOR_REST_DAYS) * DAY_MS;
  const order = donorGroupsFor(group);
  const seen = new Set<string>();
  const matched: T[] = [];
  for (const donor of donors) {
    if (!donor.userId || seen.has(donor.userId)) continue;
    if (donor.userId === options.excludeUserId) continue;
    if (!isBloodGroup(donor.bloodGroup) || !canDonateTo(donor.bloodGroup, group)) continue;
    if (donor.available === false) continue;
    const last = toMs(donor.lastDonatedAt);
    if (last !== null && now - last < restMs) continue;
    seen.add(donor.userId);
    matched.push(donor);
  }
  return matched.sort((left, right) => order.indexOf(left.bloodGroup) - order.indexOf(right.bloodGroup));
}

/** Available donors per group. Counts only; never who. */
export function countByGroup(donors: readonly Pick<MatchableDonor, 'bloodGroup' | 'available'>[]): Record<BloodGroup, number> {
  const counts = Object.fromEntries(BLOOD_GROUPS.map((group) => [group, 0])) as Record<BloodGroup, number>;
  for (const donor of donors) {
    if (donor.available === false || !isBloodGroup(donor.bloodGroup)) continue;
    counts[donor.bloodGroup] += 1;
  }
  return counts;
}

/* Request input ---------------------------------------------------------- */

/** How soon, from the needed-by time: under 6 h is now, under 24 h today. */
export function urgencyFor(neededBy: Instant, now: Instant = Date.now()): BloodUrgency {
  const left = (toMs(neededBy) ?? 0) - (toMs(now) ?? Date.now());
  if (left < 6 * HOUR_MS) return 'now';
  if (left < DAY_MS) return 'today';
  return 'this_week';
}

export const URGENCY_LABELS: Record<BloodUrgency, string> = {
  now: 'Needed now',
  today: 'Needed today',
  this_week: 'This week',
};

/** Null when the needed-by time is fine, else a short reason. */
export function neededByError(neededBy: Instant, now: Instant = Date.now()): string | null {
  const at = toMs(neededBy);
  const current = toMs(now) ?? Date.now();
  if (at === null) return 'Pick when it is needed';
  if (at < current - 15 * 60 * 1000) return 'Pick a time from now on';
  if (at > current + NEEDED_BY_MAX_DAYS * DAY_MS) return 'Pick a time within a week';
  return null;
}

/** First word of a display name, at most 20 characters. */
export function firstName(displayName: string | null | undefined): string {
  const first = (displayName ?? '').trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 20) || 'Student';
}

export type WhatsappResult = { ok: true; value: string } | { ok: false; error: string };

/** A 10-digit Indian mobile number, with +91, 91 or 0 and spaces stripped. */
export function normalizeWhatsapp(input: string): WhatsappResult {
  let digits = input.replace(/[\s()-]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return { ok: false, error: 'Use digits only' };
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return { ok: false, error: 'Use a 10-digit mobile number' };
  return { ok: true, value: digits };
}

export function whatsappHref(number: string, text?: string): string {
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/91${number}${query}`;
}

/* Stored shapes ---------------------------------------------------------- */

/** Someone who tapped 'I can help', stored on the request keyed by a random id. */
export interface BloodHelperRecord {
  userId: string;
  firstName: string;
  createdAt: unknown;
  /** The requester's WhatsApp, once the requester chose to share it with this helper. */
  sharedWhatsapp: string | null;
  sharedAt: unknown;
}

/** Stored fields this package adds to BloodRequestDoc. */
export interface BloodRequestExtras {
  collegeId?: string | null;
  helpers?: Record<string, BloodHelperRecord> | null;
  /** Matching donors alerted when the request was posted. */
  notifiedCount?: number | null;
}

export type BloodRequestRecord = BloodRequestDoc & BloodRequestExtras;

/** Stored fields this package adds to BloodDonorDoc. Doc id is the user id. */
export interface BloodDonorExtras {
  collegeId?: string | null;
  consentVersion?: number | null;
  consentAt?: unknown;
}

export type BloodDonorRecord = BloodDonorDoc & BloodDonorExtras;

/* Views ------------------------------------------------------------------ */

/** A helper as the requester sees them: a first name, never an id or number. */
export interface BloodHelperView {
  key: string;
  firstName: string;
  shared: boolean;
}

export interface BloodRequestView {
  id: string;
  bloodGroup: BloodGroup;
  units: number;
  urgency: BloodUrgency;
  status: BloodRequestStatus;
  hospital: string;
  neededBy: string | null;
  createdAt: string | null;
  posterFirstName: string;
  isOwner: boolean;
  /** How many people tapped 'I can help'. Shown to the requester only; 0 for others. */
  helperCount: number;
  /** Requester only. */
  helpers: BloodHelperView[];
  /** The viewer tapped 'I can help'. */
  iCanHelp: boolean;
  /** The requester's WhatsApp, if they shared it with this viewer. */
  sharedWhatsapp: string | null;
  /** The viewer's own donor group can give to this request. */
  canDonate: boolean;
}

export interface BloodMeView {
  optedIn: boolean;
  bloodGroup: BloodGroup | null;
  available: boolean;
}

/** ISO string of a stored time (Timestamp, Date, string or millis), else null. */
export function isoOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate(): Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
    const ms = toMs(value);
    return ms === null ? null : new Date(ms).toISOString();
  }
  return null;
}

/** The helper entry a user left on a request, with its key, else null. */
export function helperOf(record: Pick<BloodRequestExtras, 'helpers'>, userId: string): { key: string; helper: BloodHelperRecord } | null {
  for (const [key, helper] of Object.entries(record.helpers ?? {})) {
    if (helper?.userId === userId) return { key, helper };
  }
  return null;
}

/**
 * What one viewer sees of a request. Only the requester gets the helper count
 * and first names; a helper sees the WhatsApp only if it was shared with them.
 */
export function viewRequest(record: BloodRequestRecord & { id: string }, viewerId: string, viewerGroup: BloodGroup | null = null): BloodRequestView {
  const isOwner = record.authorId === viewerId;
  const entries = Object.entries(record.helpers ?? {}).filter(([, helper]) => helper && typeof helper.userId === 'string');
  const mine = isOwner ? null : helperOf(record, viewerId);
  return {
    id: record.id,
    bloodGroup: record.bloodGroup,
    units: record.units,
    urgency: record.urgency,
    status: record.status,
    hospital: record.hospital,
    neededBy: isoOf(record.neededBy),
    createdAt: isoOf(record.createdAt),
    posterFirstName: firstName(record.posterDisplayName),
    isOwner,
    helperCount: isOwner ? entries.length : 0,
    helpers: isOwner
      ? entries
          .sort(([, left], [, right]) => (isoOf(left.createdAt) ?? '').localeCompare(isoOf(right.createdAt) ?? ''))
          .map(([key, helper]) => ({ key, firstName: firstName(helper.firstName), shared: Boolean(helper.sharedWhatsapp) }))
      : [],
    iCanHelp: Boolean(mine),
    sharedWhatsapp: mine?.helper.sharedWhatsapp ?? null,
    canDonate: Boolean(viewerGroup && canDonateTo(viewerGroup, record.bloodGroup)),
  };
}

/** Open and not long past its needed-by time. */
export function isListed(record: Pick<BloodRequestDoc, 'status' | 'neededBy'>, now: Instant = Date.now()): boolean {
  if (record.status !== 'open') return false;
  const neededBy = isoOf(record.neededBy);
  if (!neededBy) return true;
  return Date.parse(neededBy) + STALE_AFTER_HOURS * HOUR_MS > (toMs(now) ?? Date.now());
}

/** Soonest needed first, then newest. */
export function sortRequests<T extends Pick<BloodRequestView, 'neededBy' | 'createdAt'>>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const byNeed = (left.neededBy ?? '9999').localeCompare(right.neededBy ?? '9999');
    return byNeed || (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
  });
}

/** Alert copy for matching donors. Title stays under 10 words. */
export function alertCopy(request: Pick<BloodRequestDoc, 'bloodGroup' | 'units' | 'hospital' | 'urgency'>): { title: string; body: string } {
  const when = request.urgency === 'now' ? 'now' : request.urgency === 'today' ? 'today' : 'this week';
  const units = request.units === 1 ? '1 unit' : `${request.units} units`;
  return {
    title: `${request.bloodGroup} blood needed ${when}`,
    body: `${units} at ${request.hospital}. Tap if you can help.`,
  };
}
