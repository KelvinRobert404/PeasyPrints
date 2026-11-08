'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { BookmarkIcon, PinIcon } from '@/components/swoop/icons';
import { HousingArt } from '@/components/swoop/illustrations';
import { Tag } from '@/components/swoop/primitives';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { HOUSING_STATUS_LABELS, RENT_PERIOD_LABELS } from '@/lib/campus/constants';
import {
  RENT_TERMS,
  RENT_TERMS_LABELS,
  WHO_CAN_STAY_LABELS,
  housingPriceLabels,
  roommateChips,
  type PostedAs,
  type RentTermsKind,
} from '@/lib/campus/housing/model';
import { priceDropActive } from '@/lib/campus/listingRules';
import { istDateKey, nextSemStart } from '@/lib/campus/season';
import { useSeasonNow } from '@/lib/demo/season';
import { formatPrice, isPriceDrop } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';
import type { HousingListing, HousingStatus } from '@/types/housing';

const CHIP_SHADOW = 'shadow-[0_1px_3px_rgba(16,24,40,0.12)]';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['filled', 'expired', 'closed', 'removed']);

/**
 * What the card reads. A HousingListing fits as is; the optional extras are the
 * v2 fields the create form sends (rent terms kind, agent posts, roommate group,
 * languages, home state, price drops) and show up once the stored doc carries them.
 */
export type HousingCardItem = Omit<HousingListing, 'rentTerms' | 'postedAs' | 'status' | 'roommate'> & {
  rentTerms: HousingListing['rentTerms'] | RentTermsKind;
  postedAs: HousingListing['postedAs'] | PostedAs;
  status: HousingStatus | 'reserved';
  roommate:
    | (NonNullable<HousingListing['roommate']> & {
        groupSize?: number | null;
        languages?: string[] | null;
        homeState?: string | null;
      })
    | null;
  /** Rent per person before the last drop, rupees. */
  previousRentPp?: number | null;
  /** ISO time of the last drop. The badge shows for 7 days after it. */
  priceDroppedAt?: string | null;
};

export type HousingListingCardVariant = 'grid' | 'row';

type Props<T extends HousingCardItem> = {
  item: T;
  href: string;
  onSave?: (item: T) => void;
  /** 'grid' for feeds; 'row' for the agents digest. */
  variant?: HousingListingCardVariant;
  /** Viewer's campus code for the distance line. Defaults to the session's campus. */
  campusCode?: string;
};

type Badge = { id: string; label: string; tone: 'ink' | 'royal' | 'white' | 'go' };

function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  const last = day % 10;
  if (last === 1) return `${day}st`;
  if (last === 2) return `${day}nd`;
  if (last === 3) return `${day}rd`;
  return `${day}th`;
}

function keyToDayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** 'Move in: Immediate', 'Move in: Next sem', 'Move in: 1st Dec'. */
export function housingMoveInLabel(moveIn: string | null, now: Date = new Date()): string {
  if (!moveIn || !Number.isFinite(Date.parse(moveIn))) return 'Move in: Immediate';
  const key = istDateKey(moveIn);
  const todayKey = istDateKey(now);
  const diff = keyToDayNumber(key) - keyToDayNumber(todayKey);
  if (diff <= 0) return 'Move in: Immediate';
  if (key === nextSemStart(now)) return 'Move in: Next sem';
  const [year, month, day] = key.split('-').map(Number);
  const date = `${ordinal(day)} ${MONTHS[month - 1]}`;
  // Far-off dates carry the year so a January move-in does not read as last January.
  return `Move in: ${diff > 300 && year !== Number(todayKey.slice(0, 4)) ? `${date} ${year}` : date}`;
}

function rentTermsChip(rentTerms: HousingCardItem['rentTerms']): string | null {
  if (typeof rentTerms === 'string') {
    return (RENT_TERMS as readonly string[]).includes(rentTerms) ? RENT_TERMS_LABELS[rentTerms] : null;
  }
  if (!rentTerms || rentTerms.period === 'monthly') return null;
  return RENT_PERIOD_LABELS[rentTerms.period] ?? null;
}

