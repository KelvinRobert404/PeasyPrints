'use client';

import Link from 'next/link';
import { useEffect, useId, useState, type ComponentType, type ReactNode } from 'react';
import { CampusGate } from '@/components/campus/CampusGate';
import { ContactButton } from '@/components/campus/detail/ContactButton';
import { Gallery } from '@/components/campus/detail/Gallery';
import { ReportSheet } from '@/components/campus/detail/ReportSheet';
import { SaveShare } from '@/components/campus/detail/SaveShare';
import { PriceInput } from '@/components/campus/fields/PriceInput';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import {
  BedIcon,
  CalendarIcon,
  CloseIcon,
  HousingIcon,
  MinusIcon,
  PinIcon,
  PlusIcon,
  PriceDropIcon,
  SearchIcon,
  ShieldCheckIcon,
  UsersIcon,
  ClockIcon,
  type IconProps,
} from '@/components/swoop/icons';
import { HousingArt } from '@/components/swoop/illustrations';
import { EmptyState, IconButton, PageHeader, SectionHeader, Tag, swButton } from '@/components/swoop/primitives';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { HOUSE_RULE_LABELS, HOUSING_STATUS_LABELS, RENT_PERIOD_LABELS, STAY_TYPE_LABELS } from '@/lib/campus/constants';
import {
  FURNISHING_LABELS,
  HOUSING_KIND_LABELS,
  POSTED_AS_LABELS,
  RENT_TERMS,
  RENT_TERMS_LABELS,
  WHO_CAN_STAY_LABELS,
  housingPriceLabels,
  roommateChips,
} from '@/lib/campus/housing/model';
import { MAX_BEDS, type HousingPatch } from '@/lib/campus/housing/schema';
import type { SerializedHousingListing } from '@/lib/campus/housing/serialize';
import { istDateKey } from '@/lib/campus/season';
import { formatPrice } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience } from '@/types/campus';
import type { HousingStatus } from '@/types/housing';
import { housingMoveInLabel } from './HousingListingCard';

type Props = { id: string; audience?: CampusAudience };

type Listing = SerializedHousingListing;

/** Statuses the owner can still change. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(['active', 'reserved', 'needs_confirmation']);

const INCLUDE_LABELS: Record<string, string> = {
  electricity: 'electricity',
  water: 'water',
  wifi: 'wifi',
  cleaning: 'cleaning',
  laundry: 'laundry',
  maintenance: 'maintenance',
};

const CHIP = 'inline-flex min-h-[26px] max-w-full items-center rounded-full bg-surface px-2.5 py-0.5 text-[11.5px] font-semibold text-ink';

/** '7:30 pm' in IST, with 'tomorrow' when the reserve ends after midnight. */
export function reservedUntilLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Reserved for now';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  const time = `${part('hour')}:${part('minute')} ${part('dayPeriod').toLowerCase()}`;
  return istDateKey(date) === istDateKey(now) ? `Reserved until ${time}` : `Reserved until tomorrow ${time}`;
}

function termsChip(rentTerms: Listing['rentTerms']): string | null {
  if (typeof rentTerms === 'string') {
    return (RENT_TERMS as readonly string[]).includes(rentTerms) ? RENT_TERMS_LABELS[rentTerms] : null;
  }
  return RENT_PERIOD_LABELS[rentTerms.period] ?? null;
}

function termsDetail(rentTerms: Listing['rentTerms']): string[] {
  if (typeof rentTerms === 'string') return [];
  const lines: string[] = [];
  const includes = rentTerms.includes.map((entry) => INCLUDE_LABELS[entry] ?? entry);
  if (includes.length) lines.push(`Rent covers ${includes.join(', ')}`);
  if (rentTerms.noticeMonths) {
    lines.push(rentTerms.noticeMonths === 1 ? '1 month notice' : `${rentTerms.noticeMonths} months notice`);
  }
  return lines;
}

function isAgent(item: Listing): boolean {
  return item.postedAs === 'agent' || item.brokerage.charged;
}

function brokerageLabel(item: Listing): string {
  if (!item.brokerage.charged) return 'No brokerage';
  const amount = item.brokerage.amount;
  return typeof amount === 'number' && amount > 0 ? `${formatPrice(amount)} brokerage` : 'Brokerage charged';
}

function bedsLabel(beds: number): string {
  if (beds <= 0) return 'No beds left';
  return beds === 1 ? '1 bed left' : `${beds} beds left`;
}

