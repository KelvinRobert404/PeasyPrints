import assert from 'node:assert/strict';
import test from 'node:test';
import type { SearchableItem } from '../../src/lib/search/campusSearch.ts';
import { askText, isEmptyQuery, matchItem, normalize, parseQuery, wantedPlaceholder } from '../../src/lib/search/campusSearch.ts';

const KJU = { viewerCollegeId: 'kju', campusId: 'kju-main' };
const CHRIST = { viewerCollegeId: 'christ', campusId: 'christ-central' };

const kothanurPlace = { landmarkId: 'kju-main-livesta', label: 'Livesta hostel', area: 'Kothanur' };
const falconPlace = { landmarkId: 'kju-main-falcon-hospital', label: 'Falcon Hospital', area: 'Gulabi Road' };

function marketItem(overrides: Partial<SearchableItem>): SearchableItem {
  return {
    title: 'Something',
    description: '',
    serial: 'KJU-M0001',
    collegeId: 'kju',
    kind: 'item',
    category: 'other',
    price: 1000,
    genderPref: 'anyone',
    place: null,
    details: null,
    ...overrides,
  };
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

test('normalize lowercases, strips punctuation and collapses spaces', () => {
  assert.equal(normalize('  Hey,   St. Mary\'s  Church!! '), 'hey st marys church');
  assert.equal(normalize('KJU-M0042'), 'kju m0042');
  assert.equal(normalize(''), '');
});

test("'kjc cycle under 2k' -> kju, ['cycle'], max 2000", () => {
  const parsed = parseQuery('kjc cycle under 2k', CHRIST);
  assert.equal(parsed.collegeId, 'kju');
  assert.deepEqual(parsed.terms, ['cycle']);
  assert.equal(parsed.max, 2000);
  assert.equal(parsed.min, undefined);
  assert.equal(parsed.category, 'vehicles');
});

test('college aliases come from the catalog', () => {
  assert.equal(parseQuery('Kristu', CHRIST).collegeId, 'kju');
  assert.equal(parseQuery('kristu jayanti mattress', CHRIST).collegeId, 'kju');
  assert.equal(parseQuery('christ books', KJU).collegeId, 'christ');
  assert.deepEqual(parseQuery('kristu jayanti', CHRIST).terms, []);
});

test("'pg near kothnur' -> Kothanur", () => {
  const parsed = parseQuery('pg near kothnur', KJU);
  assert.deepEqual(parsed.areaIds, ['Kothanur']);
  assert.deepEqual(parsed.terms, ['pg']);
  assert.deepEqual(parsed.landmarkIds, []);
});

test('bare place names and typos are found without near', () => {
  assert.deepEqual(parseQuery('Kothnur', KJU).areaIds, ['Kothanur']);
  assert.deepEqual(parseQuery('room byrathi', KJU).areaIds, ['Byrathi']);
});

test("'near X' picks a landmark by label or alias", () => {
  assert.deepEqual(parseQuery('near falcon', KJU).landmarkIds, ['kju-main-falcon-hospital']);
  assert.deepEqual(parseQuery('flat near bhartiya city', KJU).landmarkIds, ['kju-main-bhartiya-city']);
  assert.deepEqual(parseQuery('flat near bhartiya city', KJU).terms, ['flat']);
});

test('an unknown place after near stays a search word', () => {
  const parsed = parseQuery('near zzplace', KJU);
  assert.deepEqual(parsed.terms, ['zzplace']);
  assert.deepEqual(parsed.areaIds, []);
});

test("'clg' -> viewer's college", () => {
  assert.equal(parseQuery('clg', KJU).collegeId, 'kju');
  assert.equal(parseQuery('clg', CHRIST).collegeId, 'christ');
  assert.equal(parseQuery('college', CHRIST).collegeId, 'christ');
  assert.deepEqual(parseQuery('clg', KJU).terms, []);
  assert.equal(parseQuery('clg', {}).collegeId, undefined);
});

test("'under 12k girls kjc' -> 12000, girls", () => {
  const parsed = parseQuery('under 12k girls kjc', CHRIST);
  assert.equal(parsed.max, 12000);
  assert.equal(parsed.gender, 'girls');
  assert.equal(parsed.collegeId, 'kju');
  assert.deepEqual(parsed.terms, []);
});

test('gender words', () => {
  assert.equal(parseQuery('ladies pg', KJU).gender, 'girls');
  assert.equal(parseQuery('female', KJU).gender, 'girls');
  assert.equal(parseQuery('gents pg', KJU).gender, 'boys');
  assert.equal(parseQuery('male', KJU).gender, 'boys');
});

test('category synonyms', () => {
  assert.equal(parseQuery('scooty', KJU).category, 'vehicles');
  assert.equal(parseQuery('activa', KJU).category, 'vehicles');
  assert.equal(parseQuery('bike', KJU).category, 'vehicles');
  assert.equal(parseQuery('bucket', KJU).category, 'room');
  assert.equal(parseQuery('chair', KJU).category, 'room');
  assert.equal(parseQuery('mess', KJU).category, 'passes');
  assert.equal(parseQuery('gym', KJU).category, 'passes');
  assert.equal(parseQuery('cab', KJU).category, 'trips');
  assert.equal(parseQuery('train seat', KJU).category, 'trips');
  assert.equal(parseQuery('ticket', KJU).category, 'tickets');
  assert.deepEqual(parseQuery('ticket', KJU).terms, []);
  assert.equal(parseQuery('notes', KJU).category, 'books_notes');
  assert.equal(parseQuery('book', KJU).category, 'books_notes');
});

test('price phrases', () => {
  assert.equal(parseQuery('room above 5k', KJU).min, 5000);
  const range = parseQuery('pg between 5k and 9k', KJU);
  assert.equal(range.min, 5000);
  assert.equal(range.max, 9000);
  const short = parseQuery('room 5 to 10k', KJU);
  assert.equal(short.min, 5000);
  assert.equal(short.max, 10000);
  assert.equal(parseQuery('cycle 2k', KJU).max, 2000);
  assert.equal(parseQuery('cycle 1.5k', KJU).max, 1500);
  // Plain numbers stay words, so serials still work.
  assert.deepEqual(parseQuery('0042', KJU).terms, ['0042']);
  assert.equal(parseQuery('0042', KJU).max, undefined);
});

test('serial search', () => {
  const parsed = parseQuery('KJU-M0042', CHRIST);
  assert.equal(parsed.collegeId, 'kju');
  assert.ok(matchItem(marketItem({ serial: 'KJU-M0042' }), parsed));
  assert.ok(!matchItem(marketItem({ serial: 'KJU-M0043' }), parsed));
});

test("'mattress near clg' matches a mattress at the viewer's college", () => {
  const parsed = parseQuery('mattress near clg', KJU);
  assert.equal(parsed.collegeId, 'kju');
  assert.equal(parsed.category, 'room');
  assert.deepEqual(parsed.terms, ['mattress']);
  const mattress = marketItem({ title: 'Single mattress, 4 inch', category: 'hostel_essentials', price: 1200 });
  assert.ok(matchItem(mattress, parsed));
  assert.ok(matchItem({ ...mattress, category: 'other' }, parsed), 'text alone is enough');
  assert.ok(!matchItem(marketItem({ title: 'Hero cycle', category: 'cycles' }), parsed));
  assert.ok(!matchItem({ ...mattress, collegeId: 'christ' }, parsed));
});

test('cycle search matches title, plural and price limit', () => {
  const parsed = parseQuery('kjc cycle under 2k', KJU);
  const cycle = marketItem({ title: 'Hero Sprint cycles', kind: 'vehicle', category: 'cycles', price: 1800, details: { kind: 'vehicle', vehicleType: 'cycle' } });
  assert.ok(matchItem(cycle, parsed));
  assert.ok(!matchItem({ ...cycle, price: 2500 }, parsed));
  assert.ok(matchItem({ ...cycle, title: 'Btwin, barely used' }, parsed), 'vehicleType counts as text');
  assert.ok(!matchItem(marketItem({ title: 'Cycle lock', category: 'other', price: 300 }), { ...parsed, category: 'books_notes' }));
});

test('free and open-budget items pass a max but fail a min', () => {
  const free = marketItem({ price: null, title: 'Free bucket' });
  assert.ok(matchItem(free, parseQuery('bucket under 500', KJU)));
  assert.ok(!matchItem(free, parseQuery('bucket above 100', KJU)));
});

test('housing: under 12k girls kjc', () => {
  const parsed = parseQuery('under 12k girls kjc', KJU);
  const room = { title: 'Twin sharing PG', description: 'Food included', collegeId: 'kju', stayType: 'pg', rentPp: 9000, whoCanStay: 'girls' as const, place: kothanurPlace };
  assert.ok(matchItem(room, parsed));
  assert.ok(matchItem({ ...room, whoCanStay: 'anyone' as const }, parsed));
  assert.ok(!matchItem({ ...room, whoCanStay: 'boys' as const }, parsed));
  assert.ok(!matchItem({ ...room, rentPp: 13000 }, parsed));
});

test('place match by area, landmark and same-area landmark', () => {
  const pg = { title: 'PG for two', stayType: 'pg', collegeId: 'kju', rentPp: 8000, place: kothanurPlace };
  assert.ok(matchItem(pg, parseQuery('pg near kothnur', KJU)));
  assert.ok(!matchItem({ ...pg, place: falconPlace }, parseQuery('pg near kothnur', KJU)));
  assert.ok(!matchItem({ ...pg, place: null }, parseQuery('pg near kothnur', KJU)));
  assert.ok(matchItem({ ...pg, place: falconPlace }, parseQuery('near falcon', KJU)));
  // A custom label in the same area as Falcon still counts as near.
  assert.ok(matchItem({ ...pg, place: { landmarkId: null, label: 'Falcon 2nd cross', area: 'Gulabi Road' } }, parseQuery('near falcon', KJU)));
  // Navajyothi sits in Kothanur too.
  assert.ok(matchItem(pg, parseQuery('near navajyothi', KJU)));
});

test('stay type counts as text', () => {
  assert.ok(matchItem({ title: 'Room for one', stayType: 'pg', rentPp: 7000 }, parseQuery('pg', KJU)));
  assert.ok(!matchItem({ title: 'Room for one', stayType: 'flat', rentPp: 7000 }, parseQuery('pg', KJU)));
});

test('empty query matches everything', () => {
  const parsed = parseQuery('   ', KJU);
  assert.ok(isEmptyQuery(parsed));
  assert.ok(matchItem(marketItem({}), parsed));
  assert.ok(!isEmptyQuery(parseQuery('cycle', KJU)));
});

test('askText reads "Any cycle available?" and stays under 10 words', () => {
  assert.equal(askText('cycle'), 'Any cycle available?');
  assert.equal(askText('  any cycle available? '), 'Any cycle available?');
  assert.equal(askText('cycle under 2k'), 'Any cycle under 2k available?');
  assert.equal(askText(''), 'Anything available?');
  const long = askText('second hand study table with chair and lamp near kothanur please today');
  assert.ok(wordCount(long) < 10, long);
  assert.match(long, /^Any .+ available\?$/);
});

test('wantedPlaceholder is short and never uses the rupee sign', () => {
  for (let index = 0; index < 6; index += 1) {
    const line = wantedPlaceholder(index);
    assert.ok(wordCount(line) < 10, line);
    assert.ok(!line.includes('₹'), line);
  }
  assert.equal(wantedPlaceholder(), wantedPlaceholder(0));
});
