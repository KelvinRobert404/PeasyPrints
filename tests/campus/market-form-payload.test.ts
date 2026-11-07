import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMarketPayload,
  bundleDescription,
  formatDay,
  initialFormState,
  newBundleRow,
  parseAudienceParam,
  parseKindParam,
  prefillTitle,
  switchKind,
  type MarketFormState,
} from '../../src/components/campus/market-form/payload.ts';
import { marketCreateSchema } from '../../src/lib/campus/marketSchema.ts';

const photo = (n: number) => `/api/campus/media/m${n}`;

function form(kind: MarketFormState['kind'], patch: Partial<MarketFormState> = {}): MarketFormState {
  return { ...initialFormState(kind, 'campus'), whatsappNumber: '98765 43210', ...patch };
}

function payloadOf(state: MarketFormState) {
  const result = buildMarketPayload(state);
  assert.equal(result.ok, true, result.ok ? '' : `expected ok, got: ${result.error}`);
  if (!result.ok) throw new Error('unreachable');
  // What the form sends must also pass the server schema as JSON.
  const reparsed = marketCreateSchema.parse(JSON.parse(JSON.stringify(result.payload)));
  assert.equal(reparsed.kind, state.kind);
  return result.payload;
}

function errorOf(state: MarketFormState) {
  const result = buildMarketPayload(state);
  assert.equal(result.ok, false, 'expected the form to be rejected');
  if (result.ok) throw new Error('unreachable');
  return result;
}

test('item: passes marketSchema with landmark, price and photos', () => {
  const payload = payloadOf(
    form('item', {
      title: '  Usha table fan ',
      price: 1500,
      landmarkId: 'kju-main-falcon-hospital',
      images: [photo(1), photo(2)],
      condition: 'good',
      brand: 'Usha',
      category: 'hostel_essentials',
    }),
  );
  assert.equal(payload.kind, 'item');
  assert.equal(payload.title, 'Usha table fan');
  assert.equal(payload.price, 1500);
  assert.equal(payload.whatsappNumber, '9876543210');
  assert.equal(payload.genderPref, 'anyone');
  if (payload.kind === 'item') {
    assert.equal(payload.condition, 'good');
    assert.equal(payload.brand, 'Usha');
  }
});

test('item: needs a landmark from the list and a price', () => {
  assert.equal(errorOf(form('item', { title: 'Fan', price: 600 })).field, 'landmarkId');
  const noPrice = errorOf(form('item', { title: 'Fan', landmarkId: 'gate' }));
  assert.equal(noPrice.field, 'price');
  assert.equal(noPrice.error, 'Add a price');
});

test('item: free and swap send no price', () => {
  const free = payloadOf(form('item', { title: 'Old notes', price: 500, priceTerms: 'free', landmarkId: 'gate' }));
  assert.equal(free.price, null);
  const swap = payloadOf(form('item', { title: 'Novel swap', price: 200, priceTerms: 'swap', landmarkId: 'gate' }));
  assert.equal(swap.price, null);
});

test('item: missing title and number give plain messages', () => {
  assert.equal(errorOf(form('item', { price: 600, landmarkId: 'gate' })).error, 'Add a title, up to 80 letters');
  assert.equal(errorOf(form('item', { title: 'Fan', price: 600, landmarkId: 'gate', whatsappNumber: '' })).field, 'whatsappNumber');
  assert.equal(
    errorOf(form('item', { title: 'Fan', price: 600, landmarkId: 'gate', whatsappNumber: '12345' })).error,
    'Enter a 10 digit mobile number',
  );
});

test('saved number: sends useSavedNumber and no typed number', () => {
  const payload = payloadOf(form('item', { title: 'Fan', price: 600, landmarkId: 'gate', useSavedNumber: true, whatsappNumber: '' }));
  assert.equal(payload.useSavedNumber, true);
  assert.equal(payload.whatsappNumber, undefined);
});

test('wanted: passes marketSchema with no landmark and an open budget', () => {
  const payload = payloadOf(form('wanted', { title: 'Any cycle available?' }));
  assert.equal(payload.kind, 'wanted');
  assert.equal(payload.price, null);
  assert.equal(payload.landmarkId, undefined);
  if (payload.kind === 'wanted') {
    assert.equal(payload.budgetMax, null);
    assert.equal(payload.neededBy, null);
  }
});

test('wanted: budget fills price and budgetMax, date kept', () => {
  const payload = payloadOf(form('wanted', { title: 'Need a calculator', price: 500, neededBy: '2026-11-20', landmarkId: 'gate' }));
  assert.equal(payload.price, 500);
  assert.equal(payload.landmarkId, 'gate');
  if (payload.kind === 'wanted') {
    assert.equal(payload.budgetMax, 500);
    assert.equal(payload.neededBy, '2026-11-20');
  }
});

