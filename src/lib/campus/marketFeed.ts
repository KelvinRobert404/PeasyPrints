// Groups market listings into the market home sections: rooms clearing out,
// seats/tickets/passes, everything near you and wanted, plus furnish tile counts.
// Pure: runtime imports are relative with the .ts extension so node tests can load it.

import type { MarketListing } from '@/types/market';
import { effectiveStatus } from './listingRules.ts';
import { withinRing } from '../format/distance.ts';
import { FURNISH_TILES, furnishTileFor } from './market.ts';
import type { FurnishTileId } from './market.ts';

/** The listing fields the feed needs. MarketListing fits. */
export type FeedListing = Pick<
  MarketListing,
  'id' | 'kind' | 'status' | 'title' | 'details' | 'createdAt' | 'reservedUntil' | 'availabilityExpiresAt'
> & {
  place: { roughDistanceM: number | null } | null;
};

export interface MarketFeedOptions {
  /** Drop near-you listings known to be further than this many metres. */
  ring?: number;
}

export interface MarketFeed<T extends FeedListing> {
  /** Room bundles, newest first. */
  clearingOut: T[];
  /** Seats, cab splits, tickets and passes, soonest end first. */
  seats: T[];
  /** Items and vehicles, nearest first, then newest. */
  nearYou: T[];
  /** Asks, newest first. */
  wanted: T[];
  /** Open items and bundles per furnish tile. */
  furnishCounts: Record<FurnishTileId, number>;
}

type Instant = Date | string | number;

const OPEN = new Set(['active', 'reserved', 'needs_confirmation']);

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** When a dated listing stops being useful. Null for kinds with no natural end. */
export function listingEndsAt(listing: Pick<FeedListing, 'details'>): string | null {
  const details = listing.details;
  switch (details.kind) {
    case 'seat':
      return details.endsAt ?? details.startsAt;
    case 'cab_split':
      return details.leavesAt;
    case 'ticket':
      return details.happensAt;
    case 'pass':
      return details.validUntil;
    default:
      return null;
  }
}

/** True when a viewer should still see the listing in the feed right now. */
export function isFeedVisible(listing: FeedListing, now: Instant): boolean {
  if (!OPEN.has(listing.status)) return false;
  const status = effectiveStatus(
    {
      status: listing.status as 'active' | 'reserved' | 'needs_confirmation',
      reservedUntil: listing.reservedUntil,
      availabilityExpiresAt: listing.availabilityExpiresAt,
      hardExpiresAt: listingEndsAt(listing),
    },
    now,
  );
  return OPEN.has(status);
}

function newestFirst(a: FeedListing, b: FeedListing): number {
  return (parseMs(b.createdAt) ?? 0) - (parseMs(a.createdAt) ?? 0);
}

/** Nulls sort last; ties fall through to newest first. */
function ascendingThenNewest(key: (listing: FeedListing) => number | null) {
  return (a: FeedListing, b: FeedListing): number => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) {
      if (ka === null) return 1;
      if (kb === null) return -1;
      return ka - kb;
    }
    return newestFirst(a, b);
  };
}

function distanceOf(listing: FeedListing): number | null {
  const d = listing.place?.roughDistanceM;
  return typeof d === 'number' && Number.isFinite(d) && d >= 0 ? d : null;
}

function emptyFurnishCounts(): Record<FurnishTileId, number> {
  const counts = {} as Record<FurnishTileId, number>;
  for (const tile of FURNISH_TILES) counts[tile.id] = 0;
  return counts;
}

/** Furnish tiles a listing covers: an item's own title, or each thing in a bundle. */
function furnishTilesOf(listing: FeedListing): Set<FurnishTileId> {
  const tiles = new Set<FurnishTileId>();
  const details = listing.details;
  if (details.kind === 'item') {
    const tile = furnishTileFor(listing.title);
    if (tile) tiles.add(tile);
  } else if (details.kind === 'bundle') {
    for (const part of details.parts) {
      const tile = furnishTileFor(part.title);
      if (tile) tiles.add(tile);
    }
  }
  return tiles;
}

/**
 * Splits visible listings into the market home sections. Closed, sold,
 * expired and lapsed listings are left out.
 */
export function groupMarketFeed<T extends FeedListing>(
  items: readonly T[],
  now: Instant,
  options: MarketFeedOptions = {},
): MarketFeed<T> {
  const feed: MarketFeed<T> = { clearingOut: [], seats: [], nearYou: [], wanted: [], furnishCounts: emptyFurnishCounts() };

  for (const listing of items) {
    if (!isFeedVisible(listing, now)) continue;
    switch (listing.details.kind) {
      case 'bundle':
        feed.clearingOut.push(listing);
        break;
      case 'seat':
      case 'cab_split':
      case 'ticket':
      case 'pass':
        feed.seats.push(listing);
        break;
      case 'wanted':
        feed.wanted.push(listing);
        break;
      default: {
        const distance = distanceOf(listing);
        if (options.ring !== undefined && distance !== null && !withinRing(distance, options.ring)) break;
        feed.nearYou.push(listing);
      }
    }
    for (const tile of furnishTilesOf(listing)) feed.furnishCounts[tile] += 1;
  }

  feed.clearingOut.sort(newestFirst);
  feed.seats.sort(ascendingThenNewest((listing) => parseMs(listingEndsAt(listing))));
  feed.nearYou.sort(ascendingThenNewest(distanceOf));
  feed.wanted.sort(newestFirst);
  return feed;
}
