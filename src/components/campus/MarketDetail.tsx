'use client';

// Market v2 detail screen, shared by /marketplace/[id] and
// /girls-space/marketplace/[id]. Reads GET /api/.../[id]; seller actions go to
// PATCH on the same route and the screen reloads after each one.

import Link from 'next/link';
import { useEffect, useId, useState, type ComponentType, type ReactNode } from 'react';
import {
  AlertIcon,
  BoxIcon,
  BusIcon,
  CabIcon,
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  CycleIcon,
  DocIcon,
  HandIcon,
  HourglassIcon,
  MarketIcon,
  MinusIcon,
  PassIcon,
  PinIcon,
  PlusIcon,
  RupeeIcon,
  ScooterIcon,
  SearchIcon,
  SeatIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketIcon,
  TrainIcon,
  UsersIcon,
  type IconProps,
} from '@/components/swoop/icons';
import { TapeStrip } from '@/components/swoop/Logo';
import { EmptyState, IconButton, IconTile, PageHeader, StatusLine, swButton, Tag } from '@/components/swoop/primitives';
import { ROOM_ART } from '@/components/swoop/illustrations-room';
import { CampusGate } from '@/components/campus/CampusGate';
import { ContactButton } from '@/components/campus/detail/ContactButton';
import { Gallery } from '@/components/campus/detail/Gallery';
import { ReportSheet } from '@/components/campus/detail/ReportSheet';
import { SaveShare } from '@/components/campus/detail/SaveShare';
import { PriceInput } from '@/components/campus/fields/PriceInput';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { bundleArtFor } from '@/components/campus/market/BundleCard';
import { formatDay, formatWhen } from '@/components/campus/market/PassRow';
import { DropTag, TermsChip, WasPrice, budgetText, priceDrop, priceText } from '@/components/campus/market/PriceBits';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import {
  GENDER_PREF_LABELS,
  MARKET_CATEGORY_LABELS,
  MARKET_KIND_LABELS,
  MARKET_STATUS_LABELS,
  PAY_ON_PICKUP,
  RESERVE_HOURS,
} from '@/lib/campus/constants';
import type { SerializedMarketListing } from '@/lib/campus/marketSerialize';
import type { MarketPatch } from '@/lib/campus/marketSchema';
import { formatPrice } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience, ContactRequest } from '@/types/campus';
import type { BundlePart, ItemCondition, MarketKind, MarketStatus, PassType, VehicleType } from '@/types/market';

type Listing = SerializedMarketListing;
type Props = { id: string; audience?: CampusAudience };

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

/** Still live: buyers can ask, sellers can act. */
const OPEN: ReadonlySet<MarketStatus> = new Set(['active', 'reserved', 'needs_confirmation']);
/** Kinds that end as booked; every other selling kind ends as sold. */
const BOOKED_KINDS: ReadonlySet<MarketKind> = new Set(['seat', 'cab_split']);
const MAX_SEATS: Partial<Record<MarketKind, number>> = { seat: 10, cab_split: 6 };
/** A contact request that still means something to the buyer. */
const LIVE_CONTACT: ReadonlySet<ContactRequest['status']> = new Set(['pending', 'approved', 'declined']);

const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good condition',
  used: 'Used',
  needs_repair: 'Needs repair',
};

const PASS_LABELS: Record<PassType, string> = {
  bus: 'Bus pass',
  metro: 'Metro pass',
  gym: 'Gym pass',
  library: 'Library pass',
  other: 'Pass',
};

const VEHICLE_LABELS: Record<VehicleType, string> = {
  cycle: 'Cycle',
  scooter: 'Scooter',
  bike: 'Bike',
  other: 'Vehicle',
};

/* Time helpers (IST, hand-rolled like PassRow so server and client agree) */

function istParts(ms: number) {
  const at = new Date(ms + IST_OFFSET_MS);
  return { day: Math.floor((ms + IST_OFFSET_MS) / DAY_MS), hours: at.getUTCHours(), minutes: at.getUTCMinutes() };
}

