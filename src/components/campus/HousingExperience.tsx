'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CaretDownIcon, HousingIcon, InboxIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { EmptyState, IconButton, PageHeader, swButton } from '@/components/swoop/primitives';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import {
  housingAsk,
  housingPaths,
  searchedPlace,
  selectHousingView,
  useHousingFeed,
  type HousingFeedListing,
  type HousingFilterState,
  type HousingPaths,
} from '@/hooks/useHousingFeed';
import { isPeakHousingSeason } from '@/lib/campus/season';
import { useSeasonNow } from '@/lib/demo/season';
import { DEFAULT_RING, formatDistance } from '@/lib/format/distance';
import { useDockSlot } from '@/lib/stores/dockStore';
import { cn } from '@/lib/utils/cn';
import { CampusGate } from './CampusGate';
import { HousingFilters } from './housing/HousingFilters';
import { HousingListingCard } from './housing/HousingListingCard';
import type { CampusAudience } from '@/types/campus';

const GRID = 'grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-4';

function initialFilters(peak: boolean): HousingFilterState {
  return {
    q: '',
    ring: DEFAULT_RING,
    kind: 'all',
    gender: 'anyone',
    // Apr to Aug is peak season: agents flood the feed, so students come first.
    fromStudents: peak,
    showFarther: false,
  };
}

export function HousingExperience({ audience = 'campus' }: { audience?: CampusAudience }) {
  const { items, campus: apiCampus, status, error, reload, toggleSave } = useHousingFeed(audience);
  const current = useCurrentCampus();
  // Real now, or the demo date in demo mode (known only after hydration).
  const peak = isPeakHousingSeason(useSeasonNow());
  const [filters, setFilters] = useState<HousingFilterState>(() => initialFilters(peak));
  const [filtersPeak, setFiltersPeak] = useState(peak);
  if (filtersPeak !== peak) {
    setFiltersPeak(peak);
    setFilters((state) => ({ ...state, fromStudents: peak }));
  }
  const paths = housingPaths(audience);
  const girls = audience === 'girls';

  const campusLabel = current?.label ?? apiCampus?.label ?? null;
  const campusCode = current?.code ?? apiCampus?.code;
  const campusId = current?.campusId ?? apiCampus?.id ?? null;
  const collegeId = current?.collegeId ?? null;

  const view = useMemo(
    () => selectHousingView(items, filters, { audience, viewerCollegeId: collegeId, campusId }),
    [items, filters, audience, collegeId, campusId],
  );
  const place = searchedPlace(view.parsed);
  const update = (patch: Partial<HousingFilterState>) => setFilters((state) => ({ ...state, ...patch }));

  const title = campusLabel ? `Housing · ${campusLabel}` : 'Housing';
  const loading = status === 'loading';
  const ready = status === 'ready';
  const searching = filters.q.trim().length > 0;
  const shown = view.near.length + view.farther.length + view.agents.length;
  const card = (item: HousingFeedListing, variant: 'grid' | 'row' = 'grid') => (
    <HousingListingCard
      key={item.id}
      item={item}
      href={paths.detail(item.id)}
      onSave={toggleSave}
      variant={variant}
      campusCode={campusCode}
    />
  );

  return (
    <CampusGate girlsOnly={girls}>
      <PostSlot audience={audience} href={paths.create} />
      <div className="pb-3">
        {girls ? (
          <PageHeader
            backHref={paths.back}
            kicker="Girls’ space · Only verified students"
            title={title}
            actions={<IconButton label="My housing posts" icon={InboxIcon} href={paths.myPosts} />}
          />
        ) : (
          <header className="flex items-end justify-between gap-3 px-3 pt-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-[10.5px] font-semibold text-slate">
                <ShieldCheckIcon size={12} className="shrink-0 text-go-text" aria-hidden="true" />
                Only verified students
              </p>
              <h1 className="font-heading truncate text-[16px] leading-[1.05] text-ink">{title}</h1>
            </div>
            <Link href={paths.myPosts} className={swButton({ variant: 'surface', size: 'pill' })}>
              My posts
            </Link>
          </header>
        )}

        <main className="px-3 pt-2.5">
          <HousingFilters audience={audience} value={filters} onChange={update} searchedPlace={place} />

          <section className="pt-3" aria-label="Housing posts">
            {ready ? (
              <p className="text-[11px] font-semibold text-slate" aria-live="polite">
                {countLine(view.near.length + view.farther.length, view.placeSearch ? null : filters.ring)}
              </p>
            ) : null}

            {loading ? (
              <div className={cn(GRID, 'mt-2')} aria-busy="true" aria-label="Loading housing">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="skeleton h-[168px] rounded-[12px]" />
                ))}
              </div>
            ) : null}

            {status === 'error' ? (
              <div role="alert" className="mt-2 flex items-center justify-between gap-2 rounded-[12px] bg-market-tint px-3 py-2.5">
                <span className="min-w-0 text-[12px] font-semibold text-market">{error}</span>
                <button type="button" onClick={() => void reload()} className={swButton({ variant: 'surface', size: 'pill' })}>
                  Try again
                </button>
              </div>
            ) : null}

            {ready && view.near.length ? <div className={cn(GRID, 'mt-2')}>{view.near.map((item) => card(item))}</div> : null}

            {ready && view.agents.length ? (
              <AgentDigest className="mt-3" items={view.agents} render={(item) => card(item, 'row')} />
            ) : null}

            {ready && view.hiddenFarther > 0 ? (
              <div className="mt-3 flex flex-col items-center gap-1">
                {!view.near.length && !view.agents.length ? (
                  <p className="text-[12px] font-semibold text-slate">Nothing within {formatDistance(filters.ring)} yet</p>
                ) : null}
                <button type="button" onClick={() => update({ showFarther: true })} className={swButton({ variant: 'surface', size: 'pill' })}>
                  Show {view.hiddenFarther} farther
                </button>
              </div>
            ) : null}

            {ready && view.farther.length ? (
              <div className="pt-3.5">
                <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">Farther out</h2>
                <div className={cn(GRID, 'mt-2')}>{view.farther.map((item) => card(item))}</div>
              </div>
            ) : null}

            {ready && view.matched === 0 ? (
              searching ? (
                <AskCard q={filters.q} place={place} paths={paths} />
              ) : (
                <EmptyState
                  className="mt-2"
                  icon={HousingIcon}
                  title={items.length ? 'No posts match these filters' : 'No rooms posted yet'}
                  body="Post what you need. Students nearby will see it."
                  action={
                    <Link href={paths.create} className={swButton({ variant: 'primary', size: 'pill' })}>
                      Post
                    </Link>
                  }
                />
              )
            ) : null}

            {ready && view.matched > 0 && shown === 0 && view.hiddenFarther === 0 ? (
              <EmptyState className="mt-2" icon={HousingIcon} title="No posts match these filters" />
            ) : null}
          </section>
        </main>
      </div>
    </CampusGate>
  );
}

