'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { House, HousePlus, Inbox, Search } from 'lucide-react';
import { CampusGate } from './CampusGate';
import { CampusHeader } from './CampusHeader';
import { HousingCard } from './HousingCard';
import type { CampusAudience, HousingPost, HousingPostType } from '@/types/campus';

export function HousingExperience({ audience = 'campus' }: { audience?: CampusAudience }) {
  const [own, setOwn] = useState<HousingPost[]>([]);
  const [other, setOther] = useState<HousingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState<'all' | HousingPostType>('all');
  const [query, setQuery] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState('kju');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const endpoint = audience === 'girls' ? '/api/girls-space/housing' : '/api/housing/posts';
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load housing');
      setOwn(data.own || []); setOther(data.other || []);
    } catch (cause: any) { setError(cause.message || 'Could not load housing'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [audience]);

  const filter = (items: HousingPost[]) => items.filter((item) => (type === 'all' || item.postType === type) && (!query.trim() || `${item.title} ${item.area} ${item.serial}`.toLowerCase().includes(query.toLowerCase())));
  const allItems = useMemo(() => [...own, ...other], [own, other]);
  const colleges = useMemo(() => Array.from(new Map(allItems.map((item) => [item.collegeId, { id: item.collegeId, code: item.collegeCode }])).values()), [allItems]);
  const filteredOwn = useMemo(() => filter(allItems.filter((item) => item.collegeId === selectedCollegeId)), [allItems, selectedCollegeId, type, query]);
  const filteredOther = useMemo(() => filter(allItems.filter((item) => item.collegeId !== selectedCollegeId)), [allItems, selectedCollegeId, type, query]);
  const detailBase = audience === 'girls' ? '/girls-space/housing' : '/housing';
  const createUrl = audience === 'girls' ? '/housing/new?audience=girls' : '/housing/new';
  const save = async (item: HousingPost) => {
    const action = item.isSaved ? 'unsave' : 'save';
    setOwn((list) => list.map((entry) => entry.id === item.id ? { ...entry, isSaved: !entry.isSaved } : entry));
    setOther((list) => list.map((entry) => entry.id === item.id ? { ...entry, isSaved: !entry.isSaved } : entry));
    const response = await fetch('/api/campus/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, contentType: 'housing', contentId: item.id }) });
    if (!response.ok) void load();
  };

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="min-h-screen bg-[#eef2ef] pb-28">
        <CampusHeader title={audience === 'girls' ? 'Girls Housing' : 'Housing'} eyebrow={audience === 'girls' ? 'Girls’ Space · KJU' : 'Rooms + roommates · KJU'} accent="#2e6f57" actions={<Link href={`/campus/activity?tab=posts&audience=${audience}`} className="campus-press flex h-10 w-10 items-center justify-center rounded-full bg-white"><Inbox size={20} className="text-black" /></Link>} />
        <main className="mx-auto max-w-3xl px-4 pt-4">
          <section className="relative overflow-hidden rounded-[30px] bg-[#193c31] p-5 text-white">
            <div className="absolute -bottom-14 -right-10 h-44 w-44 rounded-full border-[26px] border-[#d8ff6a]/75" />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#d8ff6a]">Live closer. Live better.</p>
            <h2 className="mt-14 max-w-[260px] font-quinn text-[33px] font-bold leading-[0.94]">Your next room starts on campus.</h2>
            <p className="mt-3 max-w-[250px] text-xs font-semibold leading-5 text-white/55">Compare rent, commute and compatibility without exposing exact addresses.</p>
          </section>
          <label className="mt-4 flex h-12 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm"><Search size={20} className="shrink-0 text-zinc-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search area or KJU serial" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" /></label>
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
            {(['all', 'room', 'roommate', 'replacement', 'sublet'] as const).map((item) => <button key={item} onClick={() => setType(item)} className={`campus-press shrink-0 rounded-full px-4 py-2.5 text-xs font-extrabold capitalize ${type === item ? 'bg-[#193c31] text-white' : 'bg-white text-zinc-600'}`}>{item === 'all' ? 'Everything' : item}</button>)}
          </div>
          {colleges.length > 1 ? <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar" aria-label="Choose a campus">{colleges.map((college) => <button key={college.id} onClick={() => setSelectedCollegeId(college.id)} className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-extrabold ${selectedCollegeId === college.id ? 'border-[#193c31] bg-[#193c31] text-white' : 'border-black/10 bg-white text-zinc-500'}`}>{college.code}</button>)}</div> : null}
          <div className="mt-6 flex items-end justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2e6f57]">Best for your commute</p><h2 className="font-quinn text-2xl font-bold">Around KJU</h2></div><span className="text-xs font-bold text-zinc-400">{filteredOwn.length} posts</span></div>
          {loading ? <div className="mt-4 space-y-3">{[0, 1, 2].map((item) => <div key={item} className="skeleton h-[166px] rounded-[26px]" />)}</div> : null}
          {error ? <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
          {!loading && filteredOwn.length ? <div className="mt-4 space-y-3">{filteredOwn.map((item) => <HousingCard key={item.id} item={item} href={`${detailBase}/${item.id}`} onSave={save} />)}</div> : null}
          {!loading && !error && !filteredOwn.length ? <div className="mt-4 rounded-[26px] border border-dashed border-[#193c31]/15 bg-white/60 p-10 text-center"><House size={36} className="mx-auto text-[#2e6f57]/30" /><h3 className="mt-3 font-quinn text-lg font-bold">No matching homes yet</h3><p className="mt-1 text-xs font-semibold text-zinc-500">Post what you need and let campus find you.</p></div> : null}
          {filteredOther.length ? <section className="mt-9"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2e6f57]">Explore other campuses</p><h2 className="font-quinn text-2xl font-bold">Worth the commute</h2><div className="mt-4 space-y-3">{filteredOther.map((item) => <HousingCard key={item.id} item={item} href={`${detailBase}/${item.id}`} onSave={save} />)}</div></section> : null}
        </main>
        <Link href={createUrl} className="campus-press fixed bottom-6 right-5 z-30 flex h-15 items-center gap-2 rounded-2xl bg-[#193c31] px-5 text-sm font-extrabold text-white shadow-[0_15px_40px_rgba(25,60,49,0.3)]"><HousePlus size={20} />Post</Link>
      </div>
    </CampusGate>
  );
}
