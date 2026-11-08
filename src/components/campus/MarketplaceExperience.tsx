'use client';

// Market v2 home, in canvas order: header, saved price drops, search (with a
// one-tap ask when nothing matches), season prompt, furnish tiles, more kinds,
// rooms clearing out, seats/tickets/passes, everything near you, wanted.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useDeferredValue, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { CheckIcon, ChevronRightIcon, MarketIcon, NotesIcon, PlusIcon, PriceDropIcon } from '@/components/swoop/icons';
import { EmptyState, IconButton, PageHeader, SearchPill, SectionHeader, swButton } from '@/components/swoop/primitives';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { marketPaths, useMarketFeed, type MarketFeedListing, type MarketPaths } from '@/hooks/useMarketFeed';
import { getCampus } from '@/lib/campus/catalog';
import {
  ALSO_CHIPS,
  FURNISH_TILES,
  MARKET_KINDS,
  MARKET_SECTIONS,
  furnishTileFor,
  type AlsoChipId,
  type FurnishTileId,
  type MarketSectionId,
} from '@/lib/campus/market';
import { groupMarketFeed, isFeedVisible, type MarketFeed } from '@/lib/campus/marketFeed';
import { seasonalPrompt } from '@/lib/campus/season';
import { useSeasonNow } from '@/lib/demo/season';
import { isEmptyQuery, matchItem, parseQuery, type ParsedQuery } from '@/lib/search/campusSearch';
import { useDockSlot } from '@/lib/stores/dockStore';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience } from '@/types/campus';
import type { MarketKind } from '@/types/market';
import { CampusGate } from './CampusGate';
import { AlsoChips } from './market/AlsoChips';
import { AskCard } from './market/AskCard';
import { BundleCard } from './market/BundleCard';
import { FurnishTiles } from './market/FurnishTiles';
import {
  FeedError,
  FeedSkeleton,
  MarketTileGrid,
  PassList,
  WantedList,
  marketKicker,
  useMarketCampus,
} from './market/MarketSeeAll';
import { SeasonPrompt } from './market/SeasonPrompt';

/** How many of each section the home shows before 'See all'. */
const HOME_LIMITS: Record<MarketSectionId, number> = {
  'clearing-out': 8,
  seats: 4,
  'near-you': 6,
  wanted: 3,
};

const SECTION_EMPTY_LINE: Record<MarketSectionId, string> = {
  'clearing-out': 'No rooms clearing out yet.',
  seats: 'No seats or passes yet.',
  'near-you': 'Nothing near you yet.',
  wanted: 'No asks yet.',
};

/** Filter from the page link: ?kind=ticket,pass or ?furnish=mattress. */
interface LinkFilter {
  kinds: readonly MarketKind[] | 'all' | null;
  furnish: FurnishTileId | 'all' | null;
}

const KIND_SET: ReadonlySet<string> = new Set(MARKET_KINDS);
const FURNISH_IDS: ReadonlySet<string> = new Set(FURNISH_TILES.map((tile) => tile.id));

function readLinkFilter(params: URLSearchParams | null): LinkFilter {
  const rawKind = params?.get('kind')?.trim() ?? '';
  const rawFurnish = params?.get('furnish')?.trim() ?? '';
  let kinds: LinkFilter['kinds'] = null;
  if (rawKind === 'all') kinds = 'all';
  else if (rawKind) {
    const list = rawKind.split(',').filter((kind): kind is MarketKind => KIND_SET.has(kind));
    kinds = list.length ? list : null;
  }
  let furnish: LinkFilter['furnish'] = null;
  if (rawFurnish === 'all') furnish = 'all';
  else if (FURNISH_IDS.has(rawFurnish)) furnish = rawFurnish as FurnishTileId;
  return { kinds, furnish };
}

function hasLinkFilter(filter: LinkFilter): boolean {
  return filter.kinds !== null || filter.furnish !== null;
}

/** The chip that matches the link's kinds, so it shows as picked. */
function activeChip(filter: LinkFilter): AlsoChipId | null {
  if (filter.kinds === 'all') return 'more';
  if (!filter.kinds) return null;
  const wanted = [...filter.kinds].sort().join(',');
  return ALSO_CHIPS.find((chip) => chip.kinds.length && [...chip.kinds].sort().join(',') === wanted)?.id ?? null;
}

/** Furnish tiles a listing covers: an item's title, or each thing in a bundle. */
function furnishTilesOf(listing: MarketFeedListing): FurnishTileId[] {
  const details = listing.details;
  if (details.kind === 'item') {
    const tile = furnishTileFor(listing.title);
    return tile ? [tile] : [];
  }
  if (details.kind === 'bundle') {
    return details.parts.map((part) => furnishTileFor(part.title)).filter((tile): tile is FurnishTileId => tile !== null);
  }
  return [];
}

