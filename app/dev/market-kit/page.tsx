import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { AlsoChips } from '@/components/campus/market/AlsoChips';
import { AskCard } from '@/components/campus/market/AskCard';
import { BundleCard } from '@/components/campus/market/BundleCard';
import { FurnishTiles } from '@/components/campus/market/FurnishTiles';
import { ListingCard } from '@/components/campus/market/ListingCard';
import { PassRow } from '@/components/campus/market/PassRow';
import { SeasonPrompt } from '@/components/campus/market/SeasonPrompt';
import { WantedCard } from '@/components/campus/market/WantedCard';
import { getCampus, getCollege } from '@/lib/campus/catalog';
import { KJU_MAIN, type FixtureDoc } from '@/lib/campus/fixtures/core';
import { buildMarketListings } from '@/lib/campus/fixtures/market';
import { groupMarketFeed } from '@/lib/campus/marketFeed';
import { seasonalPrompt } from '@/lib/campus/season';
import { DEFAULT_FIXTURE_USER_ID, isFixtureMode } from '@/lib/firebase/fixtureMode';
import { fairPassPrice } from '@/lib/format/price';
import type { DocTime, SerializedDoc } from '@/types/campus';
import type { MarketListing, MarketListingDoc, MarketStatus } from '@/types/market';

export const metadata: Metadata = {
  title: 'Market kit',
  robots: { index: false, follow: false },
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Saved in this preview only, to show the saved state. */
const SAVED_IDS = new Set(['mkt-study-lamp', 'mkt-cycle']);

/* Local doc-to-card adapter: stored fixture doc -> MarketListing as the client gets it. */

function isDocTime(value: object): value is DocTime {
  return typeof (value as { toDate?: unknown }).toDate === 'function';
}

/** Every DocTime becomes an ISO string, as the API serializer does. */
function toPlain(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (isDocTime(value)) return value.toDate().toISOString();
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, toPlain(inner)]));
}

function toListing(doc: FixtureDoc<MarketListingDoc>, viewerId: string): MarketListing {
  const plain = toPlain(doc.data) as SerializedDoc<MarketListingDoc>;
  const { authorId, reservedBy, sellerDisplayName, place, ...rest } = plain;
  return {
    ...rest,
    id: doc.id,
    place: place
      ? { landmarkId: place.landmarkId, label: place.label, area: place.area, campusId: place.campusId, roughDistanceM: place.roughDistanceM }
      : null,
    seller: { displayName: sellerDisplayName, verified: true },
    reservedByViewer: reservedBy === viewerId,
    isSaved: SAVED_IDS.has(doc.id),
    isOwner: authorId === viewerId,
  };
}

function loadKit() {
  const now = new Date();
  const listings = buildMarketListings(now).map((doc) => toListing(doc, DEFAULT_FIXTURE_USER_ID));
  const byKind = (...kinds: MarketListing['kind'][]) => listings.filter((listing) => kinds.includes(listing.kind));
  return { now, listings, byKind };
}

/** Sample fair price for a pass: the fixtures do not store what was paid. */
function sampleFairPrice(listing: MarketListing, now: Date): number | null {
  if (listing.details.kind !== 'pass' || !listing.details.validUntil) return null;
  const until = Date.parse(listing.details.validUntil);
  const paid = listing.details.passType === 'gym' ? 3000 : 900;
  const days = listing.details.passType === 'gym' ? 90 : 30;
  return fairPassPrice({ paid, validFrom: until - days * DAY_MS, validUntil: until, now });
}

function withStatus(listing: MarketListing, status: MarketStatus, extra: Partial<MarketListing> = {}): MarketListing {
  return { ...listing, ...extra, id: `${listing.id}-${status}${extra.reservedByViewer ? '-you' : ''}`, status };
}

