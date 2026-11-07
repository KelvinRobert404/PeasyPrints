// Seller actions on a market post (the [id] PATCH): still available, sold,
// booked, reserve, unreserve, lower price, bundle part sold, seats left, close
// and promotion. Owner only. Saves and reports live in app/api/campus/actions.
// Runtime imports are relative with the .ts extension so node tests can load
// it; the saver fan-out is injected (or loaded lazily) because notify.ts needs
// Firebase Admin.

import type { CampusPrincipal } from '@/lib/campus/auth';
import type { notifySavers as NotifySavers } from '@/lib/campus/notify';
import type { MarketKind, MarketStatus } from '@/types/market';
import { AVAILABILITY_MS, RESERVE_MS } from './listingRules.ts';
import { marketPatchSchema, type MarketPatch } from './marketSchema.ts';
import { serializeMarketListing } from './marketSerialize.ts';
import { formatPrice } from '../format/price.ts';

/** An action the request may not take. `status` is the HTTP status to send. */
export class MarketActionError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'MarketActionError';
    this.status = status;
  }
}

/** Structural doc reference, so the Admin SDK, the fixture DB and tests all fit. */
export interface MarketActionRef {
  id: string;
  update(data: Record<string, unknown>): Promise<unknown>;
}

export interface MarketActionOptions {
  now?: Date;
  /** Saver fan-out. Defaults to notifySavers from notify.ts. */
  notifySavers?: typeof NotifySavers;
}

export interface MarketActionResult {
  action: MarketPatch['action'];
  /** Stored status after the action. */
  status: MarketStatus;
  /** Fields written, or null when nothing changed (a repeat tap). */
  update: Record<string, unknown> | null;
  /** Savers told about a price drop. */
  notified: number;
}

export const PRICE_DROP_TITLE = 'Price dropped on something you saved';

/** Kinds that end as sold, and kinds that end as booked. Wanted posts only close. */
const SOLD_KINDS: ReadonlySet<MarketKind> = new Set(['item', 'bundle', 'ticket', 'pass', 'vehicle']);
const BOOKED_KINDS: ReadonlySet<MarketKind> = new Set(['seat', 'cab_split']);
const MAX_SEATS: Partial<Record<MarketKind, number>> = { seat: 10, cab_split: 6 };

/** Still live: a seller can change these. */
const OPEN: ReadonlySet<MarketStatus> = new Set(['active', 'reserved', 'needs_confirmation']);
/** Done for good. Only a repeat of the same action is accepted. */
const FINISHED: ReadonlySet<MarketStatus> = new Set(['sold', 'booked', 'filled']);

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value && typeof value === 'object' ? (value as Raw) : {};
}

function parseAction(action: unknown): MarketPatch {
  const parsed = marketPatchSchema.safeParse(action);
  if (!parsed.success) throw new MarketActionError(400, parsed.error.issues[0]?.message || 'Unsupported action');
  return parsed.data;
}

function requireOpen(status: MarketStatus, message = 'This post is no longer live'): void {
  if (!OPEN.has(status)) throw new MarketActionError(409, message);
}

async function loadNotifySavers(options: MarketActionOptions): Promise<typeof NotifySavers> {
  if (options.notifySavers) return options.notifySavers;
  const notify = await import('./notify.ts');
  return notify.notifySavers;
}

/**
 * Applies one seller action to a market post and writes it. `doc` is the
 * stored post (already read by the caller). Throws MarketActionError with
 * 400 (bad input or wrong kind), 403 (not the owner) or 409 (wrong state).
 */
