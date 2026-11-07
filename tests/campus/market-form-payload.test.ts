import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FORM_KINDS,
  aboveFaceValue,
  aboveFairPrice,
  buildMarketPayload,
  bundleDescription,
  formatDay,
  formatDayYear,
  initialFormState,
  insuranceValidity,
  istDateTime,
  newBundleRow,
  parseAudienceParam,
  parseKindParam,
  passChange,
  passFairPrice,
  prefillTitle,
  switchKind,
  type BuildOptions,
  type MarketFormState,
} from '../../src/components/campus/market-form/payload.ts';
import { MARKET_KINDS } from '../../src/lib/campus/market.ts';
import { marketCreateSchema } from '../../src/lib/campus/marketSchema.ts';

const photo = (n: number) => `/api/campus/media/m${n}`;

/** Saturday 7 Nov 2026, noon in India. Every date below is relative to it. */
const NOW = Date.parse('2026-11-07T12:00:00+05:30');
const OPTIONS: BuildOptions = { now: NOW, campusLabel: 'KJU Main' };

function form(kind: MarketFormState['kind'], patch: Partial<MarketFormState> = {}): MarketFormState {
  return { ...initialFormState(kind, 'campus'), whatsappNumber: '98765 43210', ...patch };
}

function payloadOf(state: MarketFormState, options: BuildOptions = OPTIONS) {
  const result = buildMarketPayload(state, options);
  assert.equal(result.ok, true, result.ok ? '' : `expected ok, got: ${result.error}`);
  if (!result.ok) throw new Error('unreachable');
  // What the form sends must also pass the server schema as JSON.
  const reparsed = marketCreateSchema.parse(JSON.parse(JSON.stringify(result.payload)));
  assert.equal(reparsed.kind, state.kind);
  return result.payload;
}

function errorOf(state: MarketFormState, options: BuildOptions = OPTIONS) {
  const result = buildMarketPayload(state, options);
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
  assert.equal(parseKindParam('vehicle'), 'vehicle');
  assert.equal(parseKindParam('cab-split'), 'cab_split');
  assert.equal(parseKindParam('cab'), 'cab_split');
  assert.equal(parseKindParam('seat'), 'seat');
  assert.equal(parseKindParam('ticket'), 'ticket');
  assert.equal(parseKindParam('pass'), 'pass');
  assert.equal(parseKindParam('room-rent'), null);
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
  assert.equal(formatDay('2026-02-31'), null);
  assert.equal(formatDayYear('2027-03-05'), '5 Mar 2027');
});

// ---------------------------------------------------------------- MFORM2 kinds

test('the form builds every market kind', () => {
  assert.deepEqual([...FORM_KINDS].sort(), [...MARKET_KINDS].sort());
});

test('istDateTime reads a datetime-local box as India time', () => {
  assert.equal(istDateTime('2026-11-20T18:30'), '2026-11-20T18:30:00+05:30');
  assert.equal(istDateTime('2026-11-20T18:30:15'), '2026-11-20T18:30:15+05:30');
  assert.equal(istDateTime('2026-11-31T18:30'), null);
  assert.equal(istDateTime('2026-11-20T25:00'), null);
  assert.equal(istDateTime(''), null);
});

test('seat: bus seat passes marketSchema with travel category and no landmark', () => {
  const payload = payloadOf(
    form('seat', {
      title: 'Sleeper bus seat to Chennai',
      price: 900,
      from: ' Manipal ',
      to: 'Chennai',
      departure: '2026-11-13T21:00',
      operator: 'VRL Travels',
      seatsLeft: 2,
      genderPref: 'girls',
    }),
  );
  assert.equal(payload.kind, 'seat');
  assert.equal(payload.category, 'travel');
  assert.equal(payload.genderPref, 'girls');
  assert.equal(payload.landmarkId, undefined);
  assert.equal(payload.description, 'Operator: VRL Travels');
  if (payload.kind === 'seat') {
    assert.equal(payload.seatFor, 'Bus from Manipal to Chennai');
    assert.equal(payload.departureAt, '2026-11-13T21:00:00+05:30');
    assert.equal(payload.endsAt, null);
    assert.equal(payload.seatsLeft, 2);
  }
});

