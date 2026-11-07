import assert from 'node:assert/strict';
import test from 'node:test';
import type { HousingCardItem } from '../../src/components/campus/housing/HousingListingCard.tsx';
import {
  HOUSING_NUDGE_MS,
  housingDistanceM,
  housingNeedsNudge,
  serializeHousingListing,
  type SerializedHousingListing,
  type ViewerOrigin,
} from '../../src/lib/campus/housing/serialize.ts';
import { haversineMeters, roundForPrivacy } from '../../src/lib/format/distance.ts';

// Compile-time: a serialized listing fits the housing card as is.
const fitsCard = (item: SerializedHousingListing): HousingCardItem => item;
void fitsCard;

const NOW = new Date('2026-11-07T10:00:00+05:30');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Structural Firestore timestamp, as the fixture DB stores them. */
function ts(ms: number) {
  return { toDate: () => new Date(ms), toMillis: () => ms };
}

function ago(ms: number) {
  return ts(NOW.getTime() - ms);
}

function ahead(ms: number) {
  return ts(NOW.getTime() + ms);
}

const MAIN: ViewerOrigin = { campusId: 'kju-main', lat: 13.0656, lng: 77.6421 };
const AIRPORT: ViewerOrigin = { campusId: 'kju-airport', lat: 13.1508, lng: 77.6366 };
const LANDMARK = { lat: 13.0702, lng: 77.6469 };

function doc(id: string, overrides: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = {
    authorId: 'owner-1',
    serial: 'KJU-H0001',
    collegeId: 'kju',
    collegeCode: 'KJU',
    campusId: 'kju-main',
    audience: 'campus',
    kind: 'room',
    postedAs: 'tenant',
    stayType: 'pg',
    status: 'active',
    title: 'Twin sharing PG near Falcon',
    description: 'Clean room.',
    brokerage: { charged: false, amount: null },
    whoCanStay: 'boys',
    houseRules: ['no_smoking', 'no_restrictions'],
    moveIn: null,
    bedsLeft: 1,
    sharing: 2,
    rentPp: 9500,
    deposit: 15000,
    rentTerms: 'negotiable',
    furnishing: 'furnished',
    amenities: ['Wifi'],
    images: [],
    place: {
      landmarkId: 'kju-main-falcon',
      label: 'Falcon Hospital',
      area: 'Kothanur',
      lat: LANDMARK.lat,
      lng: LANDMARK.lng,
      campusId: 'kju-main',
      roughDistanceM: 700,
    },
    roommate: null,
    posterDisplayName: 'Farhan',
    promotionEligible: true,
    previousRentPp: null,
    priceDroppedAt: null,
    reservedUntil: null,
    confirmedAt: null,
    createdAt: ago(1 * DAY),
    updatedAt: ago(1 * DAY),
    availabilityExpiresAt: ahead(6 * DAY),
    ...overrides,
  };
  return { id, data: () => data };
}

test('reserved holds while reservedUntil is ahead', () => {
  const item = serializeHousingListing(doc('h1', { status: 'reserved', reservedUntil: ahead(2 * HOUR) }), 'viewer', new Set(), MAIN, NOW);
  assert.equal(item.status, 'reserved');
  assert.equal(item.reservedUntil, new Date(NOW.getTime() + 2 * HOUR).toISOString());
});

test('a lapsed reserve reads active again, with no reservedUntil', () => {
  const item = serializeHousingListing(doc('h1', { status: 'reserved', reservedUntil: ago(1) }), 'viewer', new Set(), MAIN, NOW);
  assert.equal(item.status, 'active');
  assert.equal(item.reservedUntil, null);
});

test('active past the 7-day window needs confirmation; booked passes through', () => {
  const stale = serializeHousingListing(doc('h1', { availabilityExpiresAt: ago(1) }), 'viewer', new Set(), MAIN, NOW);
  assert.equal(stale.status, 'needs_confirmation');
  const booked = serializeHousingListing(doc('h2', { status: 'booked', availabilityExpiresAt: ago(DAY) }), 'viewer', new Set(), MAIN, NOW);
  assert.equal(booked.status, 'booked');
});

test('nudge is owner only, from 72 h after the last confirm', () => {
  const justUnder = doc('h1', { confirmedAt: ago(72 * HOUR - 1), createdAt: ago(10 * DAY), availabilityExpiresAt: ahead(4 * DAY) });
  const atMark = doc('h2', { confirmedAt: ago(72 * HOUR), createdAt: ago(10 * DAY), availabilityExpiresAt: ahead(4 * DAY) });
  assert.equal(serializeHousingListing(justUnder, 'owner-1', new Set(), MAIN, NOW).needsNudge, false);
  assert.equal(serializeHousingListing(atMark, 'owner-1', new Set(), MAIN, NOW).needsNudge, true);
  assert.equal(serializeHousingListing(atMark, 'someone-else', new Set(), MAIN, NOW).needsNudge, false);
  assert.equal(HOUSING_NUDGE_MS, 72 * HOUR);
});

