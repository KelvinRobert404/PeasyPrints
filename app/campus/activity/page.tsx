'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CampusGate } from '@/components/campus/CampusGate';
import { HousingIcon, InboxIcon, MarketIcon } from '@/components/swoop/icons';
import { EmptyState, IconTile, ListRow, PageHeader, SectionHeader, Segmented, Tag, swButton } from '@/components/swoop/primitives';
import type { ContactRequest, HousingPost, MarketplaceListing } from '@/types/campus';
import type { CampusAudience } from '@/types/campus';

export default function CampusActivityPage() {
  const [sellerRequests, setSellerRequests] = useState<ContactRequest[]>([]);
  const [buyerRequests, setBuyerRequests] = useState<ContactRequest[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceListing[]>([]);
  const [housing, setHousing] = useState<HousingPost[]>([]);
  const [tab, setTab] = useState<'requests' | 'posts'>('requests');
  const [audience, setAudience] = useState<CampusAudience>('campus');
  const load = async () => {
    const [seller, buyer, market, homes] = await Promise.all([
      fetch(`/api/contact-requests?role=seller&audience=${audience}`, { cache: 'no-store' }), fetch(`/api/contact-requests?role=buyer&audience=${audience}`, { cache: 'no-store' }), fetch(`${audience === 'girls' ? '/api/girls-space/marketplace' : '/api/marketplace/listings'}?mine=1`, { cache: 'no-store' }), fetch(`${audience === 'girls' ? '/api/girls-space/housing' : '/api/housing/posts'}?mine=1`, { cache: 'no-store' }),
    ]);
    if (seller.ok) setSellerRequests((await seller.json()).items || []);
    if (buyer.ok) setBuyerRequests((await buyer.json()).items || []);
    if (market.ok) setMarketplace((await market.json()).items || []);
    if (homes.ok) setHousing((await homes.json()).items || []);
  };
  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get('tab') === 'posts') setTab('posts'); if (params.get('audience') === 'girls') setAudience('girls'); }, []);
  useEffect(() => { void load(); }, [audience]);
  const decide = async (id: string, action: 'approve' | 'decline') => { await fetch(`/api/contact-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); await load(); };
  const confirm = async (type: 'marketplace' | 'housing', id: string) => {
    const endpoint = audience === 'girls'
      ? `/api/girls-space/${type}/${id}`
      : `/api/${type === 'marketplace' ? 'marketplace/listings' : 'housing/posts'}/${id}`;
    await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm' }) });
    await load();
  };

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="pb-3">
        <PageHeader title={audience === 'girls' ? 'Girls’ space activity' : 'Campus activity'} kicker="Requests and posts" />
        <main className="px-3 pt-2">
          <Segmented
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
              <PostSection title="Marketplace" items={marketplace} type="marketplace" audience={audience} onConfirm={confirm} />
              <PostSection title="Housing" items={housing} type="housing" audience={audience} onConfirm={confirm} />
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

function RequestSection({ title, items, seller = false, onDecision }: { title: string; items: ContactRequest[]; seller?: boolean; onDecision?: (id: string, action: 'approve' | 'decline') => void }) {
  return (
    <Section title={title} count={items.length}>
      {items.length ? (
        <ul>
          {items.map((item, index) => {
            const Icon = item.contentType === 'housing' ? HousingIcon : MarketIcon;
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
                  title={seller ? `${item.buyerDisplayName} wants to connect` : 'Contact request'}
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

function PostSection({ title, items, type, audience, onConfirm }: { title: string; items: Array<MarketplaceListing | HousingPost>; type: 'marketplace' | 'housing'; audience: CampusAudience; onConfirm: (type: 'marketplace' | 'housing', id: string) => void }) {
  const FallbackIcon = type === 'housing' ? HousingIcon : MarketIcon;
  return (
    <Section title={title} count={items.length}>
      {items.length ? (
        <ul>
          {items.map((item, index) => {
            const remaining = new Date(item.availabilityExpiresAt).getTime() - Date.now();
            const warning = item.status === 'active' && remaining > 0 && remaining <= 24 * 60 * 60 * 1000;
            const href = audience === 'girls' ? `/girls-space/${type}/${item.id}` : `/${type}/${item.id}`;
            const status = item.status === 'needs_confirmation'
              ? <StatusTag tone="alert">Hidden</StatusTag>
              : warning
                ? <StatusTag tone="alert">Expiring</StatusTag>
                : <StatusTag tone={item.status === 'active' ? 'go' : 'muted'}>{item.status === 'active' ? 'Live' : item.status}</StatusTag>;
            const detail = item.status === 'needs_confirmation' ? 'Confirmation expired' : warning ? 'Expires within 24 hours' : item.serial;
            return (
              <li key={item.id}>
                <ListRow
                  divider={index < items.length - 1}
                  leading={item.images[0] ? (
                    <img src={item.images[0]} alt="" className="h-14 w-14 rounded-[10px] bg-surface object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-[10px] bg-surface text-text-muted"><FallbackIcon size={22} /></span>
                  )}
                  title={<Link href={href} className="hover:underline">{item.title}</Link>}
                  subtitle={<span className="flex min-w-0 items-center gap-1.5">{status}<span className="truncate">{detail}</span></span>}
                  trailing={
                    <button type="button" onClick={() => onConfirm(type, item.id)} className={swButton({ variant: item.status === 'needs_confirmation' ? 'primary' : 'ink', size: 'sm' })}>
                      {item.status === 'needs_confirmation' ? 'Reactivate' : 'Still live'}
                    </button>
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState className="py-5" icon={FallbackIcon} title="No posts yet" />
      )}
    </Section>
  );
}