function matchesLinkFilter(listing: MarketFeedListing, filter: LinkFilter): boolean {
  if (Array.isArray(filter.kinds) && !filter.kinds.includes(listing.kind)) return false;
  if (filter.furnish) {
    const tiles = furnishTilesOf(listing);
    if (filter.furnish === 'all' ? tiles.length === 0 : !tiles.includes(filter.furnish)) return false;
  }
  return true;
}

function linkFilterLabel(filter: LinkFilter): string | null {
  if (filter.furnish === 'all') return 'Room things';
  if (filter.furnish) return FURNISH_TILES.find((tile) => tile.id === filter.furnish)?.label ?? null;
  if (filter.kinds === 'all') return 'Every kind';
  const chip = ALSO_CHIPS.find((item) => item.id === activeChip(filter));
  return chip ? chip.ariaLabel : filter.kinds ? 'Picked kinds' : null;
}

function feedTotal(feed: MarketFeed<MarketFeedListing>): number {
  return feed.clearingOut.length + feed.seats.length + feed.nearYou.length + feed.wanted.length;
}

function sectionListings(feed: MarketFeed<MarketFeedListing>, id: MarketSectionId): MarketFeedListing[] {
  switch (id) {
    case 'clearing-out':
      return feed.clearingOut;
    case 'seats':
      return feed.seats;
    case 'near-you':
      return feed.nearYou;
    case 'wanted':
      return feed.wanted;
  }
}

export function MarketplaceExperience({ audience = 'campus' }: { audience?: CampusAudience }) {
  // useSearchParams needs a Suspense boundary so the page can still prerender.
  return (
    <Suspense fallback={<MarketFallback />}>
      <MarketHome audience={audience} />
    </Suspense>
  );
}

function MarketFallback() {
  return (
    <div className="min-h-screen bg-white px-3 pt-3" aria-busy="true">
      <div className="mx-auto max-w-3xl">
        <div className="h-8 w-1/2 animate-pulse rounded-full bg-surface" />
        <div className="mt-2 h-10 animate-pulse rounded-full bg-surface" />
        <FeedSkeleton className="mt-3" />
      </div>
    </div>
  );
}

type AskState = { state: 'idle' } | { state: 'asking' } | { state: 'done'; q: string; id: string | null };