test('seat: train adds the name change line; needs places and a future time', () => {
  const train = payloadOf(
    form('seat', { title: 'Train to Kochi', price: 600, tripMode: 'train', from: 'Udupi', to: 'Kochi', departure: '2026-11-11T06:00', operator: '16346 Netravati' }),
  );
  assert.equal(train.description, 'Train: 16346 Netravati\nName change rules apply');
  if (train.kind === 'seat') assert.equal(train.seatFor, 'Train from Udupi to Kochi');
  const ok = { title: 'Seat', price: 600, from: 'Udupi', to: 'Kochi', departure: '2026-11-11T06:00' };
  assert.equal(errorOf(form('seat', { ...ok, from: '' })).field, 'from');
  assert.equal(errorOf(form('seat', { ...ok, to: ' ' })).field, 'to');
  assert.equal(errorOf(form('seat', { ...ok, departure: '' })).field, 'departure');
  assert.equal(errorOf(form('seat', { ...ok, departure: '2026-11-07T11:00' })).error, 'That time has passed');
  assert.equal(errorOf(form('seat', { ...ok, price: null })).error, 'Add a price');
});

test("seat: girls' space locks the seat to For girls", () => {
  const state = {
    ...initialFormState('seat', 'girls'),
    whatsappNumber: '9876543210',
    title: 'Ladies seat to Bengaluru',
    price: 700,
    from: 'Manipal',
    to: 'Bengaluru',
    departure: '2026-11-12T22:00',
  };
  assert.equal(payloadOf({ ...state, genderPref: 'boys' }).genderPref, 'girls');
});

test('cab split: per person fare, total fare, campus end from the place or the session', () => {
  const base = { title: 'Airport cab Friday', price: 400, departure: '2026-11-13T05:30', cabSize: 4, seatsLeft: 2 };
  const toAirport = payloadOf(form('cab_split', base));
  assert.equal(toAirport.kind, 'cab_split');
  assert.equal(toAirport.priceTerms, 'per_person');
  assert.equal(toAirport.category, 'travel');
  assert.equal(toAirport.description, 'Fare split 4 ways');
  if (toAirport.kind === 'cab_split') {
    assert.equal(toAirport.from, 'KJU Main');
    assert.equal(toAirport.to, 'Airport');
    assert.equal(toAirport.totalFare, 1600);
    assert.equal(toAirport.seatsLeft, 2);
    assert.equal(toAirport.departureAt, '2026-11-13T05:30:00+05:30');
  }
  const fromAirport = payloadOf(form('cab_split', { ...base, cabDirection: 'from_airport' }), { ...OPTIONS, placeLabel: 'First gate' });
  if (fromAirport.kind === 'cab_split') {
    assert.equal(fromAirport.from, 'Airport');
    assert.equal(fromAirport.to, 'First gate');
  }
  const noCampus = payloadOf(form('cab_split', base), { now: NOW });
  if (noCampus.kind === 'cab_split') assert.equal(noCampus.from, 'Campus');
});

test('cab split: seats left must fit in the cab, fare and time needed', () => {
  const base = { title: 'Airport cab', price: 400, departure: '2026-11-13T05:30', cabSize: 3 };
  assert.equal(errorOf(form('cab_split', { ...base, seatsLeft: 3 })).field, 'seatsLeft');
  assert.equal(errorOf(form('cab_split', { ...base, seatsLeft: 1, price: null })).error, 'Add a price');
  assert.equal(errorOf(form('cab_split', { ...base, seatsLeft: 1, departure: '2026-11-01T05:30' })).field, 'departure');
});

