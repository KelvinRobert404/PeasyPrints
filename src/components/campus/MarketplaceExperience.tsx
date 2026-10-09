'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertIcon, BookIcon, GiftIcon, MarketIcon, NotesIcon, PlusIcon, SparklesIcon } from '@/components/swoop/icons';
import { Chip, EmptyState, IconButton, PageHeader, SearchPill, SectionHeader, Segmented, swButton } from '@/components/swoop/primitives';
import { useDockSlot } from '@/lib/stores/dockStore';
import { cn } from '@/lib/utils/cn';
import { CampusGate } from './CampusGate';
import { MarketplaceCard } from './MarketplaceCard';
import type { CampusAudience, MarketplaceListing, MarketplacePostType } from '@/types/campus';

const COLLECTIONS = [
  { id: 'all', label: 'Fresh on campus', icon: SparklesIcon },
  { id: 'books_notes', label: 'Semester books', icon: BookIcon },
  { id: 'under500', label: 'Under ₹500', icon: MarketIcon },
  { id: 'free', label: 'Free near campus', icon: GiftIcon },
] as const;

const POST_TYPES = (['all', 'sell', 'wanted', 'free'] as const).map((value) => ({ value, label: value }));

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
  const collegeCode = colleges.find((college) => college.id === selectedCollegeId)?.code || 'KJU';
  const activeCollection = COLLECTIONS.find((item) => item.id === collection) ?? COLLECTIONS[0];

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <MarketDockSlot
        createUrl={createUrl}
        subtitle={audience === 'girls' ? 'Only approved Girls’ space members see it' : `Only verified ${collegeCode} students see it`}
      />
      <div className="min-h-screen bg-white pb-3">
        <PageHeader
          title="Marketplace"
          kicker={audience === 'girls' ? `Girls’ space · ${collegeCode}` : `Only students · ${collegeCode}`}
          backHref="/"
          className="sticky top-0 z-30 bg-white pb-1.5"
          actions={<IconButton label="My posts" icon={NotesIcon} href={`/campus/activity?tab=posts&audience=${audience}`} />}
        />

        <main className="mx-auto max-w-3xl px-3">
          <SearchPill
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search title or ${collegeCode} serial`}
            aria-label="Search the marketplace"
            wrapperClassName="h-10"
          />

          <Segmented label="Post type" options={POST_TYPES} value={postType} onChange={setPostType} className="mt-2" />

          <div role="group" aria-label="Collections" className="mt-2.5 grid grid-cols-4 gap-1.5">
            {COLLECTIONS.map((item) => {
              const active = collection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCollection(item.id)}
                  className={cn('campus-press flex flex-col items-center gap-1', active ? 'text-royal' : 'text-ink')}
                >
                  <span className={cn('grid h-[46px] w-full place-items-center rounded-[12px]', active ? 'border-[1.5px] border-royal bg-royal-tint' : 'bg-surface')}>
                    <item.icon size={22} />
                  </span>
                  <span className="text-center text-[10.5px] font-bold leading-[1.15]">{item.label}</span>
                </button>
              );
            })}
          </div>

          <Link href={createUrl} className="campus-press relative mt-3 flex flex-col gap-1 overflow-hidden rounded-[14px] bg-royal px-3 pb-3 pt-[11px] text-white">
            <span className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-white/90">Verified students only</span>
            <span className="font-heading max-w-[180px] text-[17px] leading-none">Good finds. Zero strangers.</span>
            <span className="max-w-[220px] text-[11px] leading-[1.3] text-white/90">Books, fits, tech and hostel saves from verified students around you.</span>
            <span className="mt-[3px] flex h-7 items-center gap-[3px] self-start rounded-full bg-white pl-2 pr-[11px] text-[12px] font-extrabold text-royal">
              <PlusIcon size={13} />
              Post an item
            </span>
            <MarketIcon size={104} className="pointer-events-none absolute -bottom-[18px] -right-3.5 rotate-[-14deg] text-white" />
          </Link>

          {colleges.length > 1 ? (
            <div role="group" aria-label="Choose a campus" className="-mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 no-scrollbar">
              {colleges.map((college) => (
                <Chip key={college.id} selected={selectedCollegeId === college.id} onClick={() => setSelectedCollegeId(college.id)}>
                  {college.code}
                </Chip>
              ))}
            </div>
          ) : null}

          <section className="pt-3.5" aria-busy={loading}>
            <SectionHeader title={activeCollection.label} kicker={loading ? undefined : `${filteredOwn.length} at ${collegeCode}`} />

            {loading ? (
              <div className="mt-2 grid grid-cols-3 gap-x-1.5 gap-y-2.5" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="flex flex-col gap-1">
                    <div className="h-[112px] animate-pulse rounded-[12px] bg-surface" />
                    <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-surface" />
                    <div className="h-2 w-1/2 animate-pulse rounded-full bg-surface" />
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && error ? (
              <EmptyState
                icon={AlertIcon}
                title="Couldn’t load the marketplace"
                body={error}
                action={<button type="button" onClick={load} className={swButton({ variant: 'white', size: 'pill' })}>Retry</button>}
                className="mt-2"
              />
            ) : null}

            {!loading && !error && filteredOwn.length ? (
              <div className="mt-2 grid grid-cols-3 gap-x-1.5 gap-y-2.5">
                {filteredOwn.map((item) => <MarketplaceCard key={item.id} item={item} href={`${detailBase}/${item.id}`} onSave={save} />)}
              </div>
            ) : null}

            {!loading && !error && !filteredOwn.length ? (
              <EmptyState icon={MarketIcon} title="Nothing in this collection yet" body="Your post could be the first campus find." className="mt-2" />
            ) : null}
          </section>

          {!loading && filteredOther.length ? (
            <section className="pt-4">
              <SectionHeader title="Explore other colleges" kicker={`Beyond your campus · ${filteredOther.length}`} />
              <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 no-scrollbar">
                {filteredOther.map((item) => <MarketplaceCard key={item.id} item={item} href={`${detailBase}/${item.id}`} compact />)}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </CampusGate>
  );
}

/** Dock live slot: "Got something to sell? → Post". Rendered inside the gate so it only shows to members. */
function MarketDockSlot({ createUrl, subtitle }: { createUrl: string; subtitle: string }) {
  useDockSlot({ id: 'market-post', title: 'Got something to sell?', subtitle, tone: 'white', icon: 'tag', action: { label: 'Post', href: createUrl } });
  return null;
}
