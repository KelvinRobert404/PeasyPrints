'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Flag, House, MessageCircle, Package, SearchX, Share2, X } from 'lucide-react';
import { CampusGate } from './CampusGate';
import { CampusHeader } from './CampusHeader';
import type { CampusAudience, ContactRequest, HousingPost, MarketplaceListing } from '@/types/campus';
import { MARKETPLACE_CATEGORY_LABELS } from '@/lib/campus/constants';

type Props = { id: string; type: 'marketplace' | 'housing'; audience?: CampusAudience };

export function ContentDetail({ id, type, audience = 'campus' }: Props) {
  const [item, setItem] = useState<MarketplaceListing | HousingPost | null>(null);
  const [contact, setContact] = useState<ContactRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const endpoint = audience === 'girls'
    ? `/api/girls-space/${type}/${id}`
    : type === 'marketplace' ? `/api/marketplace/listings/${id}` : `/api/housing/posts/${id}`;
  const accent = type === 'marketplace' ? '#ff5c35' : '#2e6f57';
  const base = audience === 'girls' ? `/girls-space/${type}` : `/${type}`;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [response, requests] = await Promise.all([fetch(endpoint, { cache: 'no-store' }), fetch(`/api/contact-requests?role=buyer&audience=${audience}`, { cache: 'no-store' })]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Post not found');
      setItem(data.item);
      if (requests.ok) {
        const requestData = await requests.json();
        setContact((requestData.items || []).find((entry: ContactRequest) => entry.contentType === type && entry.contentId === id) || null);
      }
    } catch (cause: any) { setError(cause.message || 'Post not found'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id]);
  useEffect(() => {
    if (!reportOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setReportOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [reportOpen]);

  const requestContact = async () => {
    setBusy(true); setError('');
    const response = await fetch('/api/contact-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: type, contentId: id }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Could not request contact'); else await load();
    setBusy(false);
  };

  const action = async (actionName: string) => {
    setBusy(true);
    const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName }) });
    if (response.ok) await load(); else setError((await response.json()).error || 'Could not update post');
    setBusy(false);
  };

  const save = async () => {
    if (!item) return;
    setItem({ ...item, isSaved: !item.isSaved });
    await fetch('/api/campus/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: item.isSaved ? 'unsave' : 'save', contentType: type, contentId: id }) });
  };

  const report = async () => {
    if (reportReason.trim().length < 3) return;
    setBusy(true);
    const response = await fetch('/api/campus/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'report', contentType: type, contentId: id, reason: reportReason }) });
    if (!response.ok) setError((await response.json()).error || 'Could not send report');
    else { setReportOpen(false); setReportReason(''); setNotice('Report sent to the campus team.'); }
    setBusy(false);
  };

  const share = async () => {
    if (!item) return;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setNotice('Link copied.'); }
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') setError('Could not share this post');
    }
  };

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className={`min-h-screen pb-10 ${type === 'housing' ? 'bg-[#eef2ef]' : 'bg-[#f4f5f7]'}`}>
        <CampusHeader title={type === 'marketplace' ? 'Campus find' : 'Housing post'} eyebrow={audience === 'girls' ? 'Girls’ Space' : 'KJU verified'} accent={accent} actions={<Link href={base} className="campus-press flex h-10 w-10 items-center justify-center rounded-full bg-white"><X size={18} className="text-black" /></Link>} />
        {loading ? <div className="mx-auto max-w-xl space-y-4 px-4 pt-4"><div className="skeleton aspect-square rounded-[30px]" /><div className="skeleton h-48 rounded-[30px]" /></div> : null}
        {error && !item ? <div className="mx-auto mt-8 max-w-md rounded-[28px] bg-white p-8 text-center"><SearchX size={36} className="mx-auto text-zinc-300" /><h2 className="mt-3 font-quinn text-xl font-bold">This post stepped off campus</h2><p className="mt-2 text-sm font-semibold text-zinc-500">{error}</p><Link href={base} className="mt-5 inline-flex rounded-2xl bg-black px-5 py-3 text-xs font-extrabold text-white">Browse active posts</Link></div> : null}
        {item ? (
          <main className="mx-auto max-w-xl px-4 pt-4">
            <section className="overflow-hidden rounded-[30px] bg-white">
              <div className="aspect-square bg-zinc-100">{item.images[0] ? <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center">{type === 'housing' ? <House size={60} className="text-zinc-300" /> : <Package size={60} className="text-zinc-300" />}</div>}</div>
              <div className="p-5">
                <div className="flex items-center justify-between"><span className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white" style={{ backgroundColor: accent }}>{item.postType}</span><span className="font-mono text-xs font-bold text-zinc-400">{item.serial}</span></div>
                <h1 className="mt-5 font-quinn text-[30px] font-bold leading-[0.98]">{item.title}</h1>
                <p className="mt-3 text-2xl font-black">{type === 'marketplace' ? marketPrice(item as MarketplaceListing) : housingPrice(item as HousingPost)}</p>
                <p className="mt-5 whitespace-pre-wrap text-sm font-medium leading-6 text-zinc-600">{item.description}</p>
              </div>
            </section>

            <section className="mt-4 rounded-[26px] bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: accent }}>Campus context</p>
              {type === 'marketplace' ? <MarketplaceMeta item={item as MarketplaceListing} /> : <HousingMeta item={item as HousingPost} />}
              <div className="mt-4 flex items-center gap-3 border-t border-black/[0.06] pt-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-black text-white">{(type === 'marketplace' ? (item as MarketplaceListing).seller.displayName : (item as HousingPost).poster.displayName)[0]}</div><div><p className="text-sm font-extrabold">{type === 'marketplace' ? (item as MarketplaceListing).seller.displayName : (item as HousingPost).poster.displayName}</p><p className="text-[11px] font-bold text-zinc-400">Verified KJU student</p></div></div>
            </section>

            {item.isOwner ? (
              <section className="mt-4 rounded-[26px] bg-[#161616] p-4 text-white"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45">Your post</p><p className="mt-2 text-sm font-semibold text-white/70">Confirm every week to keep the post visible.</p><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => action('confirm')} className="campus-press rounded-2xl bg-white px-3 py-3 text-xs font-extrabold text-black">Still available</button><button disabled={busy} onClick={() => action(type === 'marketplace' ? 'sold' : 'filled')} className="campus-press rounded-2xl bg-white/10 px-3 py-3 text-xs font-extrabold">{type === 'marketplace' ? 'Mark sold' : 'Mark filled'}</button></div></section>
            ) : (
              <section className="mt-4">
                {contact?.status === 'approved' && contact.whatsappUrl ? <a href={contact.whatsappUrl} target="_blank" rel="noreferrer" className="campus-press flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-sm font-extrabold text-[#092e17]"><MessageCircle size={18} />Continue on WhatsApp</a> : <button disabled={busy || contact?.status === 'pending'} onClick={requestContact} className="campus-press h-14 w-full rounded-2xl bg-black text-sm font-extrabold text-white disabled:bg-zinc-400">{contact?.status === 'pending' ? 'Contact request pending' : contact?.status === 'declined' ? 'Contact request declined' : busy ? 'Sending request…' : 'Request WhatsApp access'}</button>}
                <p className="mt-2 text-center text-[10px] font-bold text-zinc-400">The poster decides whether to share contact access.</p>
              </section>
            )}
            {error ? <div className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700" role="alert">{error}</div> : null}
            {notice ? <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700" role="status">{notice}</div> : null}
            <div className="mt-4 grid grid-cols-3 gap-2"><button onClick={save} className="campus-press rounded-2xl bg-white py-3 text-xs font-extrabold"><Bookmark size={17} className="mr-1 inline align-middle" fill={item.isSaved ? 'currentColor' : 'none'} />{item.isSaved ? 'Saved' : 'Save'}</button><button onClick={() => void share()} className="campus-press rounded-2xl bg-white py-3 text-xs font-extrabold"><Share2 size={17} className="mr-1 inline align-middle" />Share</button><button onClick={() => setReportOpen(true)} className="campus-press rounded-2xl bg-white py-3 text-xs font-extrabold text-red-600"><Flag size={17} className="mr-1 inline align-middle" />Report</button></div>
          </main>
        ) : null}
        {reportOpen ? <div className="fixed inset-0 z-[70] flex items-end bg-black/45 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center" onMouseDown={(event) => { if (event.currentTarget === event.target) setReportOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="report-title" className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-600">Safety report</p><h2 id="report-title" className="mt-1 font-quinn text-xl font-bold">What should we review?</h2></div><button onClick={() => setReportOpen(false)} aria-label="Close report" className="campus-press flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"><X size={18} className="text-black" /></button></div><label className="mt-5 block text-xs font-bold text-zinc-600">Reason<textarea autoFocus value={reportReason} onChange={(event) => setReportReason(event.target.value)} maxLength={400} className="campus-input mt-2 min-h-28 resize-none" placeholder="Describe the issue without including private information." /></label><button disabled={busy || reportReason.trim().length < 3} onClick={() => report()} className="campus-press mt-4 h-12 w-full rounded-2xl bg-red-600 text-xs font-extrabold text-white disabled:bg-zinc-300">{busy ? 'Sending…' : 'Send confidential report'}</button></section></div> : null}
      </div>
    </CampusGate>
  );
}

function marketPrice(item: MarketplaceListing) { return item.postType === 'free' ? 'Free' : item.price == null ? 'Ask for price' : `₹${item.price.toLocaleString('en-IN')}`; }
function housingPrice(item: HousingPost) { return item.rent == null ? 'Budget flexible' : `₹${item.rent.toLocaleString('en-IN')} / month`; }
function MarketplaceMeta({ item }: { item: MarketplaceListing }) { return <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-zinc-600"><span className="rounded-xl bg-[#f4f5f7] p-3">{MARKETPLACE_CATEGORY_LABELS[item.category]}</span><span className="rounded-xl bg-[#f4f5f7] p-3">{item.pickupLabel || item.area || item.collegeCode}</span>{item.condition ? <span className="rounded-xl bg-[#f4f5f7] p-3">{item.condition}</span> : null}{item.negotiable ? <span className="rounded-xl bg-[#f4f5f7] p-3">Negotiable</span> : null}</div>; }
function HousingMeta({ item }: { item: HousingPost }) { return <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-zinc-600"><span className="rounded-xl bg-[#eef2ef] p-3">{item.area}</span><span className="rounded-xl bg-[#eef2ef] p-3">{item.commuteLabel || `Near ${item.collegeCode}`}</span>{item.furnishing ? <span className="rounded-xl bg-[#eef2ef] p-3">{item.furnishing}</span> : null}{item.occupancy ? <span className="rounded-xl bg-[#eef2ef] p-3">{item.occupancy}</span> : null}</div>; }