/** '6:30 pm' in IST. */
function clockText(ms: number): string {
  const { hours, minutes } = istParts(ms);
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
}

/** '6:30 pm', 'tomorrow 9:00 am', or the full day for anything later. */
function untilText(iso: string | null, now: number): string {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(ms)) return `${RESERVE_HOURS} h`;
  const gap = istParts(ms).day - istParts(now).day;
  if (gap <= 0) return clockText(ms);
  if (gap === 1) return `tomorrow ${clockText(ms)}`;
  return formatWhen(iso);
}

/** 'Reserved till 6:30 pm'. */
function reservedLabel(listing: Listing, now: number): string {
  return `Reserved till ${untilText(listing.reservedUntil, now)}`;
}

function daysLeftText(iso: string | null, now: number): string | null {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(ms)) return null;
  const days = Math.ceil((ms - now) / DAY_MS);
  if (days <= 0) return 'Ended';
  if (days === 1) return 'Last day';
  return `${days} days left`;
}

function seatsText(n: number): string {
  if (n <= 0) return 'No seats left';
  return n === 1 ? '1 seat left' : `${n} seats left`;
}

function isSold(part: BundlePart): boolean {
  return (part as BundlePart & { sold?: unknown }).sold === true;
}

/** A field the create route stores but the shared type does not name yet. */
function extra(details: object, key: string): unknown {
  return (details as Record<string, unknown>)[key];
}

/* Kind meta */

type Fact = { icon: ComponentType<IconProps>; title: string; sub?: string | null };

function kindIcon(listing: Listing): ComponentType<IconProps> {
  const d = listing.details;
  switch (d.kind) {
    case 'vehicle':
      return d.vehicleType === 'cycle' ? CycleIcon : ScooterIcon;
    case 'ticket':
      return TicketIcon;
    case 'pass':
      return d.passType === 'bus' ? BusIcon : d.passType === 'metro' ? TrainIcon : PassIcon;
    case 'seat':
      return SeatIcon;
    case 'cab_split':
      return CabIcon;
    case 'wanted':
      return HandIcon;
    case 'bundle':
      return BoxIcon;
    default:
      return MarketIcon;
  }
}

function genderFact(listing: Listing): Fact {
  return { icon: UsersIcon, title: GENDER_PREF_LABELS[listing.genderPref] };
}