function stayLabel(item: Listing): string {
  const stay = STAY_TYPE_LABELS[item.stayType] ?? 'Stay';
  if (!item.sharing) return stay;
  return item.sharing === 1 ? `${stay}, single room` : `${stay}, ${item.sharing} sharing`;
}

function Fact({ icon: Icon, label, value }: { icon: ComponentType<IconProps>; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[12px] bg-surface px-2.5 py-2">
      <Icon size={18} className="shrink-0 text-ink" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold text-slate">{label}</p>
        <p className="break-words text-[12px] font-bold leading-[1.2] text-ink">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <section className="pt-3.5">
      <SectionHeader title={title} kicker={kicker} />
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

type LowerRentSheetProps = {
  current: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (rentPp: number) => void;
};

/** Lower rent sheet. Only a value below the current rent can be sent. */
function LowerRentSheet({ current, busy, error, onClose, onSubmit }: LowerRentSheetProps) {
  const titleId = useId();
  const [rent, setRent] = useState<number | null>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  let problem = '';
  if (rent !== null && rent <= 0) problem = 'Rent must be above zero';
  else if (rent !== null && rent >= current) problem = `Must be lower than ${formatPrice(current, 'pp')}`;
  const ready = rent !== null && problem === '';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto w-full max-w-md rounded-[14px] bg-white p-4 shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold text-slate">Now {formatPrice(current, 'pp')}</p>
            <h2 id={titleId} className="font-heading text-[16px] leading-[1.1] text-ink">
              Lower the rent
            </h2>
          </div>
          <IconButton label="Close" icon={CloseIcon} onClick={onClose} />
        </div>
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (rent !== null && ready && !busy) onSubmit(rent);
          }}
        >
          <PriceInput value={rent} onChange={setRent} suffix="pp" label="New rent per person" placeholder="7.5k" />
          {problem || error ? (
            <p role="alert" className="mt-1.5 rounded-[12px] bg-market-tint px-3 py-2 text-[11.5px] font-bold text-market">
              {problem || error}
            </p>
          ) : null}
          <button type="submit" disabled={!ready || busy} className={cn(swButton({ variant: 'primary' }), 'mt-3 w-full')}>
            {busy ? 'Saving…' : 'Lower rent'}
          </button>
          <p className="mt-1.5 text-center text-[10.5px] font-semibold text-slate">Savers get a price drop alert.</p>
        </form>
      </section>
    </div>
  );
}

type OwnerPanelProps = {
  item: Listing;
  busy: string;
  error: string;
  onAction: (patch: HousingPatch) => Promise<boolean>;
};