test('ticket: passes at face value, blocked above it', () => {
  const base = { title: 'Comedy night', venue: 'Town hall', showtime: '2026-11-14T19:00', faceValue: 500, quantity: 2 };
  const payload = payloadOf(form('ticket', { ...base, price: 500 }));
  assert.equal(payload.kind, 'ticket');
  assert.equal(payload.category, 'other');
  if (payload.kind === 'ticket') {
    assert.equal(payload.faceValue, 500);
    assert.equal(payload.quantity, 2);
    assert.equal(payload.venue, 'Town hall');
    assert.equal(payload.happensAt, '2026-11-14T19:00:00+05:30');
  }
  const above = errorOf(form('ticket', { ...base, price: 501 }));
  assert.equal(above.field, 'price');
  assert.equal(above.error, 'Price cannot be above face value');
  assert.equal(aboveFaceValue({ price: 501, faceValue: 500 }), true);
  assert.equal(aboveFaceValue({ price: 500, faceValue: 500 }), false);
  assert.equal(errorOf(form('ticket', { ...base, price: 300, faceValue: null })).field, 'faceValue');
  assert.equal(errorOf(form('ticket', { ...base, price: 300, showtime: '2026-11-07T10:00' })).error, 'The show has already started');
  // Giving it away is fine, and an empty venue is sent as null.
  const free = payloadOf(form('ticket', { ...base, venue: ' ', priceTerms: 'free', price: 900 }));
  assert.equal(free.price, null);
  if (free.kind === 'ticket') assert.equal(free.venue, null);
});

test('pass: fair price follows paid and the dates', () => {
  const dates = { paid: 3000, validFrom: '2026-11-01', validUntil: '2026-11-30' };
  // 30 day pass, 24 days left counting today -> 3000 * 24 / 30.
  assert.equal(passFairPrice(dates, NOW), 2400);
  assert.equal(passFairPrice({ ...dates, validUntil: '2026-11-15' }, NOW), 1800);
  assert.equal(passFairPrice({ ...dates, paid: null }, NOW), null);
  assert.equal(passFairPrice({ ...dates, validFrom: '' }, NOW), null);
  assert.equal(passFairPrice({ ...dates, validUntil: '2026-11-05' }, NOW), 0);

  let state = form('pass');
  state = { ...state, ...passChange(state, { paid: 3000 }, NOW) };
  assert.equal(state.price, null);
  state = { ...state, ...passChange(state, { validFrom: '2026-11-01' }, NOW) };
  state = { ...state, ...passChange(state, { validUntil: '2026-11-30' }, NOW) };
  assert.equal(state.price, 2400);
  state = { ...state, ...passChange(state, { validUntil: '2026-11-15' }, NOW) };
  assert.equal(state.price, 1800);
  // Once the student types their own price, the dates stop moving it.
  state = { ...state, price: 2500 };
  assert.equal(aboveFairPrice(state, NOW), true);
  state = { ...state, ...passChange(state, { validUntil: '2026-11-30' }, NOW) };
  assert.equal(state.price, 2500);
  assert.equal(aboveFairPrice(state, NOW), true);
  assert.equal(aboveFairPrice({ ...state, price: 2000 }, NOW), false);
});

test('pass: mess pass passes marketSchema with the detail lines', () => {
  const payload = payloadOf(
    form('pass', {
      title: 'Mess pass, rest of November',
      provider: 'Annapoorna',
      paid: 3000,
      validFrom: '2026-11-01',
      validUntil: '2026-11-30',
      price: 2400,
    }),
  );
  assert.equal(payload.kind, 'pass');
  assert.equal(payload.category, 'other');
  assert.equal(payload.description, 'Mess pass from Annapoorna\nPaid Rs 3k for 1 Nov to 30 Nov');
  if (payload.kind === 'pass') {
    assert.equal(payload.passType, 'other');
    assert.equal(payload.validUntil, '2026-11-30');
  }
  const gym = payloadOf(form('pass', { title: 'Gym pass', passType: 'gym', validFrom: '2026-11-01', validUntil: '2026-12-31', price: 1500 }));
  assert.equal(gym.category, 'sports_fitness');
  assert.equal(gym.description, 'Gym pass');
  if (gym.kind === 'pass') assert.equal(gym.passType, 'gym');
});