function kindFacts(listing: Listing, now: number): Fact[] {
  const d = listing.details;
  const facts: Fact[] = [];
  switch (d.kind) {
    case 'item':
      if (d.condition) facts.push({ icon: SparklesIcon, title: CONDITION_LABELS[d.condition], sub: d.brand });
      else if (d.brand) facts.push({ icon: SparklesIcon, title: d.brand });
      break;
    case 'wanted':
      facts.push({ icon: RupeeIcon, title: budgetText(d.budgetMax) });
      if (d.neededBy) facts.push({ icon: CalendarIcon, title: `Needed by ${formatDay(d.neededBy)}` });
      break;
    case 'bundle':
      facts.push({ icon: BoxIcon, title: d.splitOk ? 'Things sold one by one too' : 'Sold as one lot' });
      break;
    case 'seat': {
      const ends = d.endsAt && Number.isFinite(Date.parse(d.endsAt)) ? `Till ${untilText(d.endsAt, Date.parse(d.startsAt ?? d.endsAt))}` : null;
      facts.push({ icon: SeatIcon, title: d.seatFor, sub: d.startsAt ? formatWhen(d.startsAt) : 'Time not set' });
      if (ends) facts.push({ icon: ClockIcon, title: ends });
      facts.push({ icon: UsersIcon, title: seatsText(d.seatsLeft), sub: GENDER_PREF_LABELS[listing.genderPref] });
      return facts;
    }
    case 'cab_split':
      facts.push({ icon: CabIcon, title: `${d.from} to ${d.to}`, sub: `Leaves ${formatWhen(d.leavesAt)}` });
      facts.push({ icon: UsersIcon, title: seatsText(d.seatsLeft), sub: GENDER_PREF_LABELS[listing.genderPref] });
      if (typeof d.totalFare === 'number' && d.totalFare > 0) facts.push({ icon: RupeeIcon, title: `Whole cab ${formatPrice(d.totalFare)}` });
      return facts;
    case 'ticket': {
      facts.push({ icon: TicketIcon, title: `Showtime ${formatWhen(d.happensAt)}`, sub: d.venue });
      facts.push({ icon: HourglassIcon, title: d.quantity > 1 ? `${d.quantity} tickets` : '1 ticket', sub: 'Ends at showtime' });
      const face = extra(d, 'faceValue');
      if (typeof face === 'number' && face > 0) facts.push({ icon: RupeeIcon, title: `Face value ${formatPrice(face)}`, sub: 'Never sold above face value' });
      break;
    }
    case 'pass': {
      const left = daysLeftText(d.validUntil, now);
      facts.push({ icon: PassIcon, title: PASS_LABELS[d.passType], sub: d.validUntil ? `Valid till ${formatDay(d.validUntil)}` : 'No end date' });
      if (left) facts.push({ icon: HourglassIcon, title: left });
      break;
    }
    case 'vehicle': {
      const bits = [d.year ? String(d.year) : null, typeof d.kmDriven === 'number' ? `${d.kmDriven.toLocaleString('en-IN')} km` : null];
      facts.push({
        icon: d.vehicleType === 'cycle' ? CycleIcon : ScooterIcon,
        title: `${VEHICLE_LABELS[d.vehicleType]} for ${d.offer === 'rent' ? 'rent' : 'sale'}`,
        sub: bits.filter(Boolean).join(' · ') || null,
      });
      const plate = extra(d, 'plateState');
      if (typeof plate === 'string' && plate) facts.push({ icon: DocIcon, title: plate === 'BH' ? 'Bharat series plate' : `${plate} plate` });
      if (d.papersOk === true) facts.push({ icon: ShieldCheckIcon, title: 'RC and insurance in order' });
      else if (d.papersOk === false) facts.push({ icon: AlertIcon, title: 'RC or insurance not ready' });
      break;
    }
  }
  if (listing.genderPref !== 'anyone') facts.push(genderFact(listing));
  return facts;
}

/* Small pieces */

function FactRow({ fact }: { fact: Fact }) {
  return (
    <li className="flex min-h-[44px] items-center gap-2.5 border-b border-line py-1.5 last:border-b-0">
      <IconTile icon={fact.icon} size={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold text-ink">{fact.title}</span>
        {fact.sub ? <span className="block truncate text-[11px] text-slate">{fact.sub}</span> : null}
      </span>
    </li>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mt-2.5 rounded-[12px] px-3 py-2 text-[11.5px] font-bold',
        tone === 'error' ? 'bg-market-tint text-market' : 'bg-go-tint text-go-text',
      )}
    >
      {children}
    </p>
  );
}

/* Screen */

