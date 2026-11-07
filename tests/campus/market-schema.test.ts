import assert from 'node:assert/strict';
import test from 'node:test';
import { marketCreateSchema, marketPatchSchema } from '../../src/lib/campus/marketSchema.ts';
import {
  ALSO_CHIPS,
  DEFAULT_PLATE_STATE,
  FURNISH_TILES,
  MARKET_SECTIONS,
  PLATE_STATE_CODES,
  furnishTileFor,
} from '../../src/lib/campus/market.ts';

const photo = (n: number) => `/api/campus/media/m${n}`;
const photos = (count: number) => Array.from({ length: count }, (_, i) => photo(i));

const base = { title: 'Usha table fan', price: 600 };

function issuesFor(input: unknown): string[] {
  const result = marketCreateSchema.safeParse(input);
  assert.equal(result.success, false, 'expected the input to be rejected');
  return result.error!.issues.map((issue) => issue.path.join('.'));
}

test('item: accepted with landmark, defaults filled', () => {
  const parsed = marketCreateSchema.parse({ ...base, kind: 'item', landmarkId: 'main-gate' });
  assert.equal(parsed.kind, 'item');
  assert.equal(parsed.category, 'other');
  assert.equal(parsed.priceTerms, 'fixed');
  assert.equal(parsed.genderPref, 'anyone');
  assert.deepEqual(parsed.images, []);
  assert.equal(parsed.description, undefined);
});

test('item, bundle and vehicle need a landmark', () => {
  assert.deepEqual(issuesFor({ ...base, kind: 'item' }), ['landmarkId']);
  assert.ok(issuesFor({ ...base, kind: 'bundle', parts: [{ title: 'Fan' }] }).includes('landmarkId'));
  assert.ok(issuesFor({ ...base, kind: 'vehicle', vehicleType: 'cycle' }).includes('landmarkId'));
});

test('ticket: above face value rejected, at or below accepted', () => {
  const ticket = { title: 'Sunburn pass', kind: 'ticket', happensAt: '2026-12-01T18:00:00+05:30', faceValue: 1500 };
  assert.deepEqual(issuesFor({ ...ticket, price: 1600 }), ['price']);
  assert.equal(marketCreateSchema.parse({ ...ticket, price: 1500 }).kind, 'ticket');
  assert.equal(marketCreateSchema.parse({ ...ticket, price: 900 }).kind, 'ticket');
  assert.ok(issuesFor({ ...ticket, price: 900, faceValue: undefined }).includes('faceValue'));
});

test('seat and cab split need a departure time', () => {
  const seat = { title: 'Seat to Mysore', price: 300, kind: 'seat', seatFor: 'Ride to Mysore', seatsLeft: 2 };
  assert.deepEqual(issuesFor(seat), ['departureAt']);
  assert.equal(marketCreateSchema.parse({ ...seat, departureAt: '2026-11-20T07:00:00+05:30' }).kind, 'seat');
  const cab = { title: 'Airport cab', price: 400, kind: 'cab_split', from: 'KJU', to: 'Airport', seatsLeft: 3 };
  assert.deepEqual(issuesFor(cab), ['departureAt']);
  assert.equal(marketCreateSchema.parse({ ...cab, departureAt: '2026-11-20T05:00:00+05:30' }).kind, 'cab_split');
  assert.deepEqual(issuesFor({ ...cab, departureAt: 'tomorrow' }), ['departureAt']);
});

test('seat end must come after the start', () => {
  const seat = {
    title: 'Library slot',
    price: 200,
    kind: 'seat',
    seatFor: 'Library slot',
    seatsLeft: 1,
    departureAt: '2026-11-20T09:00:00+05:30',
  };
  assert.deepEqual(issuesFor({ ...seat, endsAt: '2026-11-20T08:00:00+05:30' }), ['endsAt']);
});

test('scooter and bike need a plate state, cycle does not', () => {
  const vehicle = { title: 'Activa 5G', price: 35000, kind: 'vehicle', landmarkId: 'main-gate' };
  assert.deepEqual(issuesFor({ ...vehicle, vehicleType: 'scooter' }), ['plateState']);
  assert.deepEqual(issuesFor({ ...vehicle, vehicleType: 'bike' }), ['plateState']);
  assert.equal(marketCreateSchema.parse({ ...vehicle, vehicleType: 'scooter', plateState: 'KA' }).kind, 'vehicle');
  assert.equal(marketCreateSchema.parse({ ...vehicle, vehicleType: 'cycle' }).kind, 'vehicle');
  assert.deepEqual(issuesFor({ ...vehicle, vehicleType: 'scooter', plateState: 'XX' }), ['plateState']);
});

test('bundle: 1 to 20 things, up to 8 photos', () => {
  const bundle = { title: 'Room clear-out', price: 3000, kind: 'bundle', landmarkId: 'main-gate' };
  const parts = (count: number) => Array.from({ length: count }, (_, i) => ({ title: `Thing ${i + 1}` }));
  assert.deepEqual(issuesFor({ ...bundle, parts: [] }), ['parts']);
  assert.deepEqual(issuesFor({ ...bundle, parts: parts(21) }), ['parts']);
  assert.equal(marketCreateSchema.parse({ ...bundle, parts: parts(1) }).kind, 'bundle');
  assert.equal(marketCreateSchema.parse({ ...bundle, parts: parts(20), images: photos(8) }).kind, 'bundle');
  assert.deepEqual(issuesFor({ ...bundle, parts: parts(2), images: photos(9) }), ['images']);
});

