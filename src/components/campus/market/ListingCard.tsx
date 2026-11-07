'use client';

// 3-up market tile: student photo or a duotone icon tile, price, terms chip,
// distance, Reserved / Booked / Sold states, price drop and save.

import Link from 'next/link';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  BallIcon,
  BookIcon,
  BookmarkIcon,
  BoxIcon,
  BusIcon,
  CabIcon,
  CycleIcon,
  HandIcon,
  NotesIcon,
  PassIcon,
  ScooterIcon,
  SeatIcon,
  TicketIcon,
  BedIcon,
  type IconProps,
} from '@/components/swoop/icons';
import { TapeStrip } from '@/components/swoop/Logo';
import { Tag } from '@/components/swoop/primitives';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { MARKET_STATUS_LABELS } from '@/lib/campus/constants';
import type { Instant } from '@/lib/campus/listingRules';
import { cn } from '@/lib/utils/cn';
import type { MarketCategory, MarketListing } from '@/types/market';
import { DropTag, Price, TermsChip, WasPrice, priceDrop } from './PriceBits';

/* Local duotone icons for categories the shared set has no glyph for.
   Same pattern as src/components/swoop/icons.tsx (solid + 32% layer). */
function LocalIcon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

const GadgetIcon = (p: IconProps) => (
  <LocalIcon {...p}>
    <rect opacity={0.32} x="3" y="4" width="18" height="12" rx="2" />
    <rect x="6" y="18" width="12" height="2.4" rx="1.2" />
    <rect x="10.8" y="15" width="2.4" height="4" />
  </LocalIcon>
);

const ShirtIcon = (p: IconProps) => (
  <LocalIcon {...p}>
    <path opacity={0.32} d="M8.5 3 3 6l2 4.5 2.5-1V21h9V9.5l2.5 1L21 6l-5.5-3Z" />
    <path d="M8.5 3h7a3.5 3.5 0 0 1-7 0Z" />
  </LocalIcon>
);

const MusicIcon = (p: IconProps) => (
  <LocalIcon {...p}>
    <path opacity={0.32} d="M9 5.5 20 3v12.5h-2.4V6L11.4 7.4V18H9Z" />
    <circle cx="6.5" cy="18" r="3" />
    <circle cx="17.5" cy="15.5" r="3" />
  </LocalIcon>
);

const CATEGORY_ICONS: Record<MarketCategory, ComponentType<IconProps>> = {
  books_notes: BookIcon,
  electronics: GadgetIcon,
  fashion: ShirtIcon,
  hostel_essentials: BedIcon,
  stationery: NotesIcon,
  sports_fitness: BallIcon,
  music: MusicIcon,
  cycles: CycleIcon,
  travel: BusIcon,
  other: BoxIcon,
};

/** Icon for a post with no photo: by kind first, then by category. */
function marketIconFor(listing: Pick<MarketListing, 'category' | 'details'>): ComponentType<IconProps> {
  const d = listing.details;
  switch (d.kind) {
    case 'vehicle':
      return d.vehicleType === 'cycle' ? CycleIcon : ScooterIcon;
    case 'ticket':
      return TicketIcon;
    case 'pass':
      return PassIcon;
    case 'seat':
      return SeatIcon;
    case 'cab_split':
      return CabIcon;
    case 'wanted':
      return HandIcon;
    case 'bundle':
      return BoxIcon;
    default:
      return CATEGORY_ICONS[listing.category] ?? BoxIcon;
  }
}

export type ListingCardListing = Pick<
  MarketListing,
  | 'id'
  | 'kind'
  | 'category'
  | 'status'
  | 'title'
  | 'price'
  | 'priceTerms'
  | 'previousPrice'
  | 'priceDroppedAt'
  | 'images'
  | 'details'
  | 'place'
  | 'reservedByViewer'
  | 'isSaved'
  | 'isOwner'
>;

/** Statuses after which the post is no longer for sale. */
const CLOSED = new Set(['expired', 'closed', 'removed', 'filled']);
const SHADOW = 'shadow-[0_1px_3px_rgba(16,24,40,0.14)]';