export function MarketDetail({ id, audience = 'campus' }: Props) {
  const campus = useCurrentCampus();
  const [listing, setListing] = useState<Listing | null>(null);
  const [contact, setContact] = useState<ContactRequest | null>(null);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [priceOpen, setPriceOpen] = useState(false);

  const endpoint = audience === 'girls' ? `/api/girls-space/marketplace/${id}` : `/api/marketplace/listings/${id}`;
  const base = audience === 'girls' ? '/girls-space/marketplace' : '/marketplace';

  const loadContact = async () => {
    try {
      const response = await fetch(`/api/contact-requests?role=buyer&audience=${audience}`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { items?: ContactRequest[] };
      const mine = (data.items ?? []).find((entry) => entry.contentType === 'marketplace' && entry.contentId === id) ?? null;
      setContact(mine && LIVE_CONTACT.has(mine.status) ? mine : null);
    } catch {
      // The ask button still works; its POST reports real problems.
    }
  };

  const load = async (withContact = true) => {
    setLoadError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as { item?: Listing; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || 'Post not found');
      setListing(data.item);
      setNow(Date.now());
      if (withContact && !data.item.isOwner) await loadContact();
    } catch (cause) {
      setLoadError((cause as Error).message || 'Post not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setListing(null);
    void load();
  }, [endpoint]);

  /** Sends one seller action, then reloads. Returns true when it went through. */
  const act = async (patch: MarketPatch, done: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(patch.action);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not update the post');
      await load(false);
      setNotice(done);
      return true;
    } catch (cause) {
      setError((cause as Error).message || 'Could not update the post');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const campusLabel = campus?.label ?? listing?.collegeCode ?? 'Your campus';
  const campusCode = campus?.code ?? listing?.collegeCode ?? 'campus';
  const kicker = audience === 'girls' ? `Girls’ space · ${campusLabel}` : campusLabel;

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="min-h-screen bg-white pb-3">
        <PageHeader
          title={listing ? MARKET_KIND_LABELS[listing.kind] : 'Market'}
          kicker={kicker}
          backHref={base}
          actions={
            listing && !listing.isOwner ? (
              <SaveShare contentType="marketplace" contentId={listing.id} title={listing.title} saved={listing.isSaved} />
            ) : undefined
          }
        />

        {loading && !listing ? (
          <div className="mx-auto max-w-xl space-y-2 px-3 pt-1" aria-hidden="true">
            <div className="aspect-[4/3] animate-pulse rounded-[14px] bg-surface" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface" />
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-surface" />
            <div className="h-24 animate-pulse rounded-[14px] bg-surface" />
          </div>
        ) : null}

        {loadError && !listing ? (
          <div className="mx-auto max-w-md px-3 pt-3">
            <EmptyState
              icon={SearchIcon}
              title="This post is gone"
              body={loadError}
              action={
                <Link href={base} className={cn(swButton({ variant: 'primary', size: 'sm' }), 'mt-1')}>
                  Back to market
                </Link>
              }
            />
          </div>
        ) : null}

        {listing ? (
          <main className="mx-auto max-w-xl px-3 pt-1">
            <ListingBody listing={listing} now={now} campusCode={campusCode} busy={busy} act={act} />

            {listing.isOwner ? (
              <OwnerPanel listing={listing} now={now} busy={busy} act={act} onLowerPrice={() => setPriceOpen(true)} />
            ) : (
              <BuyerCta listing={listing} now={now} audience={audience} contact={contact} onAsked={loadContact} />
            )}

            {error ? <Notice tone="error">{error}</Notice> : null}
            {notice ? <Notice tone="ok">{notice}</Notice> : null}

            {!listing.isOwner ? <ReportSheet contentType="marketplace" contentId={listing.id} className="mt-3" /> : null}
          </main>
        ) : null}

        {listing && priceOpen ? (
          <LowerPriceSheet listing={listing} busy={busy === 'lower_price'} onClose={() => setPriceOpen(false)} act={act} />
        ) : null}
      </div>
    </CampusGate>
  );
}

type Act = (patch: MarketPatch, done: string) => Promise<boolean>;

/* Photos, price, kind meta, place, pay line and trust row */

function ListingBody({
  listing,
  now,
  campusCode,
  busy,
  act,
}: {
  listing: Listing;
  now: number;
  campusCode: string;
  busy: string | null;
  act: Act;
}) {
  const d = listing.details;
  const open = OPEN.has(listing.status);
  const gone = !open;
  const drop = now > 0 && open ? priceDrop(listing, now) : null;
  const facts = kindFacts(listing, now || Date.parse(listing.updatedAt));
  const Art = d.kind === 'bundle' ? ROOM_ART[bundleArtFor(listing, d.parts)] : null;
  const suffix = listing.priceTerms === 'per_person' ? 'pp' : undefined;
  const sellerName = listing.seller.displayName || 'Student';

  return (
    <>
      <div className="relative overflow-hidden rounded-[14px]">
        <Gallery
          images={listing.images}
          title={listing.title}
          fallback={kindIcon(listing)}
          art={Art ? <Art width={132} height={121} /> : undefined}
          className={gone ? 'opacity-70' : undefined}
        />
        {listing.status === 'sold' ? (
          <TapeStrip word="sold" className="absolute -left-4 -right-4 top-[44%] text-[13px]" style={{ transform: 'rotate(-10deg)' }} />
        ) : null}
      </div>

      <section className="pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag>{MARKET_KIND_LABELS[listing.kind]}</Tag>
          {listing.kind === 'item' || listing.kind === 'bundle' || listing.kind === 'wanted' ? (
            <span className="text-[10.5px] font-semibold text-slate">{MARKET_CATEGORY_LABELS[listing.category]}</span>
          ) : null}
          {listing.serial ? <span className="ml-auto font-mono text-[10px] font-semibold text-slate">{listing.serial}</span> : null}
        </div>
        <h2 className="font-heading mt-1.5 text-[16px] leading-[1.1] text-ink">{listing.title}</h2>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className={cn('font-heading whitespace-nowrap text-[15px] leading-[1.1] tabular-nums', gone ? 'text-slate line-through' : 'text-ink')}>
            {d.kind === 'wanted' ? budgetText(d.budgetMax) : priceText(listing, d.kind === 'bundle' ? 'Priced per thing' : 'Ask price')}
          </span>
          {drop ? (
            <>
              <WasPrice was={formatPrice(listing.previousPrice ?? 0, suffix)} className="text-[12px]" />
              <DropTag />
            </>
          ) : null}
          {d.kind !== 'wanted' ? <TermsChip terms={listing.priceTerms} price={listing.price} /> : null}
        </div>

        <div className="mt-1.5">
          <StatusLine
            open={listing.status === 'active'}
            label={MARKET_STATUS_LABELS[listing.status] ?? listing.status}
            detail={listing.status === 'reserved' && now > 0 ? `Till ${untilText(listing.reservedUntil, now)}` : undefined}
          />
        </div>

        {listing.description ? (
          <p className="mt-2.5 whitespace-pre-wrap text-[12.5px] leading-[1.5] text-text-secondary">{listing.description}</p>
        ) : null}
      </section>

      {facts.length ? (
        <section className="pt-3" aria-label="Details">
          <ul>
            {facts.map((fact, index) => (
              <FactRow key={`${fact.title}-${index}`} fact={fact} />
            ))}
          </ul>
        </section>
      ) : null}

      {d.kind === 'bundle' ? (
        <BundleList listing={listing} parts={d.parts} busy={busy} act={act} />
      ) : null}

      <section className="pt-3" aria-label="Pickup">
        {listing.place && (listing.place.label || listing.place.area) ? (
          <div className="flex items-start gap-2.5">
            <IconTile icon={PinIcon} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-ink">{listing.place.label || listing.place.area}</p>
              {listing.place.label && listing.place.area ? <p className="truncate text-[11px] text-slate">{listing.place.area}</p> : null}
              <DistanceLine meters={listing.distanceM} campusLabel={campusCode} className="mt-0.5" />
            </div>
          </div>
        ) : (
          <DistanceLine meters={listing.distanceM} campusLabel={campusCode} />
        )}
        <p className="mt-2 flex items-center gap-1.5 rounded-[12px] bg-surface px-3 py-2 text-[11.5px] font-bold text-ink">
          <RupeeIcon size={14} className="shrink-0 text-royal" aria-hidden="true" />
          {PAY_ON_PICKUP}: UPI or cash
        </p>
      </section>

      <section className="mt-3 flex items-center gap-2.5 border-y border-line py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-extrabold text-white" aria-hidden="true">
          {sellerName.charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold text-ink">{listing.isOwner ? 'You posted this' : sellerName}</span>
          <span className="block truncate text-[11px] text-slate">Verified {listing.collegeCode || campusCode} student</span>
        </span>
        <ShieldCheckIcon size={16} className="shrink-0 text-royal" aria-hidden="true" />
      </section>
    </>
  );
}

/* Bundle things, each with its own Sold state. Sellers mark them one by one. */

function BundleList({ listing, parts, busy, act }: { listing: Listing; parts: readonly BundlePart[]; busy: string | null; act: Act }) {
  const soldCount = parts.filter(isSold).length;
  const canMark = Boolean(listing.isOwner) && OPEN.has(listing.status);
  return (
    <section className="pt-3" aria-label="Things in this bundle">
      <div className="flex items-end justify-between gap-2">
        <h3 className="font-heading text-[14.5px] leading-[1.1] text-ink">What is in it</h3>
        <span className="text-[11px] font-semibold text-slate">
          {parts.length === 1 ? '1 thing' : `${parts.length} things`}
          {soldCount ? `, ${soldCount} sold` : ''}
        </span>
      </div>
      <ul className="mt-1">
        {parts.map((part, index) => {
          const sold = isSold(part);
          return (
            <li key={`${part.title}-${index}`} className="flex min-h-[40px] items-center gap-2 border-b border-line py-1 last:border-b-0">
              <span className={cn('min-w-0 flex-1 truncate text-[12.5px] font-semibold', sold ? 'text-slate line-through' : 'text-ink')}>{part.title}</span>
              <span className={cn('shrink-0 text-[12px] font-bold tabular-nums', sold ? 'text-slate' : 'text-ink')}>
                {typeof part.price === 'number' && part.price > 0 ? formatPrice(part.price) : 'In the lot'}
              </span>
              {sold ? (
                <Tag>Sold</Tag>
              ) : canMark ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void act({ action: 'bundle_item_sold', partIndex: index }, `${part.title} marked sold`)}
                  className={cn(swButton({ variant: 'white', size: 'sm' }), 'h-7 px-2.5 text-[11px]')}
                >
                  {busy === 'bundle_item_sold' ? 'Saving…' : 'Mark sold'}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* Buyer CTA: 'I have this' on wanted posts, else 'Ask for WhatsApp'. */

function BuyerCta({
  listing,
  now,
  audience,
  contact,
  onAsked,
}: {
  listing: Listing;
  now: number;
  audience: CampusAudience;
  contact: ContactRequest | null;
  onAsked: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const full = cn(swButton({ variant: 'primary', size: 'lg' }), 'w-full');
  const muted = cn(swButton({ variant: 'surface', size: 'lg' }), 'w-full text-text-secondary disabled:opacity-100');

  if (!OPEN.has(listing.status)) {
    return (
      <section className="mt-3">
        <button type="button" disabled className={muted}>
          {MARKET_STATUS_LABELS[listing.status] ?? 'No longer available'}
        </button>
        <p className="mt-1.5 text-center text-[10.5px] font-semibold text-slate">This one is gone.</p>
      </section>
    );
  }

  if (listing.status === 'reserved' && !listing.reservedByViewer) {
    return (
      <section className="mt-3">
        <ContactButton contentType="marketplace" contentId={listing.id} audience={audience} disabledLabel={reservedLabel(listing, now || Date.now())} />
      </section>
    );
  }

  if (contact) {
    return (
      <section className="mt-3">
        <ContactButton key={contact.id} contentType="marketplace" contentId={listing.id} audience={audience} initialContact={contact} />
      </section>
    );
  }

  const ask = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contact-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'marketplace', contentId: listing.id }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not send the request');
      await onAsked();
    } catch (cause) {
      setError((cause as Error).message || 'Could not send the request');
    } finally {
      setBusy(false);
    }
  };

  const wanted = listing.kind === 'wanted';
  return (
    <section className="mt-3">
      <button type="button" disabled={busy} onClick={() => void ask()} className={full}>
        {wanted ? <HandIcon size={18} aria-hidden="true" /> : null}
        {busy ? 'Sending…' : wanted ? 'I have this' : 'Ask for WhatsApp'}
      </button>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <p className="mt-1.5 text-center text-[10.5px] font-semibold text-slate">
        {wanted ? 'They decide to share their number.' : 'The seller decides to share their number.'}
      </p>
    </section>
  );
}

/* Owner panel: the actions depend on the kind. */

function OwnerPanel({
  listing,
  now,
  busy,
  act,
  onLowerPrice,
}: {
  listing: Listing;
  now: number;
  busy: string | null;
  act: Act;
  onLowerPrice: () => void;
}) {
  const kind = listing.kind;
  const status = listing.status;
  const open = OPEN.has(status);
  const wanted = kind === 'wanted';
  const booked = BOOKED_KINDS.has(kind);
  const nudge = status === 'needs_confirmation';
  const canLower = !wanted && typeof listing.price === 'number' && listing.price > 0;
  const btn = (variant: 'primary' | 'white' | 'danger') => cn(swButton({ variant, size: 'md' }), 'w-full');
  const label = (action: string, text: string) => (busy === action ? 'Saving…' : text);
  const disabled = busy !== null;

  if (!open) {
    return (
      <section className="mt-3 rounded-[14px] bg-surface p-3">
        <p className="font-heading text-[14.5px] leading-[1.1] text-ink">Your post</p>
        <p className="mt-0.5 text-[11.5px] text-text-secondary">
          {status === 'expired' ? 'This post has ended.' : `Marked ${(MARKET_STATUS_LABELS[status] ?? status).toLowerCase()}. Buyers no longer see it.`}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-[14px] bg-surface p-3" aria-label="Your post">
      <p className="font-heading text-[14.5px] leading-[1.1] text-ink">{nudge ? 'Still available?' : 'Your post'}</p>
      <p className="mt-0.5 text-[11.5px] text-text-secondary">
        {nudge
          ? 'Confirm to keep it showing.'
          : status === 'reserved'
            ? `${reservedLabel(listing, now || Date.now())}. Buyers cannot ask yet.`
            : 'Keep it fresh so buyers trust it.'}
      </p>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void act({ action: 'still_available' }, 'Thanks. It stays up for a week.')}
          className={btn(nudge ? 'primary' : 'white')}
        >
          {label('still_available', 'Still available')}
        </button>

        {wanted ? (
          <button type="button" disabled={disabled} onClick={() => void act({ action: 'close' }, 'Post closed')} className={btn('white')}>
            {label('close', 'Got it, close post')}
          </button>
        ) : booked ? (
          <button type="button" disabled={disabled} onClick={() => void act({ action: 'booked' }, 'Marked booked')} className={btn(nudge ? 'white' : 'primary')}>
            {label('booked', 'Mark booked')}
          </button>
        ) : (
          <button type="button" disabled={disabled} onClick={() => void act({ action: 'sold' }, 'Marked sold')} className={btn(nudge ? 'white' : 'primary')}>
            {label('sold', 'Mark sold')}
          </button>
        )}

        {!wanted && status === 'active' ? (
          <button type="button" disabled={disabled} onClick={() => void act({ action: 'reserve' }, `Reserved for ${RESERVE_HOURS} h`)} className={btn('white')}>
            {label('reserve', `Reserve ${RESERVE_HOURS} h`)}
          </button>
        ) : null}
        {!wanted && status === 'reserved' ? (
          <button type="button" disabled={disabled} onClick={() => void act({ action: 'unreserve' }, 'Open to buyers again')} className={btn('white')}>
            {label('unreserve', 'Unreserve')}
          </button>
        ) : null}

        {canLower ? (
          <button type="button" disabled={disabled} onClick={onLowerPrice} className={btn('white')}>
            Lower price
          </button>
        ) : null}
      </div>

      {listing.details.kind === 'seat' || listing.details.kind === 'cab_split' ? (
        <SeatsStepper
          key={`${listing.details.seatsLeft}-${listing.updatedAt}`}
          initial={listing.details.seatsLeft}
          max={MAX_SEATS[kind] ?? 6}
          busy={busy}
          act={act}
        />
      ) : null}

      {listing.details.kind === 'bundle' ? (
        <p className="mt-2 text-[11px] font-semibold text-slate">Sold one thing? Tap Mark sold next to it.</p>
      ) : null}
    </section>
  );
}

function SeatsStepper({ initial, max, busy, act }: { initial: number; max: number; busy: string | null; act: Act }) {
  const [seats, setSeats] = useState(Math.min(Math.max(initial, 0), max));
  const changed = seats !== initial;
  const step = 'campus-press grid h-8 w-8 place-items-center rounded-full bg-white text-ink disabled:opacity-45';
  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-[12px] bg-white px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold text-ink">Seats left</span>
        <span className="block text-[10.5px] font-semibold text-slate">{seats === 0 ? 'Zero marks it booked' : 'Update after each booking'}</span>
      </span>
      <button type="button" aria-label="One seat fewer" disabled={seats <= 0 || busy !== null} onClick={() => setSeats(seats - 1)} className={cn(step, 'border border-line')}>
        <MinusIcon size={14} />
      </button>
      <span className="w-6 text-center text-[14px] font-bold tabular-nums text-ink" aria-live="polite">
        {seats}
      </span>
      <button type="button" aria-label="One seat more" disabled={seats >= max || busy !== null} onClick={() => setSeats(seats + 1)} className={cn(step, 'border border-line')}>
        <PlusIcon size={14} />
      </button>
      <button
        type="button"
        disabled={!changed || busy !== null}
        onClick={() => void act({ action: 'seats_left', seatsLeft: seats }, seats === 0 ? 'All seats gone. Marked booked.' : `${seatsText(seats)}`)}
        className={swButton({ variant: 'primary', size: 'sm' })}
      >
        {busy === 'seats_left' ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

/* Lower price sheet */

function LowerPriceSheet({ listing, busy, onClose, act }: { listing: Listing; busy: boolean; onClose: () => void; act: Act }) {
  const titleId = useId();
  const current = listing.price ?? 0;
  const suffix = listing.priceTerms === 'per_person' ? 'pp' : undefined;
  const [price, setPrice] = useState<number | null>(null);
  const tooHigh = price !== null && price >= current;
  const valid = price !== null && price >= 1 && !tooHigh;

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const save = async () => {
    if (price === null || !valid || busy) return;
    const ok = await act({ action: 'lower_price', price }, `Now ${formatPrice(price, suffix)}. Savers get told.`);
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="mx-auto w-full max-w-md rounded-[14px] bg-white p-4 shadow-[0_8px_30px_rgba(16,24,40,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold text-slate">Now {formatPrice(current, suffix)}</p>
            <h2 id={titleId} className="font-heading text-[16px] leading-[1.1] text-ink">
              Lower the price
            </h2>
          </div>
          <IconButton label="Close" icon={CloseIcon} onClick={onClose} />
        </div>
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <PriceInput label="New price" value={price} onChange={setPrice} suffix={suffix} />
          {tooHigh ? <p className="mt-1 text-[11px] font-bold text-market">Pick a price below {formatPrice(current, suffix)}.</p> : null}
          <button type="submit" disabled={!valid || busy} className={cn(swButton({ variant: 'primary' }), 'mt-3 w-full')}>
            {busy ? 'Saving…' : 'Lower price'}
          </button>
          <p className="mt-1.5 text-center text-[10.5px] font-semibold text-slate">People who saved it get a nudge.</p>
        </form>
      </section>
    </div>
  );
}
