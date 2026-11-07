import assert from 'node:assert/strict';
import test from 'node:test';
import { groupMarketFeed, isFeedVisible, listingEndsAt } from '../../src/lib/campus/marketFeed.ts';
import type { FeedListing } from '../../src/lib/campus/marketFeed.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-11-07T06:30:00.000Z');
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

function listing(id: string, details: FeedListing['details'], extra: Partial<FeedListing> = {}): FeedListing {
  return {
    id,
    kind: details.kind,
    status: 'active',
    title: id,
    details,
    createdAt: iso(-DAY),
    reservedUntil: null,
    availabilityExpiresAt: iso(6 * DAY),
    place: null,
    ...extra,
  };
}

const item = (id: string, distance: number | null, extra: Partial<FeedListing> = {}) =>
  listing(id, { kind: 'item', condition: null, brand: null }, { place: { roughDistanceM: distance }, ...extra });

const seat = (id: string, startsIn: number, endsIn: number | null = null) =>
  listing(id, { kind: 'seat', seatFor: 'Ride', startsAt: iso(startsIn), endsAt: endsIn === null ? null : iso(endsIn), seatsLeft: 1 });

const cab = (id: string, leavesIn: number) =>
  listing(id, { kind: 'cab_split', from: 'KJU', to: 'Airport', leavesAt: iso(leavesIn), seatsLeft: 2, totalFare: null });

const ticket = (id: string, happensIn: number) =>
  listing(id, { kind: 'ticket', happensAt: iso(happensIn), venue: null, quantity: 1 });

const pass = (id: string, validFor: number | null) =>
  listing(id, { kind: 'pass', passType: 'bus', validUntil: validFor === null ? null : iso(validFor) });

const ids = (list: readonly FeedListing[]) => list.map((l) => l.id);

test('listings land in the right sections', () => {
  const feed = groupMarketFeed(
    [
      listing('bundle-1', { kind: 'bundle', parts: [{ title: 'Fan', price: 500 }], splitOk: true }),
      listing('wanted-1', { kind: 'wanted', budgetMax: null, neededBy: null }),
      seat('seat-1', 2 * HOUR),
      cab('cab-1', 3 * HOUR),
      ticket('ticket-1', DAY),
      pass('pass-1', 10 * DAY),
      item('item-1', 400),
      listing('vehicle-1', { kind: 'vehicle', vehicleType: 'cycle', offer: 'sale', year: null, kmDriven: null, papersOk: null }),
    ],
    NOW,
  );
  assert.deepEqual(ids(feed.clearingOut), ['bundle-1']);
  assert.deepEqual(ids(feed.wanted), ['wanted-1']);
  assert.deepEqual(ids(feed.seats), ['seat-1', 'cab-1', 'ticket-1', 'pass-1']);
  assert.deepEqual(ids(feed.nearYou), ['item-1', 'vehicle-1']);
});

test('seats sort by soonest end; undated passes go last', () => {
  const feed = groupMarketFeed(
    [pass('open-pass', null), ticket('show', 3 * DAY), seat('batch', HOUR, 5 * DAY), cab('cab', 2 * HOUR), pass('pass', DAY)],
    NOW,
  );
  assert.deepEqual(ids(feed.seats), ['cab', 'pass', 'show', 'batch', 'open-pass']);
});

test('near you sorts by distance, then newest; unknown distance last', () => {
  const feed = groupMarketFeed(
    [
      item('far', 1800),
      item('near-old', 300, { createdAt: iso(-3 * DAY) }),
      item('near-new', 300, { createdAt: iso(-HOUR) }),
      item('unknown', null),
      item('closest', 100),
    ],
    NOW,
  );
  assert.deepEqual(ids(feed.nearYou), ['closest', 'near-new', 'near-old', 'far', 'unknown']);
});

test('ring option drops listings known to be further away', () => {
  const feed = groupMarketFeed([item('in', 500), item('edge', 1000), item('out', 1500), item('unknown', null)], NOW, {
    ring: 1000,
  });
  assert.deepEqual(ids(feed.nearYou), ['in', 'edge', 'unknown']);
});

test('clearing out and wanted are newest first', () => {
  const bundle = (id: string, age: number) =>
    listing(id, { kind: 'bundle', parts: [{ title: 'Kettle', price: 300 }], splitOk: false }, { createdAt: iso(-age) });
  const wanted = (id: string, age: number) =>
    listing(id, { kind: 'wanted', budgetMax: 500, neededBy: null }, { createdAt: iso(-age) });
  const feed = groupMarketFeed([bundle('b-old', 3 * DAY), bundle('b-new', HOUR), wanted('w-old', 2 * DAY), wanted('w-new', HOUR)], NOW);
  assert.deepEqual(ids(feed.clearingOut), ['b-new', 'b-old']);
  assert.deepEqual(ids(feed.wanted), ['w-new', 'w-old']);
});

test('closed, sold, expired and past-dated listings are left out', () => {
  const feed = groupMarketFeed(
    [
      item('sold', 100, { status: 'sold' }),
      item('closed', 100, { status: 'closed' }),
      item('booked', 100, { status: 'booked' }),
      item('stale', 100, { availabilityExpiresAt: iso(-HOUR) }),
      ticket('past-show', -HOUR),
      cab('gone', -2 * HOUR),
      item('reserved', 200, { status: 'reserved', reservedUntil: iso(HOUR) }),
      item('lapsed-reserve', 300, { status: 'reserved', reservedUntil: iso(-HOUR) }),
      item('live', 400),
    ],
    NOW,
  );
  assert.deepEqual(ids(feed.nearYou), ['stale', 'reserved', 'lapsed-reserve', 'live']);
  assert.deepEqual(ids(feed.seats), []);
});

test('isFeedVisible and listingEndsAt', () => {
  assert.equal(isFeedVisible(ticket('t', HOUR), NOW), true);
  assert.equal(isFeedVisible(ticket('t', -HOUR), NOW), false);
  assert.equal(listingEndsAt(seat('s', HOUR, DAY)), iso(DAY));
  assert.equal(listingEndsAt(seat('s', HOUR)), iso(HOUR));
  assert.equal(listingEndsAt(item('i', 100)), null);
});

test('furnish counts: items by title, bundles once per tile, wanted ignored', () => {
  const feed = groupMarketFeed(
    [
      item('Usha table fan', 100, { title: 'Usha table fan' }),
      item('Ceiling fan', 100, { title: 'Ceiling fan' }),
      item('Study table', 100, { title: 'Study table' }),
      item('Sold chair', 100, { title: 'Plastic chair', status: 'sold' }),
      listing('room', {
        kind: 'bundle',
        parts: [
          { title: 'Mattress', price: null },
          { title: 'Bucket and mug', price: null },
          { title: 'Steel bucket', price: null },
          { title: 'Chair', price: null },
        ],
        splitOk: false,
      }),
      listing('ask', { kind: 'wanted', budgetMax: null, neededBy: null }, { title: 'Need a kettle' }),
    ],
    NOW,
  );
  assert.deepEqual(feed.furnishCounts, {
    mattress: 1,
    study_table: 1,
    chair: 1,
    fan: 2,
    cooler: 0,
    bucket_set: 1,
    kettle: 0,
    shelf: 0,
  });
});

test('empty input gives empty sections and zero counts', () => {
  const feed = groupMarketFeed([], NOW);
  assert.deepEqual([feed.clearingOut, feed.seats, feed.nearYou, feed.wanted], [[], [], [], []]);
  assert.ok(Object.values(feed.furnishCounts).every((count) => count === 0));
});