/** Save toggle: POST /api/campus/actions, same contract as SaveShare. Reverts on failure. */
function SaveButton({ id, title, saved }: { id: string; title: string; saved: boolean }) {
  const [isSaved, setIsSaved] = useState(saved);
  const [busy, setBusy] = useState(false);

  useEffect(() => setIsSaved(saved), [saved]);

  const toggle = async () => {
    if (busy) return;
    const next = !isSaved;
    setIsSaved(next);
    setBusy(true);
    try {
      const response = await fetch('/api/campus/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: next ? 'save' : 'unsave', contentType: 'marketplace', contentId: id }),
      });
      if (!response.ok) throw new Error('save failed');
    } catch {
      setIsSaved(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={isSaved ? `Remove ${title} from saved` : `Save ${title}`}
      aria-pressed={isSaved}
      onClick={() => void toggle()}
      className={cn(
        'campus-press absolute right-1 top-1 z-10 grid h-8 w-8 place-items-center rounded-full bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40',
        SHADOW,
        isSaved ? 'text-royal' : 'text-ink',
      )}
    >
      <BookmarkIcon size={14} filled={isSaved} />
    </button>
  );
}

/**
 * 3-up listing tile. `now` drives the 7-day price-drop badge; pass the
 * server's time so server and client agree. `campusLabel` is the short
 * campus name for the distance line, e.g. 'KJU'.
 */
export function ListingCard({
  listing,
  campusLabel,
  now,
  href,
  saveable = true,
  className,
}: {
  listing: ListingCardListing;
  campusLabel: string;
  now: Instant;
  /** Defaults to /marketplace/{id}. */
  href?: string;
  /** Show the save button. Off for the poster's own posts. */
  saveable?: boolean;
  className?: string;
}) {
  const sold = listing.status === 'sold';
  const booked = listing.status === 'booked';
  const reserved = listing.status === 'reserved';
  const closed = CLOSED.has(listing.status);
  const unavailable = sold || booked || closed;
  const drop = unavailable ? null : priceDrop(listing, now);
  const photo = listing.images[0];
  const Icon = marketIconFor(listing);
  const rent = listing.details.kind === 'vehicle' && listing.details.offer === 'rent';

  let statusTag: { text: string; tone: 'ink' | 'royal' | 'white' } | null = null;
  if (reserved) statusTag = { text: listing.reservedByViewer ? 'Reserved for you' : 'Reserved', tone: 'royal' };
  else if (booked) statusTag = { text: 'Booked', tone: 'ink' };
  else if (closed) statusTag = { text: MARKET_STATUS_LABELS[listing.status], tone: 'ink' };
  else if (rent) statusTag = { text: 'For rent', tone: 'white' };

  return (
    <article className={cn('relative min-w-0', className)}>
      <Link
        href={href ?? `/marketplace/${listing.id}`}
        className="campus-press flex flex-col gap-1 rounded-[12px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
      >
        <span className="relative grid aspect-square place-items-center overflow-hidden rounded-[12px] bg-surface">
          {photo ? (
            <img src={photo} alt="" className={cn('absolute inset-0 h-full w-full object-cover', unavailable && 'opacity-50')} />
          ) : (
            <Icon size={30} className={cn('text-ink', unavailable && 'opacity-40')} />
          )}
          {sold ? (
            <TapeStrip
              word="sold"
              className="absolute -left-4 -right-4 top-[42%] text-[11px]"
              style={{ transform: 'rotate(-14deg)' }}
            />
          ) : null}
          {statusTag ? (
            <Tag tone={statusTag.tone} className={cn('absolute left-1 top-1 block max-w-[calc(100%-44px)] truncate', statusTag.tone === 'white' && SHADOW)}>
              {statusTag.text}
            </Tag>
          ) : null}
          {drop ? <DropTag className={cn('absolute bottom-1 left-1', SHADOW)} /> : null}
        </span>

        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
          <Price listing={listing} muted={unavailable} />
          {drop ? <WasPrice was={drop.was} /> : null}
        </span>
        <span className="line-clamp-2 text-[11.5px] font-semibold leading-[1.2]">
          {sold ? <span className="sr-only">Sold: </span> : null}
          {booked ? <span className="sr-only">Booked: </span> : null}
          {listing.title}
        </span>
        <TermsChip terms={listing.priceTerms} price={listing.price} className="self-start" />
        <DistanceLine
          meters={listing.place?.roughDistanceM}
          campusLabel={campusLabel}
          icon={false}
          className="text-[10.5px] leading-[1.25] [&>span]:line-clamp-2 [&>span]:whitespace-normal"
        />
      </Link>
      {saveable && !listing.isOwner ? <SaveButton id={listing.id} title={listing.title} saved={Boolean(listing.isSaved)} /> : null}
    </article>
  );
}
