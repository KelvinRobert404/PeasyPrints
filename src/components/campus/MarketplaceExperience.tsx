'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Gift, Inbox, Plus, Search, Sparkles, Store, Tag } from 'lucide-react';
import { CampusGate } from './CampusGate';
import { MarketplaceCard } from './MarketplaceCard';
import type { CampusAudience, MarketplaceCategory, MarketplaceListing, MarketplacePostType } from '@/types/campus';
import { MARKETPLACE_CATEGORY_LABELS } from '@/lib/campus/constants';

const COLLECTIONS = [
  { id: 'all', label: 'Fresh on campus', icon: Sparkles },
  { id: 'books_notes', label: 'Semester books', icon: BookOpen },
  { id: 'under500', label: 'Under ₹500', icon: Tag },
  { id: 'free', label: 'Free near campus', icon: Gift },
] as const;

export function MarketplaceExperience({ audience = 'campus' }: { audience?: CampusAudience }) {
  const [own, setOwn] = useState<MarketplaceListing[]>([]);
  const [other, setOther] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState<(typeof COLLECTIONS)[number]['id']>('all');
  const [postType, setPostType] = useState<'all' | MarketplacePostType>('all');
  const [selectedCollegeId, setSelectedCollegeId] = useState('kju');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = audience === 'girls' ? '/api/girls-space/marketplace' : '/api/marketplace/listings';
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load the marketplace');
      setOwn(data.own || []);
      setOther(data.other || []);
    } catch (cause: any) {
      setError(cause.message || 'Could not load the marketplace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [audience]);

  const filter = (items: MarketplaceListing[]) => items.filter((item) => {
    if (postType !== 'all' && item.postType !== postType) return false;
    if (collection === 'books_notes' && item.category !== 'books_notes') return false;
    if (collection === 'under500' && (item.price == null || item.price > 500)) return false;
    if (collection === 'free' && item.postType !== 'free') return false;
    const needle = query.trim().toLowerCase();
    return !needle || item.title.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle) || item.serial.toLowerCase().includes(needle);
  });
  const allItems = useMemo(() => [...own, ...other], [own, other]);
  const colleges = useMemo(() => Array.from(new Map(allItems.map((item) => [item.collegeId, { id: item.collegeId, code: item.collegeCode, name: item.collegeName }])).values()), [allItems]);
  const filteredOwn = useMemo(() => filter(allItems.filter((item) => item.collegeId === selectedCollegeId)), [allItems, selectedCollegeId, query, collection, postType]);
  const filteredOther = useMemo(() => filter(allItems.filter((item) => item.collegeId !== selectedCollegeId)), [allItems, selectedCollegeId, query, collection, postType]);

  const save = async (item: MarketplaceListing) => {
    const action = item.isSaved ? 'unsave' : 'save';
    setOwn((current) => current.map((entry) => entry.id === item.id ? { ...entry, isSaved: !entry.isSaved } : entry));
    setOther((current) => current.map((entry) => entry.id === item.id ? { ...entry, isSaved: !entry.isSaved } : entry));
    const response = await fetch('/api/campus/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, contentType: 'marketplace', contentId: item.id }) });
    if (!response.ok) void load();
  };

  const detailBase = audience === 'girls' ? '/girls-space/marketplace' : '/marketplace';
  const createUrl = audience === 'girls' ? '/marketplace/new?audience=girls' : '/marketplace/new';

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="min-h-screen bg-[#F4F5F7] pb-28">
        {/* Slim title row — lives under the platform header, not a second bar */}
        <div className="sticky top-0 z-30 border-b border-black/[0.05] bg-[#F4F5F7]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-3 py-3">
            <Link href="/" aria-label="Back home" className="campus-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
              <ArrowLeft size={18} className="text-black" />
            </Link>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-coolvetica text-[12px] tracking-[0.02em] text-slate-400">{audience === 'girls' ? 'girls’ space · kju' : 'only students · kju'}</p>
              <h1 className="truncate font-quinn text-[18px] font-bold tracking-tight text-black">{audience === 'girls' ? 'Girls Marketplace' : 'marketplace'}</h1>
            </div>
            <Link href={`/campus/activity?tab=posts&audience=${audience}`} className="campus-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Marketplace activity">
              <Inbox size={18} className="text-black" />
            </Link>
          </div>
        </div>

        <main className="mx-auto max-w-3xl px-3 pt-3">
          <section>
            <h2 className="font-poster text-ink text-[26px] leading-[1.0] tracking-[0.01em]">GOOD FINDS.<br />ZERO STRANGERS.</h2>
            <p className="mt-1.5 max-w-[300px] text-[12px] font-semibold leading-5 text-zinc-500">Books, fits, tech and hostel saves — from verified students around you.</p>
          </section>

          <label className="mt-3 flex h-11 items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white px-3.5">
            <Search size={17} className="shrink-0 text-zinc-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-black outline-none placeholder:text-zinc-400" placeholder="Search title or KJU serial" />
          </label>

          <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {COLLECTIONS.map((item) => (
              <button key={item.id} type="button" onClick={() => setCollection(item.id)} className={`campus-press flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-extrabold ${collection === item.id ? 'bg-ink text-cream' : 'bg-white text-zinc-600'}`}>
                <item.icon size={15} />{item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex rounded-xl bg-white p-1">
              {(['all', 'sell', 'wanted', 'free'] as const).map((type) => <button key={type} onClick={() => setPostType(type)} className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold capitalize transition-colors duration-150 ${postType === type ? 'bg-ink text-cream' : 'text-zinc-500'}`}>{type}</button>)}
            </div>
            <span className="text-[11px] font-bold tabular-nums text-zinc-400">{filteredOwn.length} at KJU</span>
          </div>
          {colleges.length > 1 ? <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar" aria-label="Choose a campus">{colleges.map((college) => <button key={college.id} onClick={() => setSelectedCollegeId(college.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-extrabold ${selectedCollegeId === college.id ? 'border-ink bg-ink text-cream' : 'border-black/10 bg-white text-zinc-500'}`}>{college.code}</button>)}</div> : null}

          {loading ? <div className="mt-3 grid grid-cols-2 gap-2.5">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton aspect-[3/5] rounded-[20px]" />)}</div> : null}
          {error ? <div className="mt-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}<button onClick={load} className="ml-2 underline">Retry</button></div> : null}

          {!loading && !error && filteredOwn.length ? <div className="mt-3 grid grid-cols-2 gap-2.5">{filteredOwn.map((item) => <MarketplaceCard key={item.id} item={item} href={`${detailBase}/${item.id}`} onSave={save} />)}</div> : null}
          {!loading && !error && !filteredOwn.length ? (
            <div className="mt-3 rounded-[20px] border border-dashed border-black/10 bg-white px-5 py-8 text-center"><Store size={30} className="mx-auto text-zinc-300" /><h3 className="mt-2.5 font-quinn text-[17px] font-bold text-black">Nothing in this collection yet</h3><p className="mt-1 text-xs font-semibold text-zinc-500">Your post could be the first campus find.</p></div>
          ) : null}

          {!loading && filteredOther.length ? (
            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between"><div><p className="font-coolvetica text-[12px] tracking-[0.02em] text-slate-400">beyond your campus</p><h2 className="mt-0.5 font-quinn text-[19px] font-bold text-black">Explore other colleges</h2></div><span className="text-xs font-bold tabular-nums text-zinc-400">{filteredOther.length}</span></div>
              <div className="grid grid-cols-2 gap-2.5">{filteredOther.map((item) => <MarketplaceCard key={item.id} item={item} href={`${detailBase}/${item.id}`} onSave={save} />)}</div>
            </section>
          ) : null}
        </main>

        {/* Column-aware Post button — pinned to the mobile column, not the viewport edge */}
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto w-full max-w-[428px] px-4">
          <div className="flex justify-end">
            <Link href={createUrl} className="campus-press pointer-events-auto flex items-center gap-2 rounded-full bg-ink py-3 pl-4 pr-5 text-sm font-extrabold text-cream shadow-[0_15px_40px_rgba(0,0,0,0.35)]"><Plus size={18} />Post</Link>
          </div>
        </div>
      </div>
    </CampusGate>
  );
}