test('nudge falls back to the post date and skips reserved or closed posts', () => {
  const never = doc('h1', { createdAt: ago(3 * DAY), confirmedAt: null });
  assert.equal(serializeHousingListing(never, 'owner-1', new Set(), MAIN, NOW).needsNudge, true);
  const fresh = doc('h2', { createdAt: ago(2 * DAY), confirmedAt: null });
  assert.equal(serializeHousingListing(fresh, 'owner-1', new Set(), MAIN, NOW).needsNudge, false);
  const reserved = doc('h3', { createdAt: ago(5 * DAY), status: 'reserved', reservedUntil: ahead(HOUR) });
  assert.equal(serializeHousingListing(reserved, 'owner-1', new Set(), MAIN, NOW).needsNudge, false);
  const closed = doc('h4', { createdAt: ago(5 * DAY), status: 'closed' });
  assert.equal(serializeHousingListing(closed, 'owner-1', new Set(), MAIN, NOW).needsNudge, false);
  assert.equal(housingNeedsNudge({ status: 'needs_confirmation', confirmedAt: null, createdAt: ago(8 * DAY).toDate().toISOString() }, true, NOW), true);
});

test('distance is measured from each viewer campus and coordinates never leave', () => {
  const listing = doc('h1');
  const main = serializeHousingListing(listing, 'viewer', new Set(), MAIN, NOW);
  const airport = serializeHousingListing(listing, 'viewer', new Set(), AIRPORT, NOW);
  assert.equal(main.distanceM, roundForPrivacy(haversineMeters(MAIN, LANDMARK)));
  assert.equal(airport.distanceM, roundForPrivacy(haversineMeters(AIRPORT, LANDMARK)));
  assert.notEqual(main.distanceM, airport.distanceM);
  assert.equal(main.place.roughDistanceM, main.distanceM);
  assert.equal('lat' in main.place, false);
  assert.equal('lng' in main.place, false);
  assert.equal('authorId' in main, false);
  assert.equal(serializeHousingListing(listing, 'viewer', new Set(), null, NOW).distanceM, null);
});

test('a typed rough distance only counts on the poster campus', () => {
  const typed = doc('h1', {
    place: { landmarkId: null, label: 'Near Hennur Cross', area: 'Hennur', lat: null, lng: null, campusId: 'kju-main', roughDistanceM: 1800 },
  });
  assert.equal(serializeHousingListing(typed, 'viewer', new Set(), MAIN, NOW).distanceM, 1800);
  assert.equal(serializeHousingListing(typed, 'viewer', new Set(), AIRPORT, NOW).distanceM, null);
  assert.equal(serializeHousingListing(typed, 'viewer', new Set(), AIRPORT, NOW).place.roughDistanceM, null);
  assert.equal(housingDistanceM(null, MAIN), null);
});

test('price-drop fields: badge for 7 days after a real drop', () => {
  const dropped = doc('h1', { rentPp: 7500, previousRentPp: 8500, priceDroppedAt: ago(2 * DAY) });
  const item = serializeHousingListing(dropped, 'viewer', new Set(), MAIN, NOW);
  assert.equal(item.rentPp, 7500);
  assert.equal(item.previousRentPp, 8500);
  assert.equal(item.priceDroppedAt, new Date(NOW.getTime() - 2 * DAY).toISOString());
  assert.equal(item.priceDropped, true);

  const old = doc('h2', { rentPp: 7500, previousRentPp: 8500, priceDroppedAt: ago(7 * DAY) });
  assert.equal(serializeHousingListing(old, 'viewer', new Set(), MAIN, NOW).priceDropped, false);
  const none = serializeHousingListing(doc('h3'), 'viewer', new Set(), MAIN, NOW);
  assert.equal(none.priceDropped, false);
  assert.equal(none.previousRentPp, null);
  assert.equal(none.priceDroppedAt, null);
});

test('viewer flags, poster and normalised fields', () => {
  const item = serializeHousingListing(doc('h1'), 'owner-1', new Set(['h1']), MAIN, NOW);
  assert.equal(item.isOwner, true);
  assert.equal(item.isSaved, true);
  assert.deepEqual(item.poster, { displayName: 'Farhan', verified: true });
  assert.deepEqual(item.houseRules, ['no_smoking']);
  assert.equal(item.rentTerms, 'negotiable');
  assert.equal(item.createdAt, new Date(NOW.getTime() - DAY).toISOString());

  const other = serializeHousingListing(doc('h1'), 'viewer', new Set(), MAIN, NOW);
  assert.equal(other.isOwner, false);
  assert.equal(other.isSaved, false);
});

test('girls posts are for girls and never promoted; legacy docs still read', () => {
  const girls = serializeHousingListing(doc('h1', { audience: 'girls', whoCanStay: 'anyone', promotionEligible: true }), 'viewer', new Set(), MAIN, NOW);
  assert.equal(girls.whoCanStay, 'girls');
  assert.equal(girls.promotionEligible, false);

  const legacy = serializeHousingListing(
    doc('h2', {
      kind: undefined,
      rentTerms: { period: 'quarterly', includes: ['wifi', 'gym'], noticeMonths: 1 },
      roommate: { sleep: 'late', tidiness: null, smoking: 'no', note: null },
    }),
    'viewer',
    new Set(),
    MAIN,
    NOW,
  );
  assert.equal(legacy.kind, 'room');
  assert.deepEqual(legacy.rentTerms, { period: 'quarterly', includes: ['wifi'], noticeMonths: 1 });
  assert.deepEqual(legacy.roommate, { sleep: 'late', tidiness: null, smoking: 'no', note: null, groupSize: null, languages: [], homeState: null });
});
