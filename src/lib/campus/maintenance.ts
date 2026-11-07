// Hourly maintenance planner: works out which stored docs have fallen behind
// time and what to write. Reserves that lapsed go live again (the seller is
// told), tickets, seats and cab splits past their end expire, open posts past
// their availability need confirmation, the day-3 'Still available?' nudge goes
// once per confirmation, games end 2 h after start, lost and found posts close
// after 30 days, blood requests close past neededBy, and delivered inbox items
// are deleted after 30 days. Pure: the maintenance route loads the docs and
// applies the plan. Runtime imports are relative with the .ts extension so node
// tests can load it.

import type { NotificationKind, NotificationRef } from '@/types/notifications';
import { effectiveStatus, stillAvailableDue, type ListingStatus } from './listingRules.ts';
import { GAME_LENGTH_MS } from './games.ts';

/** Collections the planner reads, named by their CAMPUS_COLLECTIONS key. */
export type MaintenanceCollection = 'market' | 'housing' | 'games' | 'lostFound' | 'bloodRequests' | 'notifications';

/** A stored doc: its id and raw data (Timestamps, Dates, ISO strings or epoch ms). */
export interface MaintenanceDoc {
  id: string;
  data: Record<string, unknown>;
}

export type MaintenanceDocs = Partial<Record<MaintenanceCollection, readonly MaintenanceDoc[]>>;

/** Fields to merge into one doc. Times are Dates; the route writes them as Timestamps. */
export interface PlannedUpdate {
  collection: MaintenanceCollection;
  id: string;
  data: Record<string, unknown>;
}

export interface PlannedDelete {
  collection: MaintenanceCollection;
  id: string;
}

/** One inbox item to enqueue through notify.ts. */
export interface PlannedNotification {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  ref: NotificationRef;
  campusId: string | null;
}

export interface MaintenanceCounts {
  reservesReleased: number;
  listingsExpired: number;
  needsConfirmation: number;
  nudgesSent: number;
  gamesDone: number;
  lostFoundClosed: number;
  bloodRequestsClosed: number;
  notificationsDeleted: number;
}

export interface MaintenancePlan {
  updates: PlannedUpdate[];
  deletes: PlannedDelete[];
  notifications: PlannedNotification[];
  counts: MaintenanceCounts;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Open lost and found posts close after this long. */
export const LOST_FOUND_OPEN_MS = 30 * DAY_MS;
/** Delivered inbox items are deleted this long after delivery. */
export const NOTIFICATION_KEEP_MS = 30 * DAY_MS;

export const RESERVE_LAPSED_TITLE = 'Your reserve ended';
export const RESERVE_LAPSED_BODY = 'The post is open to others again.';
export const NUDGE_TITLE = 'Still available? Tap to confirm';
export const NUDGE_BODY = 'Confirm to keep it live 7 more days.';

const OPEN_LISTING: ReadonlySet<string> = new Set(['active', 'reserved', 'needs_confirmation']);
const OPEN_GAME: ReadonlySet<string> = new Set(['open', 'full']);

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value && typeof value === 'object' ? (value as Raw) : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/** Timestamp, Date, ISO string or epoch ms -> epoch ms, else null. */
export function timeMs(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  let ms: number;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'number') ms = value;
  else if (typeof value === 'string') ms = Date.parse(value);
  else if (typeof (value as { toMillis?: unknown }).toMillis === 'function') ms = (value as { toMillis(): number }).toMillis();
  else if (typeof (value as { toDate?: unknown }).toDate === 'function') ms = (value as { toDate(): Date }).toDate().getTime();
  else return null;
  return Number.isFinite(ms) ? ms : null;
}

