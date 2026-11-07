import assert from 'node:assert/strict';
import test from 'node:test';
import { getCampus } from '../../src/lib/campus/catalog.ts';
import { HousingCreateSchema } from '../../src/lib/campus/housing/schema.ts';
import { DRAFT_FIELDS, parseWhatsAppPost } from '../../src/lib/campus/housing/parseWhatsAppPost.ts';
import type { HousingDraft, ParsedWhatsAppPost } from '../../src/lib/campus/housing/parseWhatsAppPost.ts';

const LANDMARKS = getCampus('kju-main')?.landmarks ?? [];
const NOW = new Date('2026-11-07T10:00:00+05:30');

function parse(text: string, now: Date = NOW): ParsedWhatsAppPost {
  return parseWhatsAppPost(text, LANDMARKS, { now });
}

/** filled is always the draft's keys in form order. */
function expected(draft: HousingDraft, rest: Omit<ParsedWhatsAppPost, 'draft' | 'filled'>): ParsedWhatsAppPost {
  const filled = DRAFT_FIELDS.filter((field) => draft[field] !== undefined);
  const result: ParsedWhatsAppPost = { draft, filled, cleanedDescription: rest.cleanedDescription, flags: rest.flags };
  if (rest.phone) result.phone = rest.phone;
  return result;
}

test('landmarks come from the KJU Main catalog', () => {
  assert.ok(LANDMARKS.length >= 8);
});

test('sample 1: English replacement in a girls PG', () => {
  const text = [
    '🏠 Replacement needed!!',
    '2 sharing room in PG near Falcon Hospital',
    'Rent: 8.5k per head',
    'Deposit: 15k',
    'Girls only, pure veg',
    'Available from 1st Dec',
    'Contact 98450 12345',
  ].join('\n');
  assert.deepEqual(
    parse(text),
    expected(
      {
        kind: 'replacement',
        postedAs: 'leaving',
        stayType: 'pg',
        whoCanStay: 'girls',
        houseRules: ['veg_only'],
        moveIn: '2026-12-01',
        sharing: 2,
        rentPp: 8500,
        deposit: 15000,
        place: { landmarkId: 'kju-main-falcon-hospital', area: 'Gulabi Road' },
      },
      {
        cleanedDescription: text.split('\n').slice(0, 6).join('\n'),
        flags: ['phone_removed'],
        phone: '9845012345',
      },
    ),
  );
});

test('sample 2: English flatmate, deposit in months, area alias', () => {
  const text = [
    'Room available in 3BHK flat, Kothnur',
    'Looking for 1 flatmate (boys)',
    'Rent Rs 9,000/- pm + electricity',
    'Deposit 2 months rent',
    'Fully furnished, no restrictions',
    'Immediate move in',
    'Call: +91-99001-22334',
  ].join('\n');
  assert.deepEqual(
    parse(text),
    expected(
      {
        kind: 'roommate',
        stayType: 'flat',
        whoCanStay: 'boys',
        houseRules: ['no_restrictions'],
        moveIn: 'now',
        bedsLeft: 1,
        rentPp: 9000,
        deposit: 18000,
        furnishing: 'furnished',
        place: { landmarkId: 'kju-main-area-kothanur', area: 'Kothanur' },
      },
      {
        cleanedDescription: text.split('\n').slice(0, 6).join('\n'),
        flags: ['phone_removed'],
        phone: '9900122334',
      },
    ),
  );
});