export async function applyMarketAction(
  ref: MarketActionRef,
  doc: unknown,
  action: unknown,
  principal: Pick<CampusPrincipal, 'userId'>,
  options: MarketActionOptions = {},
): Promise<MarketActionResult> {
  const data = asRecord(doc);
  if (typeof data.authorId !== 'string' || data.authorId !== principal.userId) {
    throw new MarketActionError(403, 'Only the seller can update this post');
  }
  if (data.status === 'removed') throw new MarketActionError(409, 'This post was removed by moderators');

  const patch = parseAction(action);
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  // Effective status and natural end, the same way viewers see them.
  const listing = serializeMarketListing({ id: ref.id, data: () => data }, principal.userId, undefined, null, now);
  const status = listing.status;
  const kind = listing.kind;
  const stored = String(data.status ?? '') as MarketStatus;

  let update: Record<string, unknown> | null = null;
  let next: MarketStatus = stored;
  let notified = 0;

  switch (patch.action) {
    case 'still_available': {
      requireOpen(status);
      const hard = listing.hardExpiresAt ? Date.parse(listing.hardExpiresAt) : null;
      if (hard !== null && hard <= nowMs) throw new MarketActionError(409, 'This post has already ended');
      const until = hard === null ? nowMs + AVAILABILITY_MS : Math.min(nowMs + AVAILABILITY_MS, hard);
      // A live reserve stays; anything else is active again.
      next = status === 'reserved' ? 'reserved' : 'active';
      update = { status: next, confirmedAt: now, availabilityExpiresAt: new Date(until), nudgeSentAt: null };
      break;
    }
    case 'sold':
    case 'booked': {
      const allowed = patch.action === 'sold' ? SOLD_KINDS : BOOKED_KINDS;
      if (!allowed.has(kind)) {
        throw new MarketActionError(400, patch.action === 'sold' ? 'Mark this one as booked or close it' : 'Only seats and cab splits get booked');
      }
      if (stored === patch.action) break;
      requireOpen(status);
      next = patch.action;
      update = { status: next };
      break;
    }
    case 'reserve': {
      if (kind === 'wanted') throw new MarketActionError(400, 'A wanted post cannot be reserved');
      if (status === 'reserved') throw new MarketActionError(409, 'Already reserved');
      if (status !== 'active') throw new MarketActionError(409, 'Only a live post can be reserved');
      next = 'reserved';
      // The seller holds it for a buyer they talked to; the app does not know who.
      update = { status: next, reservedUntil: new Date(nowMs + RESERVE_MS), reservedBy: null };
      break;
    }
    case 'unreserve': {
      if (stored !== 'reserved') throw new MarketActionError(409, 'This post is not reserved');
      next = 'active';
      update = { status: next, reservedUntil: null, reservedBy: null };
      break;
    }
    case 'lower_price': {
      if (kind === 'wanted') throw new MarketActionError(400, 'A wanted post has no price to lower');
      requireOpen(status);
      const current = listing.price;
      if (current === null || current <= 0) throw new MarketActionError(400, 'This post has no price to lower');
      if (patch.price >= current) throw new MarketActionError(400, `Price must be below ${formatPrice(current)}`);
      update = { price: patch.price, previousPrice: current, priceDroppedAt: now };
      break;
    }
    case 'bundle_item_sold': {
      if (kind !== 'bundle') throw new MarketActionError(400, 'Only bundles have parts');
      requireOpen(status);
      const details = asRecord(data.details);
      const parts = Array.isArray(details.parts) ? details.parts.map((part) => ({ ...asRecord(part) })) : [];
      if (patch.partIndex >= parts.length) throw new MarketActionError(400, 'That part is not in this bundle');
      if (parts[patch.partIndex].sold === true) break;
      parts[patch.partIndex].sold = true;
      update = { 'details.parts': parts };
      if (parts.every((part) => part.sold === true)) {
        next = 'sold';
        update.status = next;
      }
      break;
    }
    case 'seats_left': {
      const max = MAX_SEATS[kind];
      if (max === undefined) throw new MarketActionError(400, 'Only seats and cab splits have seats');
      if (patch.seatsLeft > max) throw new MarketActionError(400, `At most ${max} seats`);
      requireOpen(status);
      update = { 'details.seatsLeft': patch.seatsLeft };
      if (patch.seatsLeft === 0) {
        next = 'booked';
        update.status = next;
      }
      break;
    }
    case 'close': {
      if (stored === 'closed') break;
      if (FINISHED.has(stored)) throw new MarketActionError(409, 'This post is already done');
      next = 'closed';
      update = { status: next };
      break;
    }
    case 'promotion': {
      if (data.audience !== 'campus' && patch.eligible) {
        throw new MarketActionError(400, "Girls' Space posts are never promoted");
      }
      update = { promotionEligible: data.audience === 'campus' && patch.eligible };
      break;
    }
  }

  if (update) {
    update.updatedAt = now;
    await ref.update(update);
  }

  if (patch.action === 'lower_price' && update) {
    const suffix = data.priceTerms === 'per_person' ? 'pp' : undefined;
    try {
      const fanOut = await loadNotifySavers(options);
      const result = await fanOut(
        'marketplace',
        ref.id,
        'price_drop',
        {
          title: PRICE_DROP_TITLE,
          body: `Now ${formatPrice(patch.price, suffix)}, was ${formatPrice(listing.price ?? 0, suffix)}`,
          href: `/market/${ref.id}`,
          campusId: typeof data.campusId === 'string' ? data.campusId : null,
        },
        { now, ownerId: principal.userId },
      );
      notified = result.queued;
    } catch (error) {
      // The new price is already saved; a failed fan-out must not undo or retry it.
      console.error('[market] price drop fan-out failed', error);
    }
  }

  return { action: patch.action, status: next, update, notified };
}