function Block({ name, note, children }: { name: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 pt-3.5">
      <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">{name}</h2>
      {note ? <p className="mt-0.5 text-[11px] text-slate">{note}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Dev only: every market card built from the SEED fixtures. 404 outside fixture mode. */
export default function DevMarketKitPage() {
  if (!isFixtureMode()) notFound();

  const campus = getCampus(KJU_MAIN);
  const college = getCollege(campus?.collegeId);
  if (!campus || !college) notFound();
  const code = college.code;

  const { now, listings, byKind } = loadKit();
  const nowIso = now.toISOString();
  const feed = groupMarketFeed(listings, now);
  const season = seasonalPrompt(now);

  const items = byKind('item', 'vehicle').filter((listing) => listing.audience === 'campus');
  const headphones = items.find((listing) => listing.id === 'mkt-headphones') ?? items[0];
  const states: { label: string; listing: MarketListing }[] = headphones
    ? [
        { label: 'Price dropped', listing: headphones },
        { label: 'Reserved', listing: withStatus(headphones, 'reserved') },
        { label: 'Reserved for you', listing: withStatus(headphones, 'reserved', { reservedByViewer: true }) },
        { label: 'Booked', listing: withStatus(headphones, 'booked') },
        { label: 'Sold', listing: withStatus(headphones, 'sold') },
        { label: 'Expired', listing: withStatus(headphones, 'expired') },
      ]
    : [];

  const passes = byKind('seat', 'cab_split', 'ticket', 'pass');
  const kochi = passes.find((listing) => listing.id === 'mkt-seat-kochi');
  const passRows = kochi ? [...passes, withStatus(kochi, 'booked')] : passes;

  return (
    <main className="mx-auto w-full max-w-5xl px-3 pb-3 pt-2">
      <p className="text-[10.5px] font-semibold text-slate">Fixture mode · {campus.label}</p>
      <h1 className="font-heading text-[16px] leading-[1.1] text-ink">Market kit</h1>
      <p className="mt-0.5 text-[11px] text-slate">{listings.length} seed posts. Today: {season ? season.replace(/_/g, ' ') : 'no season'}.</p>

      <Block name="Season prompts" note="Shown by season. Both here.">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <SeasonPrompt prompt="moving_out" />
          <SeasonPrompt prompt="set_up_room" />
        </div>
      </Block>

      <Block name="Furnish tiles" note="Counts from the seed feed.">
        <FurnishTiles counts={feed.furnishCounts} title={null} />
        <AlsoChips className="mt-2" />
        <AlsoChips className="mt-2" active="tickets" />
      </Block>

      <Block name="Listing cards" note="3-up. Seed items and vehicles.">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} campusLabel={code} now={nowIso} />
          ))}
        </div>
      </Block>

      <Block name="Listing states" note="One post in every state.">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {states.map(({ label, listing }) => (
            <div key={listing.id} className="min-w-0">
              <p className="mb-1 truncate text-[10.5px] font-bold text-slate">{label}</p>
              <ListingCard listing={listing} campusLabel={code} now={nowIso} />
            </div>
          ))}
        </div>
      </Block>

      <Block name="Bundles" note="Room art when there is no photo.">
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 no-scrollbar">
          {byKind('bundle').map((listing) => (
            <BundleCard key={listing.id} listing={listing} campusLabel={code} className="w-[232px] shrink-0" />
          ))}
        </div>
      </Block>

      <Block name="Seats, tickets and passes" note="Fair price uses a sample paid amount.">
        <div className="rounded-[14px] border border-line bg-white px-2.5">
          {passRows.map((listing, index) => (
            <PassRow
              key={listing.id}
              listing={listing}
              fairPrice={sampleFairPrice(listing, now)}
              divider={index < passRows.length - 1}
            />
          ))}
        </div>
      </Block>

      <Block name="Wanted">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {byKind('wanted').map((listing) => (
            <WantedCard key={listing.id} listing={listing} campusLabel={code} />
          ))}
        </div>
      </Block>

      <Block name="Ask card" note="When a search finds nothing.">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <AskCard q="mini fridge" code={code} />
          <AskCard q="" code={code} />
        </div>
      </Block>
    </main>
  );
}