test('sample 3: Hinglish bed in a boys flat', () => {
  const text = [
    'Bhai log, ek bed khali hai hamare flat mein, Byrathi cross ke paas.',
    'Kiraya 7500 per head, advance 20k.',
    'Sirf ladkon ke liye, smoking allowed nahi.',
    'Agle mahine se shift kar sakte ho.',
    'Thoda negotiable hai. WhatsApp karo 9876543210',
  ].join('\n');
  assert.deepEqual(
    parse(text),
    expected(
      {
        kind: 'roommate',
        stayType: 'flat',
        whoCanStay: 'boys',
        houseRules: ['no_smoking'],
        moveIn: '2026-12-01',
        bedsLeft: 1,
        rentPp: 7500,
        deposit: 20000,
        rentTerms: 'slightly_negotiable',
        place: { landmarkId: 'kju-main-area-byrathi', area: 'Byrathi' },
      },
      {
        cleanedDescription: `${text.split('\n').slice(0, 4).join('\n')}\nThoda negotiable hai.`,
        flags: ['phone_removed'],
        phone: '9876543210',
      },
    ),
  );
});

test('sample 4: agent co-living PG with brokerage in months', () => {
  const text = [
    'Co-living PG for students near Bhartiya City',
    'Single, double and triple sharing',
    'Rs 12k pp (double sharing)',
    'Security deposit 25000',
    'Brokerage 1 month rent',
    'Semi furnished, wifi + food included',
    'Agent: 8123456789',
  ].join('\n');
  assert.deepEqual(
    parse(text),
    expected(
      {
        kind: 'room',
        postedAs: 'agent',
        brokerage: { charged: true, amount: 12000 },
        stayType: 'pg',
        whoCanStay: 'anyone',
        sharing: 2,
        rentPp: 12000,
        deposit: 25000,
        furnishing: 'semi_furnished',
        place: { landmarkId: 'kju-main-bhartiya-city', area: 'Thanisandra' },
      },
      {
        cleanedDescription: text.split('\n').slice(0, 6).join('\n'),
        flags: ['phone_removed'],
        phone: '8123456789',
      },
    ),
  );
});

test('sample 5: owner flat with a door number and lakh deposit', () => {
  const text = [
    'Owner here. Flat no. 302, Shelter apartments',
    '2BHK, unfurnished',
    'Rent 22000 per month, deposit 1.2 lakh, non negotiable',
    'Family or girls preferred',
    'From January',
  ].join('\n');
  assert.deepEqual(
    parse(text),
    expected(
      {
        kind: 'room',
        postedAs: 'owner_contact',
        stayType: 'flat',
        whoCanStay: 'girls',
        moveIn: '2027-01-01',
        rentPp: 22000,
        deposit: 120000,
        rentTerms: 'fixed',
        furnishing: 'unfurnished',
        place: { landmarkId: 'kju-main-shelter-apartments', area: 'Defence Enclave' },
      },
      { cleanedDescription: text, flags: ['door_number'] },
    ),
  );
});

test('sample 6: short sublet, rules, no deposit, spaced-out phone', () => {
  const text = [
    'Sublet for Dec-Jan (short term) near Hennur',
    '1 bed in 2 sharing, ladies only, curfew 10 pm, no guests',
    '8k/month, no deposit',
    'Move in from 15th Dec',
    'DM 7 0 1 9 8 8 7 7 6 6',
  ].join('\n');
  assert.deepEqual(
    parse(text),
    expected(
      {
        kind: 'sublet',
        whoCanStay: 'girls',
        houseRules: ['no_overnight_guests', 'curfew'],
        moveIn: '2026-12-15',
        bedsLeft: 1,
        sharing: 2,
        rentPp: 8000,
        deposit: 0,
        place: { landmarkId: 'kju-main-area-hennur', area: 'Hennur' },
      },
      {
        cleanedDescription: text.split('\n').slice(0, 4).join('\n'),
        flags: ['phone_removed'],
        phone: '7019887766',
      },
    ),
  );
});

