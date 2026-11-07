'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { CampusGate } from '@/components/campus/CampusGate';
import { HousingMyPosts } from '@/components/campus/housing/HousingMyPosts';
import { MarketMyPosts } from '@/components/campus/market/MarketMyPosts';
import {
  BallIcon,
  BellIcon,
  BloodDropIcon,
  ClockIcon,
  DealIcon,
  HandIcon,
  HourglassIcon,
  HousingIcon,
  InboxIcon,
  LostFoundIcon,
  MarketIcon,
  PriceDropIcon,
  ShieldCheckIcon,
  type IconProps,
} from '@/components/swoop/icons';
import { EmptyState, IconTile, ListRow, PageHeader, SectionHeader, Segmented, Tag, swButton } from '@/components/swoop/primitives';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import type { CampusAudience, CampusNotification, ContactRequest, NotificationKind } from '@/types/campus';

/** A contact request, with the optional intent ('offer' = they have what you asked for). */
type ActivityRequest = ContactRequest & { intent?: string | null };
type InboxItem = CampusNotification & { deliverAfter?: string };

export default function CampusActivityPage() {
  const [sellerRequests, setSellerRequests] = useState<ActivityRequest[]>([]);
  const [buyerRequests, setBuyerRequests] = useState<ActivityRequest[]>([]);
  const [tab, setTab] = useState<'requests' | 'posts'>('requests');
  const [audience, setAudience] = useState<CampusAudience>('campus');
  const campus = useCurrentCampus();

  const load = async () => {
    const [seller, buyer] = await Promise.all([
      fetch(`/api/contact-requests?role=seller&audience=${audience}`, { cache: 'no-store' }),
      fetch(`/api/contact-requests?role=buyer&audience=${audience}`, { cache: 'no-store' }),
    ]).catch(() => [null, null] as const);
    if (seller?.ok) setSellerRequests((await seller.json()).items || []);
    if (buyer?.ok) setBuyerRequests((await buyer.json()).items || []);
  };
  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get('tab') === 'posts') setTab('posts'); if (params.get('audience') === 'girls') setAudience('girls'); }, []);
  useEffect(() => { void load(); }, [audience]);
  const decide = async (id: string, action: 'approve' | 'decline') => { await fetch(`/api/contact-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); await load(); };

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="pb-3">
        <PageHeader title={audience === 'girls' ? 'Girls’ space activity' : 'Campus activity'} kicker={campus?.label ?? 'Requests and posts'} />
        <main className="px-3 pt-2">
          <UpdatesSection />
          <Segmented
            className="mt-3.5"
            label="Activity"
            value={tab}
            onChange={setTab}
            options={[{ value: 'requests', label: 'Contact requests' }, { value: 'posts', label: 'My posts' }]}
          />
          {tab === 'requests' ? (
            <>
              <RequestSection title="Needs your decision" items={sellerRequests} seller onDecision={decide} />
              <RequestSection title="Requests you sent" items={buyerRequests} />
            </>
          ) : (
            <>
              <MarketMyPosts audience={audience} />
              <HousingMyPosts audience={audience} />
            </>
          )}
        </main>
      </div>
    </CampusGate>
  );
}

const REQUEST_STATUS_TONE: Record<ContactRequest['status'], 'go' | 'royal' | 'muted' | 'alert'> = {
  pending: 'royal',
  approved: 'go',
  declined: 'alert',
  cancelled: 'muted',
  expired: 'muted'
};

function StatusTag({ tone, children }: { tone: 'go' | 'royal' | 'muted' | 'alert'; children: React.ReactNode }) {
  if (tone === 'go') return <Tag tone="go">{children}</Tag>;
  if (tone === 'royal') return <Tag tone="royal">{children}</Tag>;
  if (tone === 'alert') return <Tag className="bg-market-tint text-market">{children}</Tag>;
  return <Tag className="bg-surface text-text-secondary">{children}</Tag>;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="pt-3.5">
      <div className="flex items-end justify-between gap-3">
        <SectionHeader className="min-w-0" title={title} />
        <span className="shrink-0 text-[11px] font-semibold text-slate">{count}</span>
      </div>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/** What the seller sees on a request row. */
function requestTitle(item: ActivityRequest): string {
  const name = item.buyerDisplayName || 'A student';
  return item.intent === 'offer' ? `${name} has what you asked for` : `${name} wants to connect`;
}

function RequestSection({ title, items, seller = false, onDecision }: { title: string; items: ActivityRequest[]; seller?: boolean; onDecision?: (id: string, action: 'approve' | 'decline') => void }) {
  return (
    <Section title={title} count={items.length}>
      {items.length ? (
        <ul>
          {items.map((item, index) => {
            const Icon = item.intent === 'offer' ? HandIcon : item.contentType === 'housing' ? HousingIcon : MarketIcon;
            const status = <StatusTag tone={REQUEST_STATUS_TONE[item.status] ?? 'muted'}>{item.status}</StatusTag>;
            let trailing: React.ReactNode = status;
            if (seller && item.status === 'pending') {
              trailing = (
                <span className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => onDecision?.(item.id, 'decline')} className={swButton({ variant: 'surface', size: 'sm' })}>Decline</button>
                  <button type="button" onClick={() => onDecision?.(item.id, 'approve')} className={swButton({ size: 'sm' })}>Approve</button>
                </span>
              );
            } else if (!seller && item.whatsappUrl) {
              trailing = <a href={item.whatsappUrl} target="_blank" rel="noreferrer" className={swButton({ size: 'sm' })}>Open WhatsApp</a>;
            }
            return (
              <li key={item.id}>
                <ListRow
                  divider={index < items.length - 1}
                  leading={<IconTile icon={Icon} size={36} />}
                  title={seller ? requestTitle(item) : 'Contact request'}
                  subtitle={<span className="font-mono">{item.serial}</span>}
                  trailing={trailing}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState className="py-5" icon={InboxIcon} title="Nothing here yet" />
      )}
    </Section>
  );
}

/* Updates: the in-app inbox, so nudges show without push ------------------ */

const UPDATES_PREVIEW = 3;

const KIND_ICONS: Partial<Record<NotificationKind, ComponentType<IconProps>>> = {
  price_drop: PriceDropIcon,
  listing_nudge: HourglassIcon,
  listing_expired: HourglassIcon,
  game_update: BallIcon,
  contact_request: InboxIcon,
  contact_approved: InboxIcon,
  contact_declined: InboxIcon,
  reserve_request: ClockIcon,
  reserve_expiring: ClockIcon,
  reserve_lapsed: ClockIcon,
  verification_approved: ShieldCheckIcon,
  verification_rejected: ShieldCheckIcon,
  blood_request: BloodDropIcon,
  lost_found_match: LostFoundIcon,
  new_deal: DealIcon,
};

/** '5 min ago', '3 h ago', '2 d ago'. */
function timeAgo(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return 'Just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function UpdatesSection() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  // Unread when the page opened; they stay marked new until the next visit.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/campus/notifications', { cache: 'no-store' });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { notifications?: InboxItem[] };
        if (cancelled) return;
        const list = data.notifications ?? [];
        const unread = list.filter((item) => !item.read).map((item) => item.id);
        setItems(list);
        setFresh(new Set(unread));
        if (unread.length) {
          // Seen here counts as read. Best effort: a failure only keeps them unread.
          void fetch('/api/campus/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: unread.slice(0, 50) }),
          }).catch(() => undefined);
        }
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const shown = items ? (expanded ? items : items.slice(0, UPDATES_PREVIEW)) : [];
  const more = items ? items.length - UPDATES_PREVIEW : 0;

  return (
    <section>
      <SectionHeader
        title="Updates"
        action={more > 0 ? { label: expanded ? 'Show less' : `See all ${items!.length}`, onClick: () => setExpanded((value) => !value) } : undefined}
      />
      <div className="mt-1">
        {items === null ? (
          <div className="h-12 animate-pulse rounded-[12px] bg-surface" aria-label="Loading updates" />
        ) : shown.length ? (
          <ul>
            {shown.map((item, index) => {
              const Icon = KIND_ICONS[item.kind] ?? BellIcon;
              const isNew = fresh.has(item.id);
              return (
                <li key={item.id}>
                  <ListRow
                    href={item.href ?? undefined}
                    divider={index < shown.length - 1}
                    leading={<IconTile icon={Icon} size={36} tone={isNew ? 'royal' : 'surface'} />}
                    title={
                      <span className="flex min-w-0 items-center gap-1.5">
                        {isNew && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-royal" aria-label="New" />}
                        <span className="truncate">{item.title}</span>
                      </span>
                    }
                    subtitle={item.body ? `${item.body} · ${timeAgo(item.deliverAfter ?? item.createdAt, now)}` : timeAgo(item.deliverAfter ?? item.createdAt, now)}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[12px] bg-surface px-3 py-2.5 text-[11.5px] text-slate">No updates yet</p>
        )}
      </div>
    </section>
  );
}