function MarketHome({ audience }: { audience: CampusAudience }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkFilter = useMemo(() => readLinkFilter(searchParams ? new URLSearchParams(searchParams.toString()) : null), [searchParams]);
  const { items, campus: apiCampus, status, error, now, feed, savedDrops, reload, toggleSave, askWanted } = useMarketFeed(audience);
  // The season prompt reads the demo date in demo mode; the feed stays on real time.
  const seasonNow = useSeasonNow();
  const current = useCurrentCampus();
  const { label, code } = useMarketCampus(apiCampus);
  const paths = marketPaths(audience);

  const [query, setQuery] = useState('');
  const [showDrops, setShowDrops] = useState(false);
  const [ask, setAsk] = useState<AskState>({ state: 'idle' });
  const deferredQuery = useDeferredValue(query);

  const campusId = current?.campusId ?? apiCampus?.id ?? null;
  const collegeId = current?.collegeId ?? getCampus(campusId)?.collegeId ?? null;
  const parsed: ParsedQuery = useMemo(
    () => parseQuery(deferredQuery, { viewerCollegeId: collegeId, campusId }),
    [deferredQuery, collegeId, campusId],
  );
  const searching = deferredQuery.trim() !== '' && !isEmptyQuery(parsed);
  const filtering = searching || hasLinkFilter(linkFilter);

  const results = useMemo(() => {
    if (!filtering) return null;
    const matching = items.filter(
      (item) => isFeedVisible(item, now) && matchesLinkFilter(item, linkFilter) && (!searching || matchItem(item, parsed)),
    );
    return groupMarketFeed(matching, now);
  }, [filtering, items, now, linkFilter, searching, parsed]);

  const onToggleSave = (listing: MarketFeedListing) => void toggleSave(listing);

  const clearFilters = () => {
    setQuery('');
    setAsk({ state: 'idle' });
    if (hasLinkFilter(linkFilter)) router.replace(paths.base, { scroll: false });
  };

  /** One tap: post 'Any {q} available?' with the saved number, else open the form. */
  const runAsk = async (q: string) => {
    if (ask.state === 'asking') return;
    setAsk({ state: 'asking' });
    const result = await askWanted(q, parsed.max ?? null);
    if (result.ok) {
      setAsk({ state: 'done', q, id: result.id });
      return;
    }
    setAsk({ state: 'idle' });
    router.push(result.existingId ? paths.detail(result.existingId) : paths.newPost('wanted', { q: q.trim() }));
  };

  // AskCard is a plain link (the form). Catch a normal tap and try the one-tap ask first.
  const interceptAsk = (q: string) => (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void runAsk(q);
  };

  const askQ = searching ? deferredQuery.trim() : linkFilter.furnish && linkFilter.furnish !== 'all' ? linkFilterLabel(linkFilter)?.toLowerCase() ?? '' : '';
  const prompt = status === 'ready' ? seasonalPrompt(seasonNow) : null;
  const filterLabel = linkFilterLabel(linkFilter);

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <MarketDockSlot
        createUrl={paths.create}
        subtitle={audience === 'girls' ? 'Only Girls’ space members see it' : `Only verified ${code} students see it`}
      />
      <div className="min-h-screen bg-white pb-3">
        <PageHeader
          title="Marketplace"
          kicker={marketKicker(audience, label)}
          backHref={paths.back}
          className="sticky top-[var(--demo-bar-h,0px)] z-30 bg-white pb-1.5"
          actions={
            <>
              <Link href={paths.create} className={swButton({ size: 'pill' })}>
                <PlusIcon size={13} aria-hidden="true" />
                Post
              </Link>
              <IconButton label="My posts" icon={NotesIcon} href={paths.myPosts} />
            </>
          }
        />

        <main className="mx-auto max-w-3xl px-3" aria-busy={status === 'loading'}>
          {status === 'ready' && savedDrops.length ? (
            <section aria-label="Price drops on saved things" className="mb-2">
              <button
                type="button"
                aria-expanded={showDrops}
                onClick={() => setShowDrops((open) => !open)}
                className="campus-press flex w-full min-w-0 items-center gap-2 rounded-[12px] bg-go-tint px-3 py-2 text-left text-go-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
              >
                <PriceDropIcon size={16} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold">
                  Price dropped on {savedDrops.length === 1 ? '1 thing' : `${savedDrops.length} things`} you saved
                </span>
                <ChevronRightIcon size={14} className={cn('shrink-0 transition-transform', showDrops && 'rotate-90')} aria-hidden="true" />
              </button>
              {showDrops ? (
                <MarketTileGrid listings={savedDrops} campusCode={code} now={now} paths={paths} onToggleSave={onToggleSave} className="mt-2" />
              ) : null}
            </section>
          ) : null}

          <SearchPill
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (ask.state === 'done') setAsk({ state: 'idle' });
            }}
            placeholder="Try ‘cycle under 12k’"
            aria-label="Search the market"
            wrapperClassName="h-10"
          />

          {status === 'loading' ? <FeedSkeleton className="mt-3" /> : null}
          {status === 'error' ? <FeedError error={error} onRetry={() => void reload()} className="mt-3" /> : null}

          {status === 'ready' && results ? (
            <ResultsView
              results={results}
              filterLabel={searching ? null : filterLabel}
              activeChipId={activeChip(linkFilter)}
              askQ={askQ}
              ask={ask}
              code={code}
              now={now}
              paths={paths}
              onClear={clearFilters}
              onToggleSave={onToggleSave}
              interceptAsk={interceptAsk}
            />
          ) : null}

          {status === 'ready' && !results ? (
            <>
              <SeasonPrompt
                prompt={prompt}
                href={prompt === 'moving_out' ? paths.newPost('bundle') : prompt === 'set_up_room' ? `${paths.base}?furnish=all` : undefined}
                className="mt-3"
              />
              <FurnishTiles counts={feed.furnishCounts} hrefBase={`${paths.base}?furnish=`} className="pt-3.5" />
              <AlsoChips basePath={paths.base} className="mt-2" />
              {MARKET_SECTIONS.map((section) => (
                <HomeSection
                  key={section.id}
                  id={section.id}
                  title={section.title}
                  listings={sectionListings(feed, section.id)}
                  code={code}
                  now={now}
                  paths={paths}
                  onToggleSave={onToggleSave}
                />
              ))}
            </>
          ) : null}
        </main>
      </div>
    </CampusGate>
  );
}