function isoOf(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

/** A market kind's natural end from its details, for docs stored without hardExpiresAt. */
function endFromDetails(details: Raw): number | null {
  switch (details.kind) {
    case 'seat':
      return timeMs(details.endsAt) ?? timeMs(details.startsAt);
    case 'cab_split':
      return timeMs(details.leavesAt);
    case 'ticket':
      return timeMs(details.happensAt);
    case 'pass':
      return timeMs(details.validUntil);
    default:
      return null;
  }
}

interface Lifecycle {
  status: ListingStatus;
  reservedUntil: string | null;
  hardExpiresAt: string | null;
  availabilityExpiresAt: string | null;
}

/** The lifecycle fields listingRules reads, from a stored market or housing doc. */
function lifecycleOf(collection: 'market' | 'housing', data: Raw): Lifecycle {
  const details = asRecord(data.details);
  const hard = timeMs(data.hardExpiresAt) ?? (collection === 'market' ? endFromDetails(details) : null);
  let availability = timeMs(data.availabilityExpiresAt);
  // A bundle's own 'available until' day can end it sooner than the 7-day window.
  const bundleUntil = collection === 'market' && details.kind === 'bundle' ? timeMs(details.availableUntil ?? data.availableUntil) : null;
  if (bundleUntil !== null) availability = availability === null ? bundleUntil : Math.min(availability, bundleUntil);
  return {
    status: String(data.status ?? '') as ListingStatus,
    reservedUntil: isoOf(timeMs(data.reservedUntil)),
    hardExpiresAt: isoOf(hard),
    availabilityExpiresAt: isoOf(availability),
  };
}

/** Live for contact after maintenance: active, or reserved (an approved contact survives a reserve). */
export function contactOpen(collection: 'market' | 'housing', data: Raw, now: Date | number): boolean {
  const lifecycle = lifecycleOf(collection, data);
  if (!OPEN_LISTING.has(lifecycle.status)) return false;
  const status = effectiveStatus(lifecycle, now);
  return status === 'active' || status === 'reserved';
}

function listingHref(collection: 'market' | 'housing', id: string, data: Raw): string {
  const girls = data.audience === 'girls';
  const section = collection === 'market' ? 'marketplace' : 'housing';
  return `${girls ? '/girls-space' : ''}/${section}/${encodeURIComponent(id)}`;
}

function emptyCounts(): MaintenanceCounts {
  return {
    reservesReleased: 0,
    listingsExpired: 0,
    needsConfirmation: 0,
    nudgesSent: 0,
    gamesDone: 0,
    lostFoundClosed: 0,
    bloodRequestsClosed: 0,
    notificationsDeleted: 0,
  };
}

function planListing(collection: 'market' | 'housing', doc: MaintenanceDoc, now: Date, plan: MaintenancePlan): void {
  const data = doc.data;
  const lifecycle = lifecycleOf(collection, data);
  const stored = lifecycle.status;
  if (!OPEN_LISTING.has(stored)) return;
  const next = effectiveStatus(lifecycle, now);
  const ownerId = asString(data.authorId);
  const ref: NotificationRef = { type: collection === 'market' ? 'market_listing' : 'housing_listing', id: doc.id };
  const notice = (kind: NotificationKind, title: string, body: string) => {
    if (!ownerId) return;
    plan.notifications.push({
      userId: ownerId,
      kind,
      title,
      body,
      href: listingHref(collection, doc.id, data),
      ref,
      campusId: asString(data.campusId),
    });
  };
  const patch: Raw = {};

  if (next !== stored) patch.status = next;
  if (next === 'expired') plan.counts.listingsExpired += 1;
  else if (next === 'needs_confirmation' && stored !== 'needs_confirmation') plan.counts.needsConfirmation += 1;

  const reserveLapsed = stored === 'reserved' && next !== 'reserved';
  if (reserveLapsed) {
    plan.counts.reservesReleased += 1;
    patch.reservedUntil = null;
    if (collection === 'market') patch.reservedBy = null;
    // An ended post needs no 'open again' notice.
    if (next !== 'expired') notice('reserve_lapsed', RESERVE_LAPSED_TITLE, RESERVE_LAPSED_BODY);
  }

  // One notice per post per run: a lapsed reserve waits for the next run's nudge.
  const nudgeField = collection === 'market' ? 'nudgeSentAt' : 'stillAvailableNudgedAt';
  const createdAt = isoOf(timeMs(data.createdAt));
  if (!reserveLapsed && next === 'active' && createdAt) {
    const due = stillAvailableDue(
      {
        ...lifecycle,
        status: next,
        createdAt,
        lastConfirmedAt: isoOf(timeMs(data.confirmedAt)),
        // Any stored value means the nudge already went for this confirmation.
        stillAvailableNudgedAt: data[nudgeField] ? 'sent' : null,
      },
      now,
    );
    if (due) {
      plan.counts.nudgesSent += 1;
      patch[nudgeField] = now;
      notice('listing_nudge', NUDGE_TITLE, NUDGE_BODY);
    }
  }

  if (Object.keys(patch).length) plan.updates.push({ collection, id: doc.id, data: { ...patch, updatedAt: now } });
}

function planGame(doc: MaintenanceDoc, now: Date, plan: MaintenancePlan): void {
  const status = String(doc.data.status ?? '');
  const startsAt = timeMs(doc.data.startsAt);
  if (!OPEN_GAME.has(status) || startsAt === null) return;
  if (now.getTime() < startsAt + GAME_LENGTH_MS) return;
  plan.counts.gamesDone += 1;
  plan.updates.push({ collection: 'games', id: doc.id, data: { status: 'done', updatedAt: now } });
}

function planLostFound(doc: MaintenanceDoc, now: Date, plan: MaintenancePlan): void {
  const createdAt = timeMs(doc.data.createdAt);
  if (doc.data.status !== 'open' || createdAt === null) return;
  if (now.getTime() - createdAt < LOST_FOUND_OPEN_MS) return;
  plan.counts.lostFoundClosed += 1;
  plan.updates.push({ collection: 'lostFound', id: doc.id, data: { status: 'closed', updatedAt: now } });
}

function planBloodRequest(doc: MaintenanceDoc, now: Date, plan: MaintenancePlan): void {
  const neededBy = timeMs(doc.data.neededBy);
  if (doc.data.status !== 'open' || neededBy === null) return;
  if (now.getTime() < neededBy) return;
  plan.counts.bloodRequestsClosed += 1;
  plan.updates.push({ collection: 'bloodRequests', id: doc.id, data: { status: 'closed', updatedAt: now } });
}

function planNotification(doc: MaintenanceDoc, now: Date, plan: MaintenancePlan): void {
  // Delivered at deliverAfter; older items without it count from createdAt.
  const deliveredAt = timeMs(doc.data.deliverAfter) ?? timeMs(doc.data.createdAt);
  if (deliveredAt === null || deliveredAt > now.getTime()) return;
  if (now.getTime() - deliveredAt < NOTIFICATION_KEEP_MS) return;
  plan.counts.notificationsDeleted += 1;
  plan.deletes.push({ collection: 'notifications', id: doc.id });
}

/** What maintenance should write at `now`. Docs that are already up to date produce nothing. */
export function planMaintenance(docs: MaintenanceDocs, now: Date | number): MaintenancePlan {
  const at = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(at.getTime())) throw new RangeError('Invalid date');
  const plan: MaintenancePlan = { updates: [], deletes: [], notifications: [], counts: emptyCounts() };
  for (const doc of docs.market ?? []) planListing('market', doc, at, plan);
  for (const doc of docs.housing ?? []) planListing('housing', doc, at, plan);
  for (const doc of docs.games ?? []) planGame(doc, at, plan);
  for (const doc of docs.lostFound ?? []) planLostFound(doc, at, plan);
  for (const doc of docs.bloodRequests ?? []) planBloodRequest(doc, at, plan);
  for (const doc of docs.notifications ?? []) planNotification(doc, at, plan);
  return plan;
}
