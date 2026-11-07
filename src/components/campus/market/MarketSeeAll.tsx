'use client';

// 'See all' screens for the four market sections, plus the pieces the market
// home shares with them: the saveable 3-up tile, skeleton and error states.

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { AlertIcon, BookmarkIcon, MarketIcon, NotesIcon, PinIcon, PlusIcon } from '@/components/swoop/icons';
import { EmptyState, IconButton, PageHeader, SectionHeader, swButton } from '@/components/swoop/primitives';
import { CampusGate } from '@/components/campus/CampusGate';
import { RingChips } from '@/components/campus/places/RingChips';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import {
  marketPaths,
  useMarketFeed,
  type MarketCampusRef,
  type MarketFeedListing,
  type MarketPaths,
} from '@/hooks/useMarketFeed';
import { MARKET_SECTIONS, type MarketSectionId } from '@/lib/campus/market';
import type { Instant } from '@/lib/campus/listingRules';
import { DEFAULT_RING, ringLabel, type DistanceRing } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience } from '@/types/campus';
import { BundleCard } from './BundleCard';
import { ListingCard } from './ListingCard';
import { PassRow } from './PassRow';
import { WantedCard } from './WantedCard';

const SHADOW = 'shadow-[0_1px_3px_rgba(16,24,40,0.14)]';

/** Header names for the market screens: 'KJU Main' and the short 'KJU'. */
export function useMarketCampus(fromApi: MarketCampusRef | null): { label: string; code: string } {
  const current = useCurrentCampus();
  return {
    label: current?.label ?? fromApi?.label ?? 'Your campus',
    code: current?.code ?? fromApi?.code ?? 'campus',
  };
}

/** 'KJU Main · only verified students', or the Girls' space line. */
export function marketKicker(audience: CampusAudience, label: string): string {
  return audience === 'girls' ? `Girls’ space · ${label}` : `${label} · only verified students`;
}

/** ListingCard with the save button wired to the feed's optimistic save. */
export function MarketTile({
  listing,
  campusCode,
  now,
  paths,
  onToggleSave,
  className,
}: {
  listing: MarketFeedListing;
  campusCode: string;
  now: Instant;
  paths: MarketPaths;
  onToggleSave: (listing: MarketFeedListing) => void;
  className?: string;
}) {
  const saved = Boolean(listing.isSaved);
  return (
    <div className={cn('relative min-w-0', className)}>
      <ListingCard listing={listing} campusLabel={campusCode} now={now} href={paths.detail(listing.id)} saveable={false} />
      {listing.isOwner ? null : (
        <button
          type="button"
          aria-label={saved ? `Remove ${listing.title} from saved` : `Save ${listing.title}`}
          aria-pressed={saved}
          onClick={() => onToggleSave(listing)}
          className={cn(
            'campus-press absolute right-1 top-1 z-10 grid h-8 w-8 place-items-center rounded-full bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40',
            SHADOW,
            saved ? 'text-royal' : 'text-ink',
          )}
        >
          <BookmarkIcon size={14} filled={saved} />
        </button>
      )}
    </div>
  );
}

/** 3-up grid of saveable tiles. */
export function MarketTileGrid({
  listings,
  campusCode,
  now,
  paths,
  onToggleSave,
  className,
}: {
  listings: readonly MarketFeedListing[];
  campusCode: string;
  now: Instant;
  paths: MarketPaths;
  onToggleSave: (listing: MarketFeedListing) => void;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-3 gap-x-1.5 gap-y-3', className)}>
      {listings.map((listing) => (
        <MarketTile key={listing.id} listing={listing} campusCode={campusCode} now={now} paths={paths} onToggleSave={onToggleSave} />
      ))}
    </div>
  );
}

/** Seats, cab splits, tickets and passes as one divided list. */
export function PassList({ listings, paths, className }: { listings: readonly MarketFeedListing[]; paths: MarketPaths; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {listings.map((listing, index) => (
        <PassRow key={listing.id} listing={listing} href={paths.detail(listing.id)} divider={index < listings.length - 1} />
      ))}
    </div>
  );
}

export function WantedList({
  listings,
  campusCode,
  paths,
  className,
}: {
  listings: readonly MarketFeedListing[];
  campusCode: string;
  paths: MarketPaths;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5 sm:grid-cols-2', className)}>
      {listings.map((listing) => (
        <WantedCard key={listing.id} listing={listing} campusLabel={campusCode} href={paths.detail(listing.id)} />
      ))}
    </div>
  );
}

export function FeedSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-3 gap-x-1.5 gap-y-3', className)} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex flex-col gap-1">
          <div className="aspect-square animate-pulse rounded-[12px] bg-surface" />
          <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-surface" />
          <div className="h-2 w-1/2 animate-pulse rounded-full bg-surface" />
        </div>
      ))}
    </div>
  );
}

export function FeedError({ error, onRetry, className }: { error: string; onRetry: () => void; className?: string }) {
  return (
    <EmptyState
      icon={AlertIcon}
      title="Couldn’t load the market"
      body={error}
      action={
        <button type="button" onClick={onRetry} className={swButton({ variant: 'white', size: 'pill' })}>
          Retry
        </button>
      }
      className={className}
    />
  );
}