test('pass: needs real dates, in order, not ended', () => {
  const base = { title: 'Mess pass', price: 1000, validFrom: '2026-11-01', validUntil: '2026-11-30' };
  assert.equal(errorOf(form('pass', { ...base, validFrom: '' })).field, 'validFrom');
  assert.equal(errorOf(form('pass', { ...base, validUntil: '' })).field, 'validUntil');
  assert.equal(errorOf(form('pass', { ...base, validFrom: '2026-12-01' })).error, 'End must be after the start');
  assert.equal(errorOf(form('pass', { ...base, validUntil: '2026-11-06' })).error, 'This pass has ended');
  // The last day still counts until midnight.
  payloadOf(form('pass', { ...base, validUntil: '2026-11-07' }));
});

test('vehicle: a cycle sends no plate, RC or insurance', () => {
  const payload = payloadOf(
    form('vehicle', {
      title: 'Hero Sprint cycle',
      price: 4500,
      landmarkId: 'gate',
      vehicleType: 'cycle',
      rcWithSeller: true,
      insuranceUntil: '2026-01-01',
      plateState: 'MH',
    }),
  );
  assert.equal(payload.kind, 'vehicle');
  assert.equal(payload.category, 'cycles');
  assert.equal(payload.description, undefined);
  if (payload.kind === 'vehicle') {
    assert.equal(payload.vehicleType, 'cycle');
    assert.equal(payload.plateState, undefined);
    assert.equal(payload.papersOk, null);
    assert.equal(payload.offer, 'sale');
  }
});

test('vehicle: scooter sends plate state and RC, past insurance reads lapsed', () => {
  const payload = payloadOf(
    form('vehicle', {
      title: 'Activa 2019',
      price: 38000,
      landmarkId: 'gate',
      vehicleType: 'scooter',
      offer: 'rent',
      plateState: 'KA',
      rcWithSeller: true,
      insuranceUntil: '2026-10-01',
    }),
  );
  assert.equal(payload.category, 'other');
  assert.equal(payload.description, 'RC with seller\nInsurance lapsed');
  if (payload.kind === 'vehicle') {
    assert.equal(payload.vehicleType, 'scooter');
    assert.equal(payload.plateState, 'KA');
    assert.equal(payload.papersOk, true);
    assert.equal(payload.offer, 'rent');
  }
  assert.equal(insuranceValidity('2026-10-01', NOW), 'expired');
  assert.equal(insuranceValidity('2026-11-20', NOW), 'expiring');
  assert.equal(insuranceValidity('2027-06-01', NOW), 'valid');
  assert.equal(insuranceValidity('', NOW), null);
});

test('vehicle: car is sent as other with its plate, valid insurance shows its date', () => {
  const payload = payloadOf(
    form('vehicle', { title: 'Swift 2018', price: 350000, landmarkId: 'gate', vehicleType: 'car', plateState: 'DL', rcWithSeller: false, insuranceUntil: '2027-06-01' }),
  );
  assert.equal(payload.description, 'Car\nRC not with seller\nInsurance till 1 Jun 2027');
  if (payload.kind === 'vehicle') {
    assert.equal(payload.vehicleType, 'other');
    assert.equal(payload.plateState, 'DL');
    assert.equal(payload.papersOk, false);
  }
  assert.equal(errorOf(form('vehicle', { title: 'Bike', price: 30000, vehicleType: 'bike' })).field, 'landmarkId');
});

test('switchKind: cab split is per person, seats clamp, category follows the kind', () => {
  const seat = form('seat', { seatsLeft: 4, price: 800 });
  const cab = switchKind({ ...seat, cabSize: 3 }, 'cab_split');
  assert.equal(cab.priceTerms, 'per_person');
  assert.equal(cab.seatsLeft, 2);
  assert.equal(cab.category, 'travel');
  const item = switchKind(cab, 'item');
  assert.equal(item.priceTerms, 'fixed');
  assert.equal(item.category, 'other');
  const vehicle = switchKind(item, 'vehicle');
  assert.equal(vehicle.category, 'cycles');
});