function countLine(count: number, ring: number | null): string {
  const posts = `${count} ${count === 1 ? 'post' : 'posts'}`;
  return ring === null ? posts : `${posts} within ${formatDistance(ring)}`;
}

/** Empty search: one tap to ask for a room near the searched place. */
function AskCard({ q, place, paths }: { q: string; place: string | null; paths: HousingPaths }) {
  const ask = housingAsk(q, place);
  return (
    <div className="mt-2 flex flex-col items-center gap-2 rounded-[14px] bg-surface px-5 py-6 text-center">
      <HousingIcon size={28} className="text-text-muted" />
      <p className="font-heading text-[14px] text-ink">No posts match yet</p>
      <p className="max-w-[260px] text-[11.5px] leading-[1.45] text-slate">Ask, and students nearby can reply.</p>
      <Link href={paths.ask(ask.area)} className={cn(swButton({ variant: 'primary', size: 'pill' }), 'max-w-full')}>
        <span className="truncate">{ask.text}</span>
      </Link>
    </div>
  );
}

/** From students on: agent posts fold into one row that opens on tap. */
function AgentDigest({
  items,
  render,
  className,
}: {
  items: HousingFeedListing[];
  render: (item: HousingFeedListing) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = `${items.length} agent ${items.length === 1 ? 'post' : 'posts'} · brokerage shown`;
  return (
    <div className={cn('rounded-[14px] border border-line bg-white', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="campus-press flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 truncate text-[12.5px] font-bold text-ink">{label}</span>
        <CaretDownIcon size={14} className={cn('shrink-0 text-ink transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? <div className="grid gap-2 px-2 pb-2 lg:grid-cols-2">{items.map((item) => render(item))}</div> : null}
    </div>
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
    action: { label: 'Post', href },
  });
  return null;
}
