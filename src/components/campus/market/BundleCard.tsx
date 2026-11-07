// Room clear-out bundle card: '6 items · from Rs 200 · until 30 Apr'.
// Student photo, else room art. No hooks, so it renders on the server too.

import Link from 'next/link';
import { TapeStrip } from '@/components/swoop/Logo';
import { ROOM_ART, type RoomItemId } from '@/components/swoop/illustrations-room';
import { Tag } from '@/components/swoop/primitives';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { MARKET_STATUS_LABELS } from '@/lib/campus/constants';
import { furnishTileFor } from '@/lib/campus/market';
import { formatPrice } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';
import type { BundleDetails, MarketListing } from '@/types/market';
import { formatDay } from './PassRow';
import { Price, TermsChip } from './PriceBits';

export type BundleCardListing = Pick<
  MarketListing,
  'id' | 'status' | 'title' | 'category' | 'price' | 'priceTerms' | 'images' | 'details' | 'place' | 'availabilityExpiresAt' | 'reservedByViewer'
>;

/** Room things the furnish tiles do not cover, checked after them. */
const EXTRA_ART: readonly [RegExp, RoomItemId][] = [
  [/\blamps?\b|\blights?\b/i, 'lamp'],
  [/\bcurtains?\b/i, 'curtains'],
  [/\bwardrobe|almirah|cupboard/i, 'wardrobe'],
  [/\bbed\b|\bpillows?\b|\bbedsheets?\b/i, 'bed'],
];

/** Room art for a bundle with no photo: the first thing in it Swoop has art for. */
export function bundleArtFor(listing: Pick<BundleCardListing, 'title' | 'category'>, parts: readonly { title: string }[]): RoomItemId {
  const texts = [...parts.map((part) => part.title), listing.title];
  for (const text of texts) {
    const tile = furnishTileFor(text);
    if (tile) return tile;
  }
  for (const text of texts) {
    const hit = EXTRA_ART.find(([pattern]) => pattern.test(text));
    if (hit) return hit[1];
  }
  return listing.category === 'books_notes' || listing.category === 'stationery' ? 'shelf' : 'study_table';
}

/** '6 items · from Rs 200 · until 30 Apr'. Parts without a price are skipped for 'from'. */
export function bundleMeta(details: Pick<BundleDetails, 'parts'>, until: string | null): string {
  const count = details.parts.length;
  const prices = details.parts.map((part) => part.price).filter((price): price is number => typeof price === 'number' && price > 0);
  const bits = [count === 1 ? '1 item' : `${count} items`];
  if (prices.length) bits.push(`from ${formatPrice(Math.min(...prices))}`);
  const day = formatDay(until);
  if (day) bits.push(`until ${day}`);
  return bits.join(' · ');
}

const GONE = new Set(['sold', 'booked', 'filled', 'expired', 'closed', 'removed']);

/**
 * Bundle card for the 'Rooms clearing out' row. `until` defaults to when the
 * post stops showing. Width comes from the caller (e.g. w-[232px] in a row).
 */
export function BundleCard({
  listing,
  campusLabel,
  until,
  href,
  className,
}: {
  listing: BundleCardListing;
  /** Short campus name for the distance line, e.g. 'KJU'. */
  campusLabel: string;
  /** ISO time the seller clears out by. Defaults to availabilityExpiresAt. */
  until?: string | null;
  /** Defaults to /marketplace/{id}. */
  href?: string;
  className?: string;
}) {
  const parts = listing.details.kind === 'bundle' ? listing.details.parts : [];
  const splitOk = listing.details.kind === 'bundle' && listing.details.splitOk;
  const sold = listing.status === 'sold';
  const gone = GONE.has(listing.status);
  const reserved = listing.status === 'reserved';
  const photo = listing.images[0];
  const Art = ROOM_ART[bundleArtFor(listing, parts)];
  const meta = bundleMeta({ parts }, until === undefined ? listing.availabilityExpiresAt : until);
  const tag = reserved
    ? listing.reservedByViewer
      ? 'Reserved for you'
      : 'Reserved'
    : gone && !sold
      ? MARKET_STATUS_LABELS[listing.status]
      : null;

  return (
    <Link
      href={href ?? `/marketplace/${listing.id}`}
      className={cn(
        'campus-press flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-white text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40',
        className,
      )}
    >
      <span className="relative grid h-[104px] place-items-center overflow-hidden bg-surface">
        {photo ? (
          <img src={photo} alt="" className={cn('absolute inset-0 h-full w-full object-cover', gone && 'opacity-50')} />
        ) : (
          <Art width={104} height={95} className={gone ? 'opacity-50' : undefined} />
        )}
        {sold ? (
          <TapeStrip word="sold" className="absolute -left-4 -right-4 top-[40%] text-[12px]" style={{ transform: 'rotate(-8deg)' }} />
        ) : null}
        {tag ? (
          <Tag tone={reserved ? 'royal' : 'ink'} className="absolute left-1.5 top-1.5">
            {tag}
          </Tag>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1 px-2.5 pb-2.5 pt-2">
        <span className="truncate text-[12.5px] font-bold">
          {sold ? <span className="sr-only">Sold: </span> : null}
          {listing.title}
        </span>
        <span className="truncate text-[11px] font-semibold text-slate">{meta}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <Price listing={listing} muted={gone} className={gone ? 'line-through' : undefined} />
          <span className="text-[10.5px] font-semibold text-slate">for all</span>
          <TermsChip terms={listing.priceTerms} price={listing.price} />
        </span>
        <span className="text-[10.5px] font-semibold text-text-secondary">{splitOk ? 'Buy one or all' : 'Sold together'}</span>
        <DistanceLine meters={listing.place?.roughDistanceM} campusLabel={campusLabel} className="text-[11px]" />
      </span>
    </Link>
  );
}
