'use client';

// The seller's own market posts on /campus/activity: the "Still available?"
// card (no push needed), the reserve countdown with Unreserve, a Lower price
// shortcut and "Bring it back" for hidden posts. The small pieces below
// (status tag, countdown, lower-price form) are shared with HousingMyPosts.

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { PriceInput } from '@/components/campus/fields/PriceInput';
import { priceText } from '@/components/campus/market/PriceBits';
import {
  BoxIcon,
  CabIcon,
  ClockIcon,
  CycleIcon,
  HandIcon,
  MarketIcon,
  PassIcon,
  PriceDropIcon,
  ScooterIcon,
  SeatIcon,
  TicketIcon,
  type IconProps,
} from '@/components/swoop/icons';
import { Card, EmptyState, IconTile, SectionHeader, Tag, swButton } from '@/components/swoop/primitives';
import { stillAvailableDue, type ListingStatus } from '@/lib/campus/listingRules';
import type { SerializedMarketListing } from '@/lib/campus/marketSerialize';
import { formatPrice, type PriceSuffix } from '@/lib/format/price';
import type { CampusAudience } from '@/types/campus';
import type { MarketKind } from '@/types/market';

/* Shared pieces (market and housing) ------------------------------------- */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Re-renders every minute so countdowns and "due" checks stay fresh. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** '18 h left', '40 min left', or null once the reserve has run out. */
export function reserveLeftText(reservedUntil: string | null, now: number): string | null {
  if (!reservedUntil) return null;
  const left = Date.parse(reservedUntil) - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  if (left >= HOUR_MS) return `${Math.floor(left / HOUR_MS)} h left`;
  return `${Math.max(1, Math.ceil(left / MINUTE_MS))} min left`;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Live',
  reserved: 'Reserved',
  needs_confirmation: 'Hidden',
  booked: 'Booked',
  sold: 'Sold',
  filled: 'Filled',
  expired: 'Expired',
  closed: 'Closed',
  removed: 'Removed',
};

/** Sentence-case status tag: Live, Reserved, Booked, Sold, Hidden. */
export function PostStatusTag({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? 'Closed';
  if (status === 'active') return <Tag tone="go">{label}</Tag>;
  if (status === 'reserved') return <Tag tone="royal">{label}</Tag>;
  if (status === 'needs_confirmation') return <Tag className="bg-market-tint text-market">{label}</Tag>;
  return <Tag className="bg-surface text-text-secondary">{label}</Tag>;
}

/** Thumbnail: the student's own photo, else an icon tile. */
export function PostThumb({ image, icon }: { image: string | undefined; icon: ComponentType<IconProps> }) {
  if (image) return <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-[10px] bg-surface object-cover" />;
  return <IconTile icon={icon} shape="square" size={48} iconSize={22} />;
}

/** One post: thumbnail, title link, status line, then its action strip. */
export function MyPostShell({
  href,
  thumb,
  title,
  status,
  detail,
  error,
  children,
}: {
  href: string;
  thumb: ReactNode;
  title: string;
  status: string;
  detail: ReactNode;
  error: string | null;
  children?: ReactNode;
}) {
  return (
    <Card className="p-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {thumb}
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-[12.5px] font-bold text-ink hover:underline">
            {title}
          </Link>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate">
            <PostStatusTag status={status} />
            <span className="min-w-0 truncate">{detail}</span>
          </div>
        </div>
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-[11px] font-semibold text-market">
          {error}
        </p>
      )}
    </Card>
  );
}

/** "Still available?" with Yes and Sold (or Booked). */
export function StillAvailableCard({
  doneLabel,
  busy,
  onYes,
  onDone,
}: {
  doneLabel: string;
  busy: boolean;
  onYes: () => void;
  onDone: () => void;
}) {
  return (
    <div className="mt-2 flex min-w-0 items-center gap-2 rounded-[10px] bg-royal-tint px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-ink">Still available?</p>
        <p className="truncate text-[10.5px] text-slate">Keeps your post near the top</p>
      </div>
      <button type="button" disabled={busy} onClick={onDone} className={swButton({ variant: 'white', size: 'sm' })}>
        {doneLabel}
      </button>
      <button type="button" disabled={busy} onClick={onYes} className={swButton({ size: 'sm' })}>
        Yes
      </button>
    </div>
  );
}