test('bundle: rows become parts, blank rows dropped, prices parsed', () => {
  const payload = payloadOf(
    form('bundle', {
      title: 'Room starter kit',
      landmarkId: 'gate',
      parts: [newBundleRow('Table fan', '1.5k'), newBundleRow('', ''), newBundleRow('Bucket set', '')],
      images: Array.from({ length: 8 }, (_, i) => photo(i)),
      handOver: 'At my PG gate, after 5 pm',
      availableUntil: '2026-11-20',
      description: 'Moving out this month.',
      splitOk: false,
    }),
  );
  assert.equal(payload.kind, 'bundle');
  if (payload.kind === 'bundle') {
    assert.deepEqual(payload.parts, [
      { title: 'Table fan', price: 1500 },
      { title: 'Bucket set', price: null },
    ]);
    assert.equal(payload.splitOk, false);
  }
  assert.equal(payload.images.length, 8);
  assert.equal(payload.description, 'Moving out this month.\nHand over: At my PG gate, after 5 pm\nAvailable till 20 Nov');
});

test('bundle: needs a thing, a priced thing or a bundle price, and a landmark', () => {
  assert.equal(errorOf(form('bundle', { title: 'Kit', landmarkId: 'gate' })).field, 'parts');
  assert.equal(errorOf(form('bundle', { title: 'Kit', landmarkId: 'gate', parts: [newBundleRow('Fan', '')] })).field, 'price');
  assert.equal(errorOf(form('bundle', { title: 'Kit', parts: [newBundleRow('Fan', '500')] })).field, 'landmarkId');
  assert.equal(errorOf(form('bundle', { title: 'Kit', landmarkId: 'gate', parts: [newBundleRow('', '500')] })).error, 'Name every thing in the list');
  assert.equal(errorOf(form('bundle', { title: 'Kit', landmarkId: 'gate', parts: [newBundleRow('Fan', 'cheap')] })).field, 'parts');
  // A bundle price alone is enough.
  payloadOf(form('bundle', { title: 'Kit', landmarkId: 'gate', price: 900, parts: [newBundleRow('Fan', '')] }));
});

test('bundle: free sends no prices, long hand-over rejected', () => {
  const free = payloadOf(form('bundle', { title: 'Kit', landmarkId: 'gate', priceTerms: 'free', parts: [newBundleRow('Fan', '500')] }));
  assert.equal(free.price, null);
  if (free.kind === 'bundle') assert.equal(free.parts[0].price, null);
  assert.equal(
    errorOf(form('bundle', { title: 'Kit', landmarkId: 'gate', price: 900, handOver: 'x'.repeat(81), parts: [newBundleRow('Fan', '')] })).field,
    'handOver',
  );
});

test("girls' space: gender is always for girls", () => {
  const state = { ...initialFormState('item', 'girls'), title: 'Kurti set', price: 800, landmarkId: 'gate', whatsappNumber: '9876543210' };
  assert.equal(state.genderPref, 'girls');
  const payload = payloadOf({ ...state, genderPref: 'anyone' });
  assert.equal(payload.genderPref, 'girls');
});

test('switchKind trims photos and fixes price terms', () => {
  const bundle = form('bundle', { images: Array.from({ length: 8 }, (_, i) => photo(i)), priceTerms: 'free' });
  const item = switchKind(bundle, 'item');
  assert.equal(item.images.length, 5);
  assert.equal(item.priceTerms, 'free');
  const wanted = switchKind(item, 'wanted');
  assert.equal(wanted.priceTerms, 'negotiable');
});

test('params: kind, audience and the ?q prefill', () => {
  assert.equal(parseKindParam('wanted'), 'wanted');
  assert.equal(parseKindParam(['bundle', 'item']), 'bundle');
  assert.equal(parseKindParam('sell'), 'item');
  assert.equal(parseKindParam('clear-out'), 'bundle');
  assert.equal(parseKindParam('vehicle'), null);
  assert.equal(parseKindParam(undefined), null);
  assert.equal(parseAudienceParam('girls'), 'girls');
  assert.equal(parseAudienceParam('anything'), 'campus');
  assert.equal(prefillTitle('wanted', 'cycle'), 'Any cycle available?');
  assert.equal(prefillTitle('item', 'cycle'), '');
  assert.equal(prefillTitle('wanted', undefined), '');
  assert.ok(prefillTitle('wanted', 'a'.repeat(300)).length <= 80);
});

test('formatDay and bundleDescription', () => {
  assert.equal(formatDay('2026-11-20'), '20 Nov');
  assert.equal(formatDay('2026-01-05'), '5 Jan');
  assert.equal(formatDay('soon'), null);
  assert.equal(bundleDescription('', '', ''), '');
  assert.equal(bundleDescription('  ', ' At  the gate ', ''), 'Hand over: At the gate');
});
