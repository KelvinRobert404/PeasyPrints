'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CampusGate } from '@/components/campus/CampusGate';
import { CampusHeader } from '@/components/campus/CampusHeader';
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

  return <CampusGate girlsOnly={audience === 'girls'}><div className="min-h-screen bg-[#f4f5f7] pb-12"><CampusHeader title={audience === 'girls' ? 'Girls’ Space activity' : 'Campus activity'} eyebrow="Requests + posts" accent={audience === 'girls' ? '#c23b73' : '#0055ff'} /><main className="mx-auto max-w-2xl px-4 pt-4">
    <div className="grid grid-cols-2 rounded-2xl bg-white p-1"><button onClick={() => setTab('requests')} className={`rounded-xl py-2.5 text-xs font-extrabold ${tab === 'requests' ? 'bg-black text-white' : 'text-zinc-500'}`}>Contact requests</button><button onClick={() => setTab('posts')} className={`rounded-xl py-2.5 text-xs font-extrabold ${tab === 'posts' ? 'bg-black text-white' : 'text-zinc-500'}`}>My posts</button></div>
    {tab === 'requests' ? <div className="mt-5 space-y-6"><RequestSection title="Needs your decision" items={sellerRequests} seller onDecision={decide} /><RequestSection title="Requests you sent" items={buyerRequests} /></div> : <div className="mt-5 space-y-6"><PostSection title="Marketplace" items={marketplace} type="marketplace" audience={audience} onConfirm={confirm} /><PostSection title="Housing" items={housing} type="housing" audience={audience} onConfirm={confirm} /></div>}
  </main></div></CampusGate>;
}

function RequestSection({ title, items, seller = false, onDecision }: { title: string; items: ContactRequest[]; seller?: boolean; onDecision?: (id: string, action: 'approve' | 'decline') => void }) { return <section><div className="mb-3 flex items-center justify-between"><h2 className="font-quinn text-xl font-extrabold tracking-[-0.03em]">{title}</h2><span className="text-xs font-bold text-zinc-400">{items.length}</span></div><div className="space-y-2">{items.length ? items.map((item) => <div key={item.id} className="rounded-[22px] bg-white p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] font-bold text-zinc-400">{item.serial}</p><p className="mt-1 text-sm font-extrabold">{seller ? `${item.buyerDisplayName} wants to connect` : `Contact request · ${item.status}`}</p></div><span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-extrabold uppercase">{item.status}</span></div>{seller && item.status === 'pending' ? <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onDecision?.(item.id, 'approve')} className="campus-press rounded-xl bg-[#25D366] py-2.5 text-xs font-extrabold">Approve</button><button onClick={() => onDecision?.(item.id, 'decline')} className="campus-press rounded-xl bg-zinc-100 py-2.5 text-xs font-extrabold">Decline</button></div> : null}{!seller && item.whatsappUrl ? <a href={item.whatsappUrl} target="_blank" rel="noreferrer" className="mt-3 flex rounded-xl bg-[#25D366] py-2.5 text-center text-xs font-extrabold justify-center">Open WhatsApp</a> : null}</div>) : <div className="rounded-[22px] border border-dashed border-black/10 p-7 text-center text-xs font-bold text-zinc-400">Nothing here yet</div>}</div></section>; }
function PostSection({ title, items, type, audience, onConfirm }: { title: string; items: Array<MarketplaceListing | HousingPost>; type: 'marketplace' | 'housing'; audience: CampusAudience; onConfirm: (type: 'marketplace' | 'housing', id: string) => void }) { return <section><h2 className="mb-3 font-quinn text-xl font-extrabold tracking-[-0.03em]">{title}</h2><div className="space-y-2">{items.length ? items.map((item) => { const remaining = new Date(item.availabilityExpiresAt).getTime() - Date.now(); const warning = item.status === 'active' && remaining > 0 && remaining <= 24 * 60 * 60 * 1000; const href = audience === 'girls' ? `/girls-space/${type}/${item.id}` : `/${type}/${item.id}`; return <div key={item.id} className={`flex items-center gap-3 rounded-[22px] p-3 ${warning || item.status === 'needs_confirmation' ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-white'}`}>{item.images[0] ? <img src={item.images[0]} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="h-16 w-16 rounded-2xl bg-zinc-100" />}<div className="min-w-0 flex-1"><p className="font-mono text-[9px] font-bold text-zinc-400">{item.serial}</p><Link href={href} className="mt-1 block truncate text-sm font-extrabold">{item.title}</Link><p className={`mt-1 text-[10px] font-bold uppercase ${warning || item.status === 'needs_confirmation' ? 'text-amber-700' : 'text-zinc-400'}`}>{item.status === 'needs_confirmation' ? 'Hidden · confirmation expired' : warning ? 'Expires within 24 hours' : item.status}</p></div><button onClick={() => onConfirm(type, item.id)} className="campus-press rounded-xl bg-black px-3 py-2 text-[10px] font-extrabold text-white">{item.status === 'needs_confirmation' ? 'Reactivate' : 'Still live'}</button></div>; }) : <div className="rounded-[22px] border border-dashed border-black/10 p-7 text-center text-xs font-bold text-zinc-400">No posts yet</div>}</div></section>; }