function SectionBody({
  id,
  listings,
  code,
  now,
  paths,
  onToggleSave,
  row,
}: {
  id: MarketSectionId;
  listings: MarketFeedListing[];
  code: string;
  now: number;
  paths: MarketPaths;
  onToggleSave: (listing: MarketFeedListing) => void;
  /** Rooms clearing out as a side-scrolling row (home) instead of a grid. */
  row?: boolean;
}) {
  switch (id) {
    case 'clearing-out':
      return row ? (
        <div className="-mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 no-scrollbar">
          {listings.map((listing) => (
            <BundleCard key={listing.id} listing={listing} campusLabel={code} href={paths.detail(listing.id)} className="w-[232px] shrink-0" />
          ))}
        </div>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {listings.map((listing) => (
            <BundleCard key={listing.id} listing={listing} campusLabel={code} href={paths.detail(listing.id)} />
          ))}
        </div>
      );
    case 'seats':
      return <PassList listings={listings} paths={paths} className="mt-1" />;
    case 'near-you':
      return <MarketTileGrid listings={listings} campusCode={code} now={now} paths={paths} onToggleSave={onToggleSave} className="mt-2" />;
    case 'wanted':
      return <WantedList listings={listings} campusCode={code} paths={paths} className="mt-2" />;
  }
}

function HomeSection({
  id,
  title,
  listings,
  code,
  now,
  paths,
  onToggleSave,
}: {
  id: MarketSectionId;
  title: string;
  listings: MarketFeedListing[];
  code: string;
  now: number;
  paths: MarketPaths;
  onToggleSave: (listing: MarketFeedListing) => void;
}) {
  const shown = listings.slice(0, HOME_LIMITS[id]);
  return (
    <section className="pt-4" aria-label={title}>
      <SectionHeader title={title} action={{ label: 'See all', href: paths.seeAll(id) }} />
      {shown.length ? (
        <SectionBody id={id} listings={shown} code={code} now={now} paths={paths} onToggleSave={onToggleSave} row />
      ) : (
        <p className="mt-1.5 text-[11.5px] font-semibold text-slate">{SECTION_EMPTY_LINE[id]}</p>
      )}
    </section>
  );
}

function ResultsView({
  results,
  filterLabel,
  activeChipId,
  askQ,
  ask,
  code,
  now,
  paths,
  onClear,
  onToggleSave,
  interceptAsk,
}: {
  results: MarketFeed<MarketFeedListing>;
  /** What the page link filters to, e.g. 'Mattress'. Null while searching. */
  filterLabel: string | null;
  activeChipId: AlsoChipId | null;
  /** What to ask for when nothing matches. Empty means no ask card. */
  askQ: string;
  ask: AskState;
  code: string;
  now: number;
  paths: MarketPaths;
  onClear: () => void;
  onToggleSave: (listing: MarketFeedListing) => void;
  interceptAsk: (q: string) => (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const total = feedTotal(results);
  let askBlock: ReactNode = null;
  if (ask.state === 'done') {
    askBlock = (
      <div role="status" className="mt-2 flex min-w-0 items-center gap-2 rounded-[14px] bg-go-tint p-2.5 text-go-text">
        <CheckIcon size={16} className="shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[12px] font-bold">Asked. Students near you will see it.</p>
        {ask.id ? (
          <Link href={paths.detail(ask.id)} className="shrink-0 text-[12px] font-bold text-ink">
            View
          </Link>
        ) : null}
      </div>
    );
  } else if (!total && askQ) {
    askBlock = (
      <div className={cn('mt-2', ask.state === 'asking' && 'pointer-events-none opacity-60')} aria-busy={ask.state === 'asking'} onClickCapture={interceptAsk(askQ)}>
        <AskCard q={askQ} code={code} href={paths.newPost('wanted', { q: askQ })} />
      </div>
    );
  }

  return (
    <section className="pt-3" aria-label="Search results" aria-live="polite">
      <AlsoChips active={activeChipId} basePath={paths.base} />
      <SectionHeader
        className="mt-3"
        title={total ? `${total} ${total === 1 ? 'match' : 'matches'}` : 'Nothing matches yet'}
        kicker={filterLabel ?? undefined}
        action={{ label: 'Clear', onClick: onClear }}
      />
      {askBlock}
      {!total && !askQ ? (
        <EmptyState icon={MarketIcon} title="Nothing here yet" body="Your post could be the first." className="mt-2" />
      ) : null}
      {MARKET_SECTIONS.map((section) => {
        const listings = sectionListings(results, section.id);
        if (!listings.length) return null;
        return (
          <section key={section.id} className="pt-3.5" aria-label={section.title}>
            <SectionHeader title={section.title} kicker={listings.length === 1 ? '1 post' : `${listings.length} posts`} />
            <SectionBody id={section.id} listings={listings} code={code} now={now} paths={paths} onToggleSave={onToggleSave} />
          </section>
        );
      })}
    </section>
  );
}

/** Dock live slot: "Got something to sell? → Post". Rendered inside the gate so it only shows to members. */
function MarketDockSlot({ createUrl, subtitle }: { createUrl: string; subtitle: string }) {
  useDockSlot({ id: 'market-post', title: 'Got something to sell?', subtitle, tone: 'white', icon: 'tag', action: { label: 'Post', href: createUrl } });
  return null;
}