/** Hidden post: one tap to show it again. */
export function BringBackStrip({ busy, onBringBack }: { busy: boolean; onBringBack: () => void }) {
  return (
    <div className="mt-2 flex min-w-0 items-center gap-2 rounded-[10px] bg-market-tint px-2.5 py-2">
      <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-market">Hidden from the feed for now</p>
      <button type="button" disabled={busy} onClick={onBringBack} className={swButton({ size: 'sm' })}>
        Bring it back
      </button>
    </div>
  );
}

/** Reserve countdown with Unreserve. */
export function ReservedStrip({ left, busy, onUnreserve }: { left: string; busy: boolean; onUnreserve: () => void }) {
  return (
    <div className="mt-2 flex min-w-0 items-center gap-2 rounded-[10px] bg-surface px-2.5 py-2">
      <ClockIcon size={14} className="shrink-0 text-royal" />
      <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink">Reserved, {left}</p>
      <button type="button" disabled={busy} onClick={onUnreserve} className={swButton({ variant: 'white', size: 'sm' })}>
        Unreserve
      </button>
    </div>
  );
}

/** Lower price shortcut: a small button that opens a price box. */
export function LowerPriceShortcut({
  current,
  suffix,
  label = 'New price',
  busy,
  onSave,
}: {
  current: number;
  suffix?: PriceSuffix;
  label?: string;
  busy: boolean;
  onSave: (price: number) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const valid = price !== null && Number.isInteger(price) && price > 0 && price < current;

  if (!open) {
    return (
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className={swButton({ variant: 'surface', size: 'sm' })}>
          <PriceDropIcon size={13} />
          Lower price
        </button>
      </div>
    );
  }

  const save = async () => {
    if (!valid || price === null) return;
    if (await onSave(price)) {
      setOpen(false);
      setPrice(null);
    }
  };

  return (
    <div className="mt-2 rounded-[10px] bg-surface p-2.5">
      <PriceInput value={price} onChange={setPrice} suffix={suffix} label={label} />
      <p className="mt-1 text-[10.5px] text-slate">Now {formatPrice(current, suffix)}. Savers get told.</p>
      <div className="mt-2 flex justify-end gap-1.5">
        <button type="button" onClick={() => { setOpen(false); setPrice(null); }} className={swButton({ variant: 'white', size: 'sm' })}>
          Cancel
        </button>
        <button type="button" disabled={busy || !valid} onClick={() => void save()} className={swButton({ size: 'sm' })}>
          Save
        </button>
      </div>
    </div>
  );
}

/** Section title with a count, as on the rest of the activity page. */
export function MyPostsSection({ title, count, children }: { title: string; count: number | null; children: ReactNode }) {
  return (
    <section className="pt-3.5">
      <div className="flex items-end justify-between gap-3">
        <SectionHeader className="min-w-0" title={title} />
        {count !== null && <span className="shrink-0 text-[11px] font-semibold text-slate">{count}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/** PATCH helper: resolves to an error line, or null on success. */
export async function patchPost(url: string, body: Record<string, unknown>): Promise<string | null> {
  try {
    const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (response.ok) return null;
    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return typeof data?.error === 'string' && data.error ? data.error : 'Could not update. Try again.';
  } catch {
    return 'You look offline. Try again.';
  }
}

/* Market ------------------------------------------------------------------ */

const KIND_ICONS: Partial<Record<MarketKind, ComponentType<IconProps>>> = {
  wanted: HandIcon,
  bundle: BoxIcon,
  seat: SeatIcon,
  cab_split: CabIcon,
  ticket: TicketIcon,
  pass: PassIcon,
};

function iconFor(item: SerializedMarketListing): ComponentType<IconProps> {
  if (item.details?.kind === 'vehicle') return item.details.vehicleType === 'cycle' ? CycleIcon : ScooterIcon;
  return KIND_ICONS[item.kind] ?? MarketIcon;
}

/** Seats and cab splits end as booked, wanted posts close, the rest sell. */
function doneAction(kind: MarketKind): { action: 'sold' | 'booked' | 'close'; label: string } {
  if (kind === 'seat' || kind === 'cab_split') return { action: 'booked', label: 'Booked' };
  if (kind === 'wanted') return { action: 'close', label: 'Found it' };
  return { action: 'sold', label: 'Sold' };
}

/** Due 3 days after the last confirm (or the post date), while live. */
export function marketPostDue(item: SerializedMarketListing, now: number): boolean {
  return stillAvailableDue(
    {
      status: item.status as ListingStatus,
      reservedUntil: item.reservedUntil,
      hardExpiresAt: item.hardExpiresAt,
      availabilityExpiresAt: item.availabilityExpiresAt,
      createdAt: item.createdAt,
      lastConfirmedAt: item.confirmedAt,
    },
    now,
  );
}

const STATUS_ORDER: Record<string, number> = { needs_confirmation: 0, active: 1, reserved: 2 };

function sortPosts(items: SerializedMarketListing[], now: number): SerializedMarketListing[] {
  const rank = (item: SerializedMarketListing) => (marketPostDue(item, now) ? -1 : STATUS_ORDER[item.status] ?? 3);
  return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
}

export function MarketMyPosts({ audience }: { audience: CampusAudience }) {
  const [items, setItems] = useState<SerializedMarketListing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const now = useMinuteClock();
  const base = audience === 'girls' ? '/api/girls-space/marketplace' : '/api/marketplace/listings';

  const load = async () => {
    try {
      const response = await fetch(`${base}?mine=1`, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { items?: SerializedMarketListing[] };
      setItems(data.items ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
      setItems((current) => current ?? []);
    }
  };

  useEffect(() => {
    setItems(null);
    void load();
  }, [base]);

  const act = async (id: string, body: Record<string, unknown>): Promise<boolean> => {
    setBusyId(id);
    const error = await patchPost(`${base}/${id}`, body);
    setErrors((current) => {
      const next = { ...current };
      if (error) next[id] = error;
      else delete next[id];
      return next;
    });
    if (!error) await load();
    setBusyId(null);
    return error === null;
  };

  const list = items ? sortPosts(items, now) : [];

  return (
    <MyPostsSection title="Market" count={items ? items.length : null}>
      {items === null ? (
        <div className="h-20 animate-pulse rounded-[14px] bg-surface" aria-label="Loading market posts" />
      ) : list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((item) => {
            const busy = busyId === item.id;
            const due = marketPostDue(item, now);
            const left = item.status === 'reserved' ? reserveLeftText(item.reservedUntil, now) : null;
            const done = doneAction(item.kind);
            const suffix: PriceSuffix | undefined = item.priceTerms === 'per_person' ? 'pp' : undefined;
            const canLower = item.kind !== 'wanted' && (item.status === 'active' || item.status === 'reserved')
              && typeof item.price === 'number' && item.price > 1;
            const href = audience === 'girls' ? `/girls-space/marketplace/${item.id}` : `/marketplace/${item.id}`;
            return (
              <li key={item.id}>
                <MyPostShell
                  href={href}
                  thumb={<PostThumb image={item.images[0]} icon={iconFor(item)} />}
                  title={item.title}
                  status={item.status}
                  detail={<span className="font-semibold text-ink">{priceText(item, item.kind === 'wanted' ? 'Open budget' : 'Ask price')}</span>}
                  error={errors[item.id] ?? null}
                >
                  {item.status === 'needs_confirmation' ? (
                    <BringBackStrip busy={busy} onBringBack={() => void act(item.id, { action: 'still_available' })} />
                  ) : due ? (
                    <StillAvailableCard
                      doneLabel={done.label}
                      busy={busy}
                      onYes={() => void act(item.id, { action: 'still_available' })}
                      onDone={() => void act(item.id, { action: done.action })}
                    />
                  ) : null}
                  {left && <ReservedStrip left={left} busy={busy} onUnreserve={() => void act(item.id, { action: 'unreserve' })} />}
                  {canLower && !due && typeof item.price === 'number' && (
                    <LowerPriceShortcut
                      current={item.price}
                      suffix={suffix}
                      busy={busy}
                      onSave={(price) => act(item.id, { action: 'lower_price', price })}
                    />
                  )}
                </MyPostShell>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          className="py-5"
          icon={MarketIcon}
          title={failed ? 'Could not load your posts' : 'No market posts yet'}
          action={
            failed ? (
              <button type="button" onClick={() => void load()} className={swButton({ variant: 'white', size: 'sm' })}>
                Try again
              </button>
            ) : audience === 'campus' ? (
              <Link href="/marketplace/new" className={swButton({ size: 'sm' })}>
                Post something
              </Link>
            ) : undefined
          }
        />
      )}
    </MyPostsSection>
  );
}
