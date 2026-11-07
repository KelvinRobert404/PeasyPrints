'use client';

// The poster's own housing posts on /campus/activity: "Still available?" with
// Yes / Booked once the post is due, the reserve countdown with Unreserve, a
// Lower rent shortcut and "Bring it back" (confirm) for hidden posts.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BringBackStrip,
  LowerPriceShortcut,
  MyPostShell,
  MyPostsSection,
  PostThumb,
  ReservedStrip,
  StillAvailableCard,
  patchPost,
  reserveLeftText,
  useMinuteClock,
} from '@/components/campus/market/MarketMyPosts';
import { BedIcon, HousingIcon } from '@/components/swoop/icons';
import { EmptyState, swButton } from '@/components/swoop/primitives';
import type { SerializedHousingListing } from '@/lib/campus/housing/serialize';
import { formatPrice } from '@/lib/format/price';
import type { CampusAudience } from '@/types/campus';

const STATUS_ORDER: Record<string, number> = { needs_confirmation: 0, active: 1, reserved: 2 };

function sortPosts(items: SerializedHousingListing[]): SerializedHousingListing[] {
  const rank = (item: SerializedHousingListing) => (item.needsNudge && item.status === 'active' ? -1 : STATUS_ORDER[item.status] ?? 3);
  return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
}

/** 'Rs 8.5k pp, 2 beds left'. */
function detailText(item: SerializedHousingListing): string {
  const rent = item.rentPp > 0 ? formatPrice(item.rentPp, 'pp') : 'Ask rent';
  if (item.status !== 'active' && item.status !== 'reserved') return rent;
  if (item.bedsLeft <= 0) return rent;
  return `${rent}, ${item.bedsLeft} ${item.bedsLeft === 1 ? 'bed' : 'beds'} left`;
}

export function HousingMyPosts({ audience }: { audience: CampusAudience }) {
  const [items, setItems] = useState<SerializedHousingListing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const now = useMinuteClock();
  const base = audience === 'girls' ? '/api/girls-space/housing' : '/api/housing/posts';

  const load = async () => {
    try {
      const response = await fetch(`${base}?mine=1`, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { items?: SerializedHousingListing[] };
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

  const list = items ? sortPosts(items) : [];

  return (
    <MyPostsSection title="Housing" count={items ? items.length : null}>
      {items === null ? (
        <div className="h-20 animate-pulse rounded-[14px] bg-surface" aria-label="Loading housing posts" />
      ) : list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((item) => {
            const busy = busyId === item.id;
            // needsNudge comes from the server: 3 days after the last confirm.
            const due = item.needsNudge && item.status === 'active';
            const left = item.status === 'reserved' ? reserveLeftText(item.reservedUntil, now) : null;
            const canLower = (item.status === 'active' || item.status === 'reserved') && item.rentPp > 1;
            const href = audience === 'girls' ? `/girls-space/housing/${item.id}` : `/housing/${item.id}`;
            return (
              <li key={item.id}>
                <MyPostShell
                  href={href}
                  thumb={<PostThumb image={item.images[0]} icon={item.kind === 'room' ? BedIcon : HousingIcon} />}
                  title={item.title}
                  status={item.status}
                  detail={<span className="font-semibold text-ink">{detailText(item)}</span>}
                  error={errors[item.id] ?? null}
                >
                  {item.status === 'needs_confirmation' ? (
                    <BringBackStrip busy={busy} onBringBack={() => void act(item.id, { action: 'confirm' })} />
                  ) : due ? (
                    <StillAvailableCard
                      doneLabel="Booked"
                      busy={busy}
                      onYes={() => void act(item.id, { action: 'confirm' })}
                      onDone={() => void act(item.id, { action: 'booked' })}
                    />
                  ) : null}
                  {left && <ReservedStrip left={left} busy={busy} onUnreserve={() => void act(item.id, { action: 'unreserve' })} />}
                  {canLower && !due && (
                    <LowerPriceShortcut
                      current={item.rentPp}
                      suffix="pp"
                      label="New rent per person"
                      busy={busy}
                      onSave={(rentPp) => act(item.id, { action: 'lower_price', rentPp })}
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
          icon={HousingIcon}
          title={failed ? 'Could not load your posts' : 'No housing posts yet'}
          action={
            failed ? (
              <button type="button" onClick={() => void load()} className={swButton({ variant: 'white', size: 'sm' })}>
                Try again
              </button>
            ) : audience === 'campus' ? (
              <Link href="/housing/new" className={swButton({ size: 'sm' })}>
                Post a room
              </Link>
            ) : undefined
          }
        />
      )}
    </MyPostsSection>
  );
}
