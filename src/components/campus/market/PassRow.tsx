// One row for a seat, cab split, ticket or pass: route and time, who it is
// for, seats left and the price. No hooks, so it renders on the server too.

import Link from 'next/link';
import type { ComponentType } from 'react';
import { BusIcon, CabIcon, PassIcon, SeatIcon, TicketIcon, TrainIcon, type IconProps } from '@/components/swoop/icons';
import { Tag } from '@/components/swoop/primitives';
import { GENDER_PREF_LABELS, MARKET_STATUS_LABELS } from '@/lib/campus/constants';
import { cn } from '@/lib/utils/cn';
import type { MarketListing } from '@/types/market';
import { FairPrice, Price } from './PriceBits';

const IST_OFFSET_MS = 330 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** IST wall clock for an ISO time, or null. Hand-rolled so server and client print the same. */
function istClock(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms + IST_OFFSET_MS) : null;
}

/** '30 Apr' in IST, or '' for a missing time. */
export function formatDay(iso: string | null | undefined): string {
  const at = istClock(iso);
  return at ? `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}` : '';
}

/** 'Fri 14 Nov, 5:00 am' in IST, or '' for a missing time. */
export function formatWhen(iso: string | null | undefined): string {
  const at = istClock(iso);
  if (!at) return '';
  const hours = at.getUTCHours();
  const minutes = String(at.getUTCMinutes()).padStart(2, '0');
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${WEEKDAYS[at.getUTCDay()]} ${formatDay(iso)}, ${hour12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

export type PassRowListing = Pick<MarketListing, 'id' | 'kind' | 'status' | 'title' | 'price' | 'priceTerms' | 'details' | 'genderPref'>;

/** Statuses that mean the seat or ticket is gone. */
const GONE = new Set(['booked', 'sold', 'filled', 'expired', 'closed', 'removed']);

function seatsLeftText(n: number): string {
  return n === 1 ? '1 seat left' : `${n} seats left`;
}

interface RowParts {
  icon: ComponentType<IconProps>;
  route: string;
  when: string;
  seatsLeft: number | null;
  extra: string | null;
}

function partsOf(listing: PassRowListing): RowParts {
  const d = listing.details;
  switch (d.kind) {
    case 'seat': {
      const text = d.seatFor.toLowerCase();
      const icon = text.includes('train') ? TrainIcon : text.includes('bus') ? BusIcon : SeatIcon;
      return { icon, route: d.seatFor, when: formatWhen(d.startsAt) || 'Time not set', seatsLeft: d.seatsLeft, extra: null };
    }
    case 'cab_split':
      return { icon: CabIcon, route: `${d.from} to ${d.to}`, when: `Leaves ${formatWhen(d.leavesAt)}`, seatsLeft: d.seatsLeft, extra: null };
    case 'ticket': {
      const when = [formatWhen(d.happensAt), d.venue].filter(Boolean).join(' · ');
      return { icon: TicketIcon, route: listing.title, when, seatsLeft: null, extra: d.quantity > 1 ? `${d.quantity} tickets` : null };
    }
    case 'pass':
      return {
        icon: d.passType === 'bus' ? BusIcon : d.passType === 'metro' ? TrainIcon : PassIcon,
        route: listing.title,
        when: d.validUntil ? `Valid till ${formatDay(d.validUntil)}` : 'No end date',
        seatsLeft: null,
        extra: null,
      };
    default:
      return { icon: SeatIcon, route: listing.title, when: '', seatsLeft: null, extra: null };
  }
}

/**
 * 36 px round icon holder, the same look as IconTile. IconTile lives in a client
 * module, and an icon component cannot be passed to it from a server render
 * (the market kit page), so the icon is drawn here.
 */
export function RowIconTile({ icon: Icon, muted = false, className }: { icon: ComponentType<IconProps>; muted?: boolean; className?: string }) {
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', muted ? 'bg-surface text-ink' : 'bg-royal-tint text-royal', className)}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}

const META = 'whitespace-nowrap text-[10.5px] font-semibold';

/**
 * Seat, cab split, ticket or pass row. A pass can show 'Fair price Rs 1.2k'
 * when the caller knows it (see fairPassPrice). The whole row opens the post.
 */
export function PassRow({
  listing,
  fairPrice,
  href,
  divider = true,
  className,
}: {
  listing: PassRowListing;
  /** Fair resale price for a pass, in rupees. */
  fairPrice?: number | null;
  /** Defaults to /marketplace/{id}. */
  href?: string;
  divider?: boolean;
  className?: string;
}) {
  const { icon, route, when, seatsLeft, extra } = partsOf(listing);
  const gone = GONE.has(listing.status);
  const reserved = listing.status === 'reserved';
  const isTrip = listing.kind === 'seat' || listing.kind === 'cab_split';
  const showGender = isTrip || listing.genderPref !== 'anyone';

  return (
    <Link
      href={href ?? `/marketplace/${listing.id}`}
      className={cn('campus-press flex items-stretch gap-2.5 text-left text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40', className)}
    >
      <span className="grid place-items-center py-2">
        <RowIconTile icon={icon} muted={gone} className={gone ? 'opacity-60' : undefined} />
      </span>
      <span className={cn('flex min-h-[60px] min-w-0 flex-1 items-center gap-2 py-2', divider && 'border-b border-line')}>
        <span className={cn('flex min-w-0 flex-1 flex-col gap-0.5', gone && 'opacity-60')}>
          <span className="truncate text-[12.5px] font-bold">{route}</span>
          {when ? <span className="truncate text-[11px] text-slate">{when}</span> : null}
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {showGender ? (
              <span className={cn(META, listing.genderPref === 'girls' ? 'text-girls' : 'text-text-secondary')}>
                {GENDER_PREF_LABELS[listing.genderPref]}
              </span>
            ) : null}
            {seatsLeft !== null && !gone ? <span className={cn(META, 'text-ink')}>{seatsLeftText(seatsLeft)}</span> : null}
            {extra ? <span className={cn(META, 'text-text-secondary')}>{extra}</span> : null}
            {listing.kind === 'ticket' && !gone ? <span className={cn(META, 'text-text-secondary')}>Ends at showtime</span> : null}
            {listing.kind === 'pass' && typeof fairPrice === 'number' && fairPrice > 0 && !gone ? <FairPrice rupees={fairPrice} /> : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Price listing={listing} muted={gone} className={gone ? 'line-through' : undefined} />
          {gone || reserved ? <Tag tone={reserved ? 'royal' : 'ink'}>{MARKET_STATUS_LABELS[listing.status]}</Tag> : null}
        </span>
      </span>
    </Link>
  );
}