/** What 'Post' makes on each See all screen. */
const SECTION_POST_KIND: Record<MarketSectionId, string> = {
  'clearing-out': 'bundle',
  seats: 'seat',
  'near-you': 'item',
  wanted: 'wanted',
};

const SECTION_EMPTY: Record<MarketSectionId, { title: string; body: string }> = {
  'clearing-out': { title: 'No rooms clearing out yet', body: 'Moving out? Post your room as a bundle.' },
  seats: { title: 'No seats or passes yet', body: 'Got a spare seat? Pass it on.' },
  'near-you': { title: 'Nothing near you yet', body: 'Your post could be the first.' },
  wanted: { title: 'No asks yet', body: 'Need something? Ask students near you.' },
};

function hasPin(listing: MarketFeedListing): boolean {
  const distance = listing.place?.roughDistanceM;
  return typeof distance === 'number' && Number.isFinite(distance);
}

/** Full list for one market section. */
export function MarketSeeAll({ section, audience = 'campus' }: { section: MarketSectionId; audience?: CampusAudience }) {
  const [ring, setRing] = useState<DistanceRing>(DEFAULT_RING);
  const nearYou = section === 'near-you';
  const { campus: apiCampus, status, error, now, feed, reload, toggleSave } = useMarketFeed(audience, nearYou ? { ring } : {});
  const { label, code } = useMarketCampus(apiCampus);
  const paths = marketPaths(audience);
  const meta = MARKET_SECTIONS.find((item) => item.id === section) ?? MARKET_SECTIONS[0];
  const empty = SECTION_EMPTY[section];

  const listings =
    section === 'clearing-out' ? feed.clearingOut : section === 'seats' ? feed.seats : section === 'wanted' ? feed.wanted : feed.nearYou;
  const pinned = nearYou ? listings.filter(hasPin) : [];
  const noPin = nearYou ? listings.filter((listing) => !hasPin(listing)) : [];

  let body: ReactNode;
  if (status === 'loading') {
    body = <FeedSkeleton className="mt-2" />;
  } else if (status === 'error') {
    body = <FeedError error={error} onRetry={() => void reload()} className="mt-2" />;
  } else if (!listings.length) {
    body = (
      <EmptyState
        icon={MarketIcon}
        title={empty.title}
        body={empty.body}
        action={
          <Link href={paths.newPost(SECTION_POST_KIND[section])} className={swButton({ variant: 'white', size: 'pill' })}>
            Post
          </Link>
        }
        className="mt-2"
      />
    );
  } else if (section === 'clearing-out') {
    body = (
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {listings.map((listing) => (
          <BundleCard key={listing.id} listing={listing} campusLabel={code} href={paths.detail(listing.id)} />
        ))}
      </div>
    );
  } else if (section === 'seats') {
    body = <PassList listings={listings} paths={paths} className="mt-1" />;
  } else if (section === 'wanted') {
    body = <WantedList listings={listings} campusCode={code} paths={paths} className="mt-2" />;
  } else {
    body = (
      <>
        {pinned.length ? (
          <MarketTileGrid listings={pinned} campusCode={code} now={now} paths={paths} onToggleSave={(item) => void toggleSave(item)} className="mt-2" />
        ) : (
          <p className="mt-2 rounded-[12px] bg-surface px-3 py-2.5 text-[11.5px] font-semibold text-slate">Nothing pinned {ringLabel(ring).toLowerCase()}.</p>
        )}
        {noPin.length ? (
          <section className="pt-4" aria-label="No pin yet">
            <SectionHeader title="No pin yet" kicker="Seller has not picked a spot" />
            <MarketTileGrid listings={noPin} campusCode={code} now={now} paths={paths} onToggleSave={(item) => void toggleSave(item)} className="mt-2" />
          </section>
        ) : null}
      </>
    );
  }

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="min-h-screen bg-white pb-3">
        <PageHeader
          title={meta.title}
          kicker={marketKicker(audience, label)}
          backHref={paths.base}
          className="sticky top-0 z-30 bg-white pb-1.5"
          actions={
            <>
              <IconButton label="Post" icon={PlusIcon} href={paths.newPost(SECTION_POST_KIND[section])} />
              <IconButton label="My posts" icon={NotesIcon} href={paths.myPosts} />
            </>
          }
        />
        <main className="mx-auto max-w-3xl px-3" aria-busy={status === 'loading'}>
          {nearYou ? (
            <div className="flex min-w-0 items-center gap-2 pt-1">
              <PinIcon size={15} className="shrink-0 text-ink" aria-hidden="true" />
              <RingChips value={ring} onChange={setRing} label="Distance from campus" />
            </div>
          ) : null}
          {status === 'ready' && listings.length ? (
            <p className="pt-2 text-[11px] font-semibold text-slate">
              {nearYou
                ? `${pinned.length} ${ringLabel(ring).toLowerCase()} of ${code}`
                : listings.length === 1
                  ? '1 post'
                  : `${listings.length} posts`}
            </p>
          ) : null}
          {body}
        </main>
      </div>
    </CampusGate>
  );
}
