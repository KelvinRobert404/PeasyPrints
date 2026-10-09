'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { HousingIcon, InboxIcon } from '@/components/swoop/icons';
import { Chip, EmptyState, IconButton, PageHeader, SearchPill, SectionHeader, swButton } from '@/components/swoop/primitives';
import { useDockSlot } from '@/lib/stores/dockStore';
import { CampusGate } from './CampusGate';
import { HOUSING_TYPE_LABELS, HousingCard } from './HousingCard';
import type { CampusAudience, HousingPost, HousingPostType } from '@/types/campus';

const TYPE_FILTERS = ['all', 'room', 'roommate', 'replacement', 'sublet'] as const;

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
  const postsUrl = `/campus/activity?tab=posts&audience=${audience}`;
  const collegeCode = colleges.find((college) => college.id === selectedCollegeId)?.code || 'KJU';
  const save = async (item: HousingPost) => {
    const action = item.isSaved ? 'unsave' : 'save';
    setOwn((list) => list.map((entry) => entry.id === item.id ? { ...entry, isSaved: !entry.isSaved } : entry));
    setOther((list) => list.map((entry) => entry.id === item.id ? { ...entry, isSaved: !entry.isSaved } : entry));
    const response = await fetch('/api/campus/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, contentType: 'housing', contentId: item.id }) });
    if (!response.ok) void load();
  };

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <PostSlot audience={audience} href={createUrl} />
      <div className="pb-3">
        {audience === 'girls' ? (
          <PageHeader
            backHref="/girls-space"
            kicker={`Girls’ space · ${collegeCode}`}
            title="Housing"
            actions={<IconButton label="My housing posts" icon={InboxIcon} href={postsUrl} />}
          />
        ) : (
          <div className="flex items-end justify-between gap-3 px-3 pt-2">
            <div className="min-w-0">
              <p className="truncate text-[10.5px] font-semibold text-slate">Rooms and roommates · {collegeCode}</p>
              <h1 className="font-heading truncate text-[16px] leading-[1.05] text-ink">Housing</h1>
            </div>
            <Link href={postsUrl} className={swButton({ variant: 'surface', size: 'pill' })}>My posts</Link>
          </div>
        )}

        <main className="px-3 pt-2.5">
          <SearchPill
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search area or serial"
            aria-label="Search housing by area or serial"
          />
          <div role="group" aria-label="Filter by post type" className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 no-scrollbar">
            {TYPE_FILTERS.map((item) => (
              <Chip key={item} selected={type === item} onClick={() => setType(item)}>
                {item === 'all' ? 'All' : HOUSING_TYPE_LABELS[item]}
              </Chip>
            ))}
          </div>
          {colleges.length > 1 ? (
            <div role="group" aria-label="Choose a campus" className="-mx-3 mt-1.5 flex gap-1.5 overflow-x-auto px-3 no-scrollbar">
              {colleges.map((college) => (
                <Chip key={college.id} selected={selectedCollegeId === college.id} onClick={() => setSelectedCollegeId(college.id)}>
                  {college.code}
                </Chip>
              ))}
            </div>
          ) : null}

          <section className="pt-3.5">
            <div className="flex items-end justify-between gap-3">
              <SectionHeader className="min-w-0" kicker="Best for your commute" title={`Around ${collegeCode}`} />
              {!loading ? <span className="shrink-0 text-[11px] font-semibold text-slate">{filteredOwn.length} {filteredOwn.length === 1 ? 'post' : 'posts'}</span> : null}
            </div>
            {loading ? (
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-3" aria-busy="true" aria-label="Loading housing">
                {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-[168px] rounded-[12px]" />)}
              </div>
            ) : null}
            {error ? <div role="alert" className="mt-2 rounded-[12px] bg-market-tint px-3 py-2.5 text-[12px] font-semibold text-market">{error}</div> : null}
            {!loading && filteredOwn.length ? (
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-3">
                {filteredOwn.map((item) => <HousingCard key={item.id} item={item} href={`${detailBase}/${item.id}`} onSave={save} />)}
              </div>
            ) : null}
            {!loading && !error && !filteredOwn.length ? (
              <EmptyState className="mt-2" icon={HousingIcon} title="No matching homes yet" body="Post what you need and let campus find you." />
            ) : null}
          </section>

          {filteredOther.length ? (
            <section className="pt-3.5">
              <SectionHeader kicker="Explore other campuses" title="Worth the commute" />
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-3">
                {filteredOther.map((item) => <HousingCard key={item.id} item={item} href={`${detailBase}/${item.id}`} onSave={save} />)}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </CampusGate>
  );
}

/** Dock live slot for posting. Rendered inside the gate so it only shows to students who can post. */
function PostSlot({ audience, href }: { audience: CampusAudience; href: string }) {
  useDockSlot({
    id: 'housing-post',
    title: 'Have a room or need a flatmate?',
    subtitle: audience === 'girls' ? 'Visible to Girls’ space members only' : 'Visible to verified students only',
    tone: 'white',
    icon: 'plus',
    action: { label: 'Post', href }
  });
  return null;
}
