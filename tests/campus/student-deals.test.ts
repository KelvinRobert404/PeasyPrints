import assert from 'node:assert/strict';
import test from 'node:test';
import {
  counterClock,
  counterDate,
  dealDistanceMeters,
  firstName,
  isDealLive,
  publicDealDistance,
  sortByDistance,
  validTillLabel,
} from '../../src/lib/campus/studentDeals.ts';

const NOW = new Date('2026-11-07T12:00:00+05:30');
const DAY = 24 * 60 * 60 * 1000;
const ORIGIN = { lat: 13.0592, lng: 77.6416 };

/** A structural DocTime, like a Firestore Timestamp. */
const at = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

test('expired deals are hidden', () => {
  assert.equal(isDealLive({ status: 'active', validUntil: at(NOW.getTime() - 1) }, NOW), false);
  assert.equal(isDealLive({ status: 'active', validUntil: at(NOW.getTime()) }, NOW), false, 'ends at its instant');
  assert.equal(isDealLive({ status: 'active', validUntil: new Date(NOW.getTime() - DAY) }, NOW), false);
  assert.equal(isDealLive({ status: 'active', validUntil: new Date(NOW.getTime() - DAY).toISOString() }, NOW), false);
});

test('live deals show; a missing end date means no end', () => {
  assert.equal(isDealLive({ status: 'active', validUntil: at(NOW.getTime() + DAY) }, NOW), true);
  assert.equal(isDealLive({ status: 'active', validUntil: null }, NOW), true);
  assert.equal(isDealLive({ status: 'active' }, NOW.getTime()), true);
});

test('expired, removed and unreadable deals are hidden even with a future end', () => {
  const future = at(NOW.getTime() + DAY);
  assert.equal(isDealLive({ status: 'expired', validUntil: future }, NOW), false);
  assert.equal(isDealLive({ status: 'removed', validUntil: future }, NOW), false);
  assert.equal(isDealLive({ status: 'active', validUntil: 'not a date' }, NOW), false);
});

test('distance uses coordinates first, then the rough distance', () => {
  const exact = dealDistanceMeters({ place: { lat: ORIGIN.lat + 0.009, lng: ORIGIN.lng, roughDistanceM: 5000 } }, ORIGIN);
  assert.ok(exact !== null && Math.abs(exact - 1000) < 10, `about 1 km, got ${exact}`);
  assert.equal(dealDistanceMeters({ place: { lat: null, lng: null, roughDistanceM: 650 } }, ORIGIN), 650);
  assert.equal(dealDistanceMeters({ place: { lat: 13, lng: 77, roughDistanceM: 650 } }, null), 650, 'no origin falls back');
  assert.equal(dealDistanceMeters({ place: null }, ORIGIN), null);
  assert.equal(publicDealDistance({ place: { roughDistanceM: 662 } }, ORIGIN), 650);
  assert.equal(publicDealDistance({ place: null }, ORIGIN), null);
});

test('sortByDistance puts the nearest first and unknown distances last', () => {
  const deals = [
    { id: 'far', place: { roughDistanceM: 2000 } },
    { id: 'none', place: null },
    { id: 'near', place: { lat: ORIGIN.lat + 0.001, lng: ORIGIN.lng } },
    { id: 'mid', place: { roughDistanceM: 700 } },
  ];
  assert.deepEqual(sortByDistance(deals, ORIGIN).map((deal) => deal.id), ['near', 'mid', 'far', 'none']);
});

test('sortByDistance is stable and does not change its input', () => {
  const deals = [
    { id: 'a', place: { roughDistanceM: 500 } },
    { id: 'b', place: null },
    { id: 'c', place: { roughDistanceM: 500 } },
    { id: 'd', place: { roughDistanceM: 300 } },
    { id: 'e', place: null },
    { id: 'f', place: { roughDistanceM: 500 } },
  ];
  const before = deals.map((deal) => deal.id);
  const sorted = sortByDistance(deals, ORIGIN).map((deal) => deal.id);
  assert.deepEqual(sorted, ['d', 'a', 'c', 'f', 'b', 'e']);
  assert.deepEqual(deals.map((deal) => deal.id), before);
  assert.deepEqual(sortByDistance(sortByDistance(deals, ORIGIN), ORIGIN).map((deal) => deal.id), sorted, 'sorting twice changes nothing');
});

test('valid till reads in IST and shows the last valid day', () => {
  assert.equal(validTillLabel('2026-11-30T18:00:00+05:30'), 'Valid till 30 Nov');
  // Ends at midnight IST on 1 Dec: the last valid day is 30 Nov.
  assert.equal(validTillLabel('2026-12-01T00:00:00+05:30'), 'Valid till 30 Nov');
  // 20:00 UTC on 30 Nov is already 1 Dec in IST.
  assert.equal(validTillLabel(new Date('2026-11-30T20:00:00Z')), 'Valid till 1 Dec');
  assert.equal(validTillLabel(null), 'No end date');
});

test('counter clock and date tick in IST', () => {
  assert.equal(counterClock(new Date('2026-11-07T16:05:09+05:30')), '4:05:09 pm');
  assert.equal(counterClock(new Date('2026-11-07T00:00:00+05:30')), '12:00:00 am');
  assert.equal(counterClock(new Date('2026-11-07T12:30:00+05:30')), '12:30:00 pm');
  assert.equal(counterDate(new Date('2026-11-07T16:05:09+05:30')), 'Sat 7 Nov');
});

test('first name for the counter card', () => {
  assert.equal(firstName('Sana Khan'), 'Sana');
  assert.equal(firstName('  Arjun  '), 'Arjun');
  assert.equal(firstName(''), 'Student');
  assert.equal(firstName(null), 'Student');
});