function agentBadge(item: HousingCardItem): string | null {
  const agent = item.postedAs === 'agent' || item.brokerage?.charged === true;
  if (!agent) return null;
  if (!item.brokerage?.charged) return 'Agent · No brokerage';
  const amount = item.brokerage.amount;
  return typeof amount === 'number' && amount > 0 ? `Agent · ${formatPrice(amount)} brokerage` : 'Agent · Brokerage';
}

function priceDropped(item: HousingCardItem, now: Date): boolean {
  if (item.priceDroppedAt) {
    return priceDropActive({ price: item.rentPp, previousPrice: item.previousRentPp ?? null, priceDroppedAt: item.priceDroppedAt }, now);
  }
  return isPriceDrop(item.previousRentPp, item.rentPp);
}

function statusBadges(item: HousingCardItem, now: Date): Badge[] {
  const badges: Badge[] = [];
  if (item.status === 'reserved' || item.status === 'booked') {
    badges.push({ id: 'reserved', label: 'Reserved', tone: 'ink' });
  } else if (item.status !== 'active') {
    badges.push({ id: 'status', label: HOUSING_STATUS_LABELS[item.status] ?? 'Closed', tone: 'white' });
  }
  if (!CLOSED_STATUSES.has(item.status) && priceDropped(item, now)) {
    badges.push({ id: 'price_drop', label: 'Price dropped', tone: 'go' });
  }
  const agent = agentBadge(item);
  if (agent) badges.push({ id: 'agent', label: agent, tone: 'white' });
  return badges;
}

/** Meta chips. Roommate posts follow the H2 order; everything else is move-in, beds, gender. */
function metaChips(item: HousingCardItem, now: Date): string[] {
  const moveIn = housingMoveInLabel(item.moveIn, now);
  if (item.roommate) {
    return roommateChips(
      {
        moveIn: null,
        houseRules: item.houseRules,
        whoCanStay: item.whoCanStay,
        roommate: {
          groupSize: item.roommate.groupSize ?? null,
          languages: item.roommate.languages ?? null,
          homeState: item.roommate.homeState ?? null,
        },
      },
      now,
    ).map((chip) => (chip.id === 'move_in' ? moveIn : chip.label));
  }
  const chips = [moveIn];
  if (item.bedsLeft > 0) chips.push(item.bedsLeft === 1 ? '1 bed left' : `${item.bedsLeft} beds left`);
  chips.push(WHO_CAN_STAY_LABELS[item.whoCanStay]);
  return chips;
}

function MetaChip({ children, tone = 'surface' }: { children: ReactNode; tone?: 'surface' | 'royal' }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-5 max-w-full items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold leading-[1.2]',
        tone === 'royal' ? 'bg-royal-tint text-royal' : 'bg-surface text-ink',
      )}
    >
      <span className="break-words">{children}</span>
    </span>
  );
}

function Photo({ item, closed, className, artSize }: { item: HousingCardItem; closed: boolean; className: string; artSize: number }) {
  const photo = item.images[0];
  return (
    <span className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-[12px] bg-surface', className)}>
      {photo ? (
        <img src={photo} alt="" className={cn('absolute inset-0 h-full w-full object-cover', closed && 'opacity-50')} />
      ) : (
        <HousingArt width={artSize} height={Math.round((artSize * 110) / 120)} className={cn(closed && 'opacity-50')} />
      )}
    </span>
  );
}

function Where({ item, campusCode }: { item: HousingCardItem; campusCode: string }) {
  const meters = item.place.roughDistanceM;
  if (typeof meters === 'number' && Number.isFinite(meters)) {
    return <DistanceLine meters={meters} campusLabel={campusCode} />;
  }
  const label = item.place.label || item.place.area;
  if (!label) return null;
  return (
    <p className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-slate">
      <PinIcon size={13} className="shrink-0 text-ink" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </p>
  );
}