test('bundle priced only by its things is fine; no price at all is not', () => {
  const bundle = { title: 'Room clear-out', kind: 'bundle', landmarkId: 'main-gate' };
  assert.equal(marketCreateSchema.parse({ ...bundle, parts: [{ title: 'Fan', price: 500 }] }).kind, 'bundle');
  assert.deepEqual(issuesFor({ ...bundle, parts: [{ title: 'Fan' }] }), ['price']);
});

test('other kinds take up to 5 photos, uploaded media only', () => {
  const item = { ...base, kind: 'item', landmarkId: 'main-gate' };
  assert.equal(marketCreateSchema.parse({ ...item, images: photos(5) }).images.length, 5);
  assert.deepEqual(issuesFor({ ...item, images: photos(6) }), ['images']);
  assert.deepEqual(issuesFor({ ...item, images: ['https://example.com/a.jpg'] }), ['images.0']);
});

test('wanted: one-tap ask with no description is accepted', () => {
  const parsed = marketCreateSchema.parse({ kind: 'wanted', title: 'Need a drafter' });
  assert.equal(parsed.kind, 'wanted');
  assert.equal(parsed.description, undefined);
  assert.equal(parsed.price, null);
  assert.equal(marketCreateSchema.parse({ kind: 'wanted', title: 'Need a drafter', description: '' }).kind, 'wanted');
});

test('price: needed unless free or swap, and free carries none', () => {
  const item = { title: 'Old novels', kind: 'item', landmarkId: 'library' };
  assert.deepEqual(issuesFor(item), ['price']);
  assert.equal(marketCreateSchema.parse({ ...item, priceTerms: 'free' }).price, null);
  assert.deepEqual(issuesFor({ ...item, priceTerms: 'free', price: 100 }), ['price']);
  assert.deepEqual(issuesFor({ ...item, price: 99.5 }), ['price']);
});

test('whatsapp number is optional, normalised, and exclusive with the saved number', () => {
  const item = { ...base, kind: 'item', landmarkId: 'main-gate' };
  assert.equal(marketCreateSchema.parse(item).whatsappNumber, undefined);
  assert.equal(marketCreateSchema.parse({ ...item, whatsappNumber: '+91 98450-12345' }).whatsappNumber, '9845012345');
  assert.equal(marketCreateSchema.parse({ ...item, useSavedNumber: true }).useSavedNumber, true);
  assert.deepEqual(issuesFor({ ...item, whatsappNumber: '12345' }), ['whatsappNumber']);
  assert.deepEqual(issuesFor({ ...item, whatsappNumber: '9845012345', useSavedNumber: true }), ['whatsappNumber']);
});

test('unknown kind rejected', () => {
  assert.deepEqual(issuesFor({ ...base, kind: 'event' }), ['kind']);
});

test('patch actions', () => {
  for (const action of ['still_available', 'sold', 'booked', 'reserve', 'unreserve', 'close']) {
    assert.equal(marketPatchSchema.parse({ action }).action, action);
  }
  assert.deepEqual(marketPatchSchema.parse({ action: 'lower_price', price: 400 }), { action: 'lower_price', price: 400 });
  assert.equal(marketPatchSchema.safeParse({ action: 'lower_price', price: 0 }).success, false);
  assert.deepEqual(marketPatchSchema.parse({ action: 'bundle_item_sold', partIndex: 3 }), {
    action: 'bundle_item_sold',
    partIndex: 3,
  });
  assert.equal(marketPatchSchema.safeParse({ action: 'bundle_item_sold', partIndex: 20 }).success, false);
  assert.deepEqual(marketPatchSchema.parse({ action: 'seats_left', seatsLeft: 0 }), { action: 'seats_left', seatsLeft: 0 });
  assert.deepEqual(marketPatchSchema.parse({ action: 'promotion', eligible: true }), { action: 'promotion', eligible: true });
  assert.equal(marketPatchSchema.safeParse({ action: 'delete' }).success, false);
});

test('constants: sections, chips, plates and furnish tiles', () => {
  assert.deepEqual(
    MARKET_SECTIONS.map((s) => s.title),
    ['Rooms clearing out', 'Seats, tickets and passes', 'Everything near you', 'Wanted'],
  );
  assert.deepEqual(
    ALSO_CHIPS.map((c) => c.label),
    ['Vehicles', 'Tickets', 'Trips', '+'],
  );
  assert.equal(DEFAULT_PLATE_STATE, 'KA');
  assert.equal(PLATE_STATE_CODES[0], 'KA');
  assert.equal(new Set(PLATE_STATE_CODES).size, PLATE_STATE_CODES.length);
  assert.deepEqual(
    FURNISH_TILES.map((t) => t.id),
    ['mattress', 'study_table', 'chair', 'fan', 'cooler', 'bucket_set', 'kettle', 'shelf'],
  );
  for (const tile of FURNISH_TILES) assert.ok(tile.typicalPrice > 0);
});

test('furnishTileFor picks the most specific tile', () => {
  assert.equal(furnishTileFor('Usha table fan'), 'fan');
  assert.equal(furnishTileFor('Study table with drawer'), 'study_table');
  assert.equal(furnishTileFor('Symphony air cooler'), 'cooler');
  assert.equal(furnishTileFor('2 plastic chairs'), 'chair');
  assert.equal(furnishTileFor('Wall shelves'), 'shelf');
  assert.equal(furnishTileFor('Single mattress'), 'mattress');
  assert.equal(furnishTileFor('Fancy dress costume'), null);
  assert.equal(furnishTileFor(''), null);
});