function OwnerPanel({ item, busy, error, onAction }: OwnerPanelProps) {
  const [lowerOpen, setLowerOpen] = useState(false);
  const [confirmBooked, setConfirmBooked] = useState(false);
  const open = OPEN_STATUSES.has(item.status);
  const reserved = item.status === 'reserved';
  const nudge = item.needsNudge || item.status === 'needs_confirmation';
  const working = busy !== '';

  if (!open) {
    const label = HOUSING_STATUS_LABELS[item.status as HousingStatus] ?? 'Closed';
    return (
      <section className="mt-3 rounded-[14px] border border-line bg-white p-3">
        <p className="text-[10.5px] font-semibold text-slate">Only you see this</p>
        <p className="font-heading text-[14.5px] leading-[1.1] text-ink">This post is {label.toLowerCase()}</p>
        <p className="mt-1 text-[11.5px] font-semibold text-slate">Students can no longer see it.</p>
      </section>
    );
  }

  const markBooked = async () => {
    if (await onAction({ action: 'booked' })) setConfirmBooked(false);
  };

  return (
    <>
      {nudge ? (
        <section aria-labelledby="housing-nudge" className="mt-3 rounded-[14px] bg-royal p-3 text-white">
          <h2 id="housing-nudge" className="font-heading text-[16px] leading-[1.1]">
            Still available?
          </h2>
          <p className="mt-0.5 text-[12px] font-semibold text-white/90">Confirm so students keep seeing it.</p>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={working}
              onClick={() => void onAction({ action: 'confirm' })}
              className={cn(swButton({ variant: 'white' }), 'w-full')}
            >
              {busy === 'confirm' ? 'Saving…' : 'Yes, still free'}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => setConfirmBooked(true)}
              className={cn(swButton({ variant: 'ink' }), 'w-full')}
            >
              It got booked
            </button>
          </div>
        </section>
      ) : null}

      <section className="mt-3 rounded-[14px] border border-line bg-white p-3">
        <SectionHeader title="Manage your post" kicker="Only you see this" />

        <div className="mt-2 divide-y divide-line">
          {item.status === 'active' || reserved ? (
            <div className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold text-ink">
                  {reserved && item.reservedUntil ? reservedUntilLabel(item.reservedUntil) : 'Hold it for one student'}
                </p>
                <p className="text-[11px] font-semibold text-slate">{reserved ? 'Others cannot ask meanwhile.' : 'Pauses requests for 24 hours.'}</p>
              </div>
              <button
                type="button"
                disabled={working}
                onClick={() => void onAction({ action: reserved ? 'unreserve' : 'reserve' })}
                className={cn(swButton({ variant: reserved ? 'surface' : 'ink', size: 'sm' }), 'shrink-0')}
              >
                {busy === 'reserve' || busy === 'unreserve' ? 'Saving…' : reserved ? 'Unreserve' : 'Reserve 24 h'}
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-ink">Rent {formatPrice(item.rentPp, 'pp')}</p>
              <p className="text-[11px] font-semibold text-slate">Lower it to get more requests.</p>
            </div>
            <button
              type="button"
              disabled={working}
              onClick={() => setLowerOpen(true)}
              className={cn(swButton({ variant: 'surface', size: 'sm' }), 'shrink-0')}
            >
              Lower rent
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-ink">Beds left</p>
              <p className="text-[11px] font-semibold text-slate">Mark booked when all are gone.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Beds left">
              <button
                type="button"
                aria-label="One bed fewer"
                disabled={working || item.bedsLeft <= 1}
                onClick={() => void onAction({ action: 'beds', bedsLeft: item.bedsLeft - 1 })}
                className="campus-press grid h-8 w-8 place-items-center rounded-full bg-surface text-ink disabled:opacity-40"
              >
                <MinusIcon size={15} aria-hidden="true" />
              </button>
              <span aria-live="polite" className="font-heading w-6 text-center text-[15px] tabular-nums text-ink">
                {item.bedsLeft}
              </span>
              <button
                type="button"
                aria-label="One bed more"
                disabled={working || item.bedsLeft >= MAX_BEDS}
                onClick={() => void onAction({ action: 'beds', bedsLeft: item.bedsLeft + 1 })}
                className="campus-press grid h-8 w-8 place-items-center rounded-full bg-surface text-ink disabled:opacity-40"
              >
                <PlusIcon size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {confirmBooked ? (
          <div className="mt-2 rounded-[12px] bg-surface p-2.5">
            <p className="text-[12px] font-bold text-ink">Mark as booked?</p>
            <p className="text-[11px] font-semibold text-slate">Students stop seeing this post.</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button type="button" disabled={working} onClick={() => setConfirmBooked(false)} className={cn(swButton({ variant: 'white', size: 'sm' }), 'w-full')}>
                Cancel
              </button>
              <button type="button" disabled={working} onClick={() => void markBooked()} className={cn(swButton({ variant: 'ink', size: 'sm' }), 'w-full')}>
                {busy === 'booked' ? 'Saving…' : 'Yes, mark booked'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={working}
            onClick={() => setConfirmBooked(true)}
            className={cn(swButton({ variant: 'surface' }), 'mt-2 w-full')}
          >
            Mark booked
          </button>
        )}

        {error && !lowerOpen ? (
          <p role="alert" className="mt-2 rounded-[12px] bg-market-tint px-3 py-2 text-[11.5px] font-bold text-market">
            {error}
          </p>
        ) : null}
      </section>

      {lowerOpen ? (
        <LowerRentSheet
          current={item.rentPp}
          busy={busy === 'lower_price'}
          error={error}
          onClose={() => setLowerOpen(false)}
          onSubmit={async (rentPp) => {
            if (await onAction({ action: 'lower_price', rentPp })) setLowerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** Housing post detail: listing facts for students, lifecycle controls for the poster. */
export function HousingDetail({ id, audience = 'campus' }: Props) {
  const campus = useCurrentCampus();
  const [item, setItem] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const girls = audience === 'girls';
  const endpoint = girls ? `/api/girls-space/housing/${encodeURIComponent(id)}` : `/api/housing/posts/${encodeURIComponent(id)}`;
  const base = girls ? '/girls-space/housing' : '/housing';

  const refresh = async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as { item?: Listing; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || 'Post not found');
      setItem(data.item);
      setLoadError('');
    } catch (cause) {
      setLoadError((cause as Error).message || 'Post not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setItem(null);
    void refresh();
  }, [endpoint]);

  /** PATCH one lifecycle action, then refresh. True when it saved. */
  const act = async (patch: HousingPatch): Promise<boolean> => {
    if (busy) return false;
    setBusy(patch.action);
    setActionError('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await response.json().catch(() => ({}))) as { item?: Listing; error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not update the post');
      await refresh();
      return true;
    } catch (cause) {
      setActionError((cause as Error).message || 'Could not update the post');
      return false;
    } finally {
      setBusy('');
    }
  };

  const campusLabel = campus?.label ?? item?.collegeCode ?? '';
  const kicker = girls ? (campusLabel ? `Girls' space · ${campusLabel}` : "Girls' space") : campusLabel || undefined;

  return (
    <CampusGate girlsOnly={girls}>
      <div className="min-h-screen bg-white pb-3">
        <PageHeader
          title={item ? `${HOUSING_KIND_LABELS[item.kind]} post` : 'Housing post'}
          kicker={kicker}
          backHref={base}
          actions={
            item && !item.isOwner ? (
              <SaveShare contentType="housing" contentId={item.id} title={item.title} saved={item.isSaved} />
            ) : undefined
          }
        />

        {loading && !item ? (
          <div className="mx-auto max-w-xl space-y-2 px-3 pt-1" aria-hidden="true">
            <div className="aspect-[4/3] animate-pulse rounded-[14px] bg-surface" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface" />
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-surface" />
            <div className="h-24 animate-pulse rounded-[14px] bg-surface" />
          </div>
        ) : null}

        {!loading && !item ? (
          <div className="mx-auto max-w-md px-3 pt-3">
            <EmptyState
              icon={SearchIcon}
              title="This room is gone"
              body={loadError || 'Post not found'}
              action={
                <Link href={base} className={cn(swButton({ variant: 'primary', size: 'sm' }), 'mt-1')}>
                  See other rooms
                </Link>
              }
            />
          </div>
        ) : null}

        {item ? (
          <HousingBody
            item={item}
            audience={audience}
            campusCode={campus?.code ?? item.collegeCode}
            busy={busy}
            actionError={actionError}
            onAction={act}
          />
        ) : null}
      </div>
    </CampusGate>
  );
}

type BodyProps = {
  item: Listing;
  audience: CampusAudience;
  campusCode: string;
  busy: string;
  actionError: string;
  onAction: (patch: HousingPatch) => Promise<boolean>;
};

function HousingBody({ item, audience, campusCode, busy, actionError, onAction }: BodyProps) {
  const now = new Date();
  const price = housingPriceLabels({ rentPp: item.rentPp, deposit: item.deposit });
  const terms = termsChip(item.rentTerms);
  const termLines = termsDetail(item.rentTerms);
  const reserved = item.status === 'reserved';
  const closed = !OPEN_STATUSES.has(item.status);
  const dropped = item.priceDropped && item.previousRentPp !== null && item.previousRentPp > item.rentPp;
  const meters = item.distanceM ?? item.place.roughDistanceM;
  const placeLabel = item.place.label || item.place.area;
  const rules = item.houseRules.map((rule) => HOUSE_RULE_LABELS[rule]).filter(Boolean);
  const chips = item.roommate
    ? roommateChips(
        {
          moveIn: item.moveIn ? new Date(item.moveIn) : 'now',
          houseRules: item.houseRules,
          whoCanStay: item.whoCanStay,
          roommate: {
            groupSize: item.roommate.groupSize,
            languages: item.roommate.languages,
            homeState: item.roommate.homeState,
          },
        },
        now,
      )
    : [];

  return (
    <main className="mx-auto max-w-xl px-3 pt-1">
      <Gallery images={item.images} title={item.title} fallback={HousingIcon} art={<HousingArt width={150} height={138} />} />

      <section className="pt-3">
        <div className="flex flex-wrap items-center gap-1">
          <Tag tone="royal">{HOUSING_KIND_LABELS[item.kind]}</Tag>
          {reserved ? <Tag>Reserved</Tag> : null}
          {closed ? (
            <Tag tone="white" className="border border-line">
              {HOUSING_STATUS_LABELS[item.status as HousingStatus] ?? 'Closed'}
            </Tag>
          ) : null}
          {dropped && !closed ? <Tag tone="go">Price dropped</Tag> : null}
          {isAgent(item) ? (
            <Tag tone="white" className="border border-line">
              Agent listing
            </Tag>
          ) : null}
          {item.serial ? <span className="ml-auto font-mono text-[10px] font-semibold text-slate">{item.serial}</span> : null}
        </div>

        <h2 className="font-heading mt-1.5 break-words text-[16px] leading-[1.1] text-ink">{item.title}</h2>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn('font-heading text-[15px] tabular-nums', closed ? 'text-slate line-through' : 'text-ink')}>
            {price.rent}
            {price.deposit ? <span className="text-text-secondary"> · {price.deposit}</span> : null}
          </p>
          {terms ? <span className={cn(CHIP, 'min-h-[22px] text-[10.5px]')}>{terms}</span> : null}
        </div>

        {dropped ? (
          <p className="mt-1 flex items-center gap-1 text-[11.5px] font-bold text-go-text">
            <PriceDropIcon size={14} aria-hidden="true" />
            Price dropped from {formatPrice(item.previousRentPp!)}
          </p>
        ) : null}

        {reserved && item.reservedUntil ? (
          <p className="mt-1 flex items-center gap-1 text-[11.5px] font-bold text-ink">
            <ClockIcon size={14} aria-hidden="true" />
            {reservedUntilLabel(item.reservedUntil, now)}
          </p>
        ) : null}

        <div className="mt-1.5 space-y-0.5">
          <DistanceLine meters={meters} campusLabel={campusCode} />
          {placeLabel ? (
            <p className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-slate">
              <PinIcon size={13} className="shrink-0 text-ink" aria-hidden="true" />
              <span className="truncate">{placeLabel}</span>
            </p>
          ) : null}
        </div>
      </section>

      {item.isOwner ? <OwnerPanel item={item} busy={busy} error={actionError} onAction={onAction} /> : null}

      <section className="grid grid-cols-2 gap-1.5 pt-3">
        <Fact icon={CalendarIcon} label="Move in" value={housingMoveInLabel(item.moveIn, now).replace(/^Move in: /, '')} />
        <Fact icon={BedIcon} label="Beds" value={bedsLabel(item.bedsLeft)} />
        <Fact icon={UsersIcon} label="Who can stay" value={WHO_CAN_STAY_LABELS[item.whoCanStay]} />
        <Fact
          icon={HousingIcon}
          label="Stay"
          value={item.furnishing ? `${stayLabel(item)} · ${FURNISHING_LABELS[item.furnishing]}` : stayLabel(item)}
        />
      </section>

      {termLines.length ? (
        <ul className="mt-2 space-y-0.5 text-[11.5px] font-semibold text-text-secondary">
          {termLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {item.description ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-[12.5px] leading-[1.5] text-text-secondary">{item.description}</p>
      ) : null}

      <Section title="House rules">
        <div className="flex flex-wrap gap-1">
          {rules.length ? rules.map((rule) => <span key={rule} className={CHIP}>{rule}</span>) : <span className={CHIP}>No restrictions</span>}
        </div>
      </Section>

      {item.amenities.length ? (
        <Section title="What you get">
          <div className="flex flex-wrap gap-1">
            {item.amenities.map((amenity) => (
              <span key={amenity} className={CHIP}>
                {amenity}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {chips.length ? (
        <Section title="Roommate fit">
          <div className="flex flex-wrap gap-1">
            {chips.map((chip, index) => (
              <span key={`${chip.id}-${index}`} className={cn(CHIP, chip.id === 'group' && 'bg-royal-tint text-royal')}>
                {chip.label}
              </span>
            ))}
          </div>
          {item.roommate?.note ? <p className="mt-1.5 break-words text-[12px] leading-[1.45] text-text-secondary">{item.roommate.note}</p> : null}
        </Section>
      ) : null}

      <Section title="Posted by">
        <div className="flex items-center gap-2 rounded-[12px] bg-surface px-2.5 py-2">
          <ShieldCheckIcon size={20} className="shrink-0 text-go-text" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold text-ink">{item.poster.displayName}</p>
            <p className="text-[11px] font-semibold text-slate">
              {POSTED_AS_LABELS[item.postedAs]} · {brokerageLabel(item)}
            </p>
          </div>
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate">
          <ShieldCheckIcon size={13} className="shrink-0 text-ink" aria-hidden="true" />
          Only verified students
        </p>
      </Section>

      {!item.isOwner ? (
        <>
          <section className="pt-3.5">
            <ContactButton
              contentType="housing"
              contentId={item.id}
              audience={audience}
              disabledLabel={reserved ? 'Reserved for someone' : closed ? 'No longer available' : undefined}
            />
          </section>
          <ReportSheet contentType="housing" contentId={item.id} className="pt-2" />
        </>
      ) : null}
    </main>
  );
}