/** Housing listing card. 'grid' is the feed tile; 'row' is the compact agents digest line. */
export function HousingListingCard<T extends HousingCardItem>({ item, href, onSave, variant = 'grid', campusCode }: Props<T>) {
  const current = useCurrentCampus();
  const code = campusCode ?? current?.code ?? item.collegeCode;
  const now = new Date();
  // Move-in labels read the demo date in demo mode; badges stay on real time.
  const seasonNow = useSeasonNow();
  const closed = CLOSED_STATUSES.has(item.status);
  const price = housingPriceLabels({ rentPp: item.rentPp, deposit: item.deposit });
  const terms = rentTermsChip(item.rentTerms);
  const badges = statusBadges(item, now);
  const chips = metaChips(item, seasonNow);
  const saveButton = onSave ? (
    <button
      type="button"
      aria-label={item.isSaved ? 'Remove saved listing' : 'Save listing'}
      aria-pressed={Boolean(item.isSaved)}
      onClick={() => onSave(item)}
      className={cn(
        'campus-press absolute grid h-7 w-7 place-items-center rounded-full bg-white',
        CHIP_SHADOW,
        item.isSaved ? 'text-royal' : 'text-ink',
        variant === 'grid' ? 'right-[5px] top-[5px]' : 'right-2 top-2',
      )}
    >
      <BookmarkIcon size={13} filled={item.isSaved} />
    </button>
  ) : null;

  const showPriceLine = variant === 'row' || Boolean(price.deposit) || Boolean(terms);
  const priceLine = showPriceLine ? (
    <span className="flex flex-wrap items-center gap-1">
      {variant === 'row' ? <MetaChip tone="royal">{price.rent}</MetaChip> : null}
      {price.deposit ? <MetaChip>{price.deposit}</MetaChip> : null}
      {terms ? <MetaChip>{terms}</MetaChip> : null}
    </span>
  ) : null;

  const metaLine = (
    <span className="flex flex-wrap gap-1">
      {chips.map((chip, index) => (
        <MetaChip key={`${index}-${chip}`}>{chip}</MetaChip>
      ))}
    </span>
  );

  const badgeLine =
    badges.length > 0 ? (
      <span className="flex flex-wrap gap-1">
        {badges.map((badge) => (
          <Tag key={badge.id} tone={badge.tone} className={cn('max-w-full', badge.tone === 'white' && 'border border-line')}>
            {badge.label}
          </Tag>
        ))}
      </span>
    ) : null;

  const title = (
    <span className={cn('font-heading line-clamp-2 break-words text-[12.5px] leading-[1.15]', closed ? 'text-slate' : 'text-ink')}>
      {closed ? <span className="sr-only">{HOUSING_STATUS_LABELS[item.status as HousingStatus] ?? 'Closed'}: </span> : null}
      {item.title}
    </span>
  );

  if (variant === 'row') {
    return (
      <article className="relative min-w-0 rounded-[14px] border border-line bg-white">
        <Link href={href} className={cn('campus-press flex min-w-0 gap-2.5 p-2 text-ink', onSave && 'pr-10')}>
          <Photo item={item} closed={closed} className="h-[76px] w-[76px]" artSize={68} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {badgeLine}
            {title}
            {priceLine}
            <Where item={item} campusCode={code} />
            {metaLine}
          </span>
        </Link>
        {saveButton}
      </article>
    );
  }

  return (
    <article className="relative min-w-0">
      <Link href={href} className="campus-press flex min-w-0 flex-col gap-1 text-ink">
        <span className="relative block">
          <Photo item={item} closed={closed} className="h-[112px] w-full" artSize={104} />
          <span
            className={cn(
              'font-heading absolute bottom-[5px] left-[5px] rounded-[6px] bg-white px-1.5 py-0.5 text-[12px] leading-[1.15] tabular-nums',
              closed ? 'text-slate line-through' : 'text-ink',
              CHIP_SHADOW,
            )}
          >
            {price.rent}
          </span>
        </span>
        {badgeLine}
        {title}
        {priceLine}
        <Where item={item} campusCode={code} />
        {metaLine}
      </Link>
      {saveButton}
    </article>
  );
}