test('sample 7: next sem flatmates, no brokerage, two phones', () => {
  const text = [
    'Need 2 girls for our flat at Murthy layout, next sem',
    'rent 6500 each, deposit 10k, no brokerage',
    'non veg not allowed',
    'ping me on 9988776655 or 9988776644',
  ].join('\n');
  assert.deepEqual(
    parse(text),
    expected(
      {
        kind: 'roommate',
        brokerage: { charged: false, amount: null },
        stayType: 'flat',
        whoCanStay: 'girls',
        houseRules: ['veg_only'],
        moveIn: 'next_sem',
        bedsLeft: 2,
        rentPp: 6500,
        deposit: 10000,
        place: { landmarkId: 'kju-main-area-murthy-layout', area: 'Murthy Layout' },
      },
      {
        cleanedDescription: text.split('\n').slice(0, 3).join('\n'),
        flags: ['phone_removed'],
        phone: '9988776655',
      },
    ),
  );
});

test('sample 8: Hinglish girls PG, typed area, rupee sign', () => {
  const text = [
    'Ladkiyon ke liye PG mein jagah hai, 3 sharing',
    'Location: Chelekere',
    '₹6,500 mahina, deposit ek mahine ka',
    'Turant shift kar sakte ho',
  ].join('\n');
  assert.deepEqual(
    parse(text),
    expected(
      {
        kind: 'room',
        stayType: 'pg',
        whoCanStay: 'girls',
        moveIn: 'now',
        sharing: 3,
        rentPp: 6500,
        place: { landmarkId: 'other', area: 'Chelekere' },
      },
      { cleanedDescription: text, flags: [] },
    ),
  );
});

test('agent listing without brokerage is flagged', () => {
  const result = parse('Agent listing: 1BHK near Manyata, rent 15k\nContact agent 9123456789');
  assert.equal(result.draft.postedAs, 'agent');
  assert.equal(result.draft.brokerage, undefined);
  assert.deepEqual(result.flags, ['phone_removed', 'brokerage_unclear']);
  assert.equal(result.cleanedDescription, 'Agent listing: 1BHK near Manyata, rent 15k');
  assert.equal(result.draft.place?.landmarkId, 'kju-main-manyata-tech-park');
});

test('price forms: Rs. and /-, trailing rs, lakh and k', () => {
  assert.equal(parse('Rent Rs. 8500/- only').draft.rentPp, 8500);
  assert.equal(parse('PG room 9000rs per month').draft.rentPp, 9000);
  assert.equal(parse('Rent 7.5k, deposit 1L').draft.deposit, 100000);
  assert.equal(parse('2 sharing, 3 bhk, 500 m from college').draft.rentPp, undefined);
});

test('move-in: from 1st, month names and past months roll forward', () => {
  assert.equal(parse('Available from 1st').draft.moveIn, '2026-12-01');
  assert.equal(parse('Available from 1st', new Date('2026-12-20T10:00:00+05:30')).draft.moveIn, '2027-01-01');
  assert.equal(parse('Available from June').draft.moveIn, '2027-06-01');
  assert.equal(parse('Available from November').draft.moveIn, 'now');
  assert.equal(parse('1st Jan onwards').draft.moveIn, '2027-01-01');
  assert.equal(parse('ready to move').draft.moveIn, 'now');
});

test('door numbers are flagged and kept for the poster to remove', () => {
  const result = parse('Room at #12, 3rd cross, Kothanur');
  assert.deepEqual(result.flags, ['door_number']);
  assert.equal(result.cleanedDescription, 'Room at #12, 3rd cross, Kothanur');
});

test('the cleaned description passes the create schema phone check', () => {
  const result = parse('PG near Falcon, call 98450 12345 or +91 99001 22334');
  assert.equal(result.cleanedDescription, 'PG near Falcon');
  assert.equal(result.phone, '9845012345');
  const check = HousingCreateSchema.safeParse({ description: result.cleanedDescription });
  assert.equal(check.success, false);
  if (!check.success) assert.ok(!check.error.issues.some((issue) => issue.path[0] === 'description'));
});

test('empty or unrelated text fills nothing', () => {
  assert.deepEqual(parse(''), { draft: {}, filled: [], cleanedDescription: '', flags: [] });
  assert.deepEqual(parse('Hey all, good morning'), { draft: {}, filled: [], cleanedDescription: 'Hey all, good morning', flags: [] });
});
