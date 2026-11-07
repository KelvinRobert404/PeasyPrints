import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOUSE_RULE_OPTION_LABELS,
  HOUSING_KIND_LABELS,
  POSTED_AS_LABELS,
  RENT_TERMS_LABELS,
  containsPhoneNumber,
  housingPriceLabels,
  normalizePhone,
  roommateChips,
  toggleHouseRule,
  validHouseRules,
} from '../../src/lib/campus/housing/model.ts';
import {
  HousingCreateSchema,
  HousingPatchSchema,
  firstIssueMessage,
  housingCreateSchema,
} from '../../src/lib/campus/housing/schema.ts';

const NOW = new Date('2026-11-07T10:00:00+05:30');

function validInput(): Record<string, unknown> {
  return {
    kind: 'room',
    postedAs: 'tenant',
    stayType: 'pg',
    title: '2 sharing PG near Falcon',
    description: 'Clean room, food included.',
    whoCanStay: 'girls',
    houseRules: ['veg_only', 'curfew'],
    moveIn: 'now',
    bedsLeft: 1,
    sharing: 2,
    rentPp: 8500,
    deposit: 15000,
    rentTerms: 'fixed',
    place: { landmarkId: 'kju-main-falcon-hospital' },
  };
}

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.message);
}

test('label maps cover every option', () => {
  assert.deepEqual(HOUSING_KIND_LABELS, { room: 'Room', roommate: 'Roommate', replacement: 'Replacement', sublet: 'Sublet' });
  assert.equal(POSTED_AS_LABELS.agent, 'Agent listing');
  assert.equal(POSTED_AS_LABELS.tenant, 'I live here');
  assert.equal(HOUSE_RULE_OPTION_LABELS.no_restrictions, 'No restrictions');
  assert.equal(HOUSE_RULE_OPTION_LABELS.veg_only, 'Veg only');
  assert.equal(RENT_TERMS_LABELS.slightly_negotiable, 'Slightly negotiable');
  for (const label of [...Object.values(HOUSING_KIND_LABELS), ...Object.values(HOUSE_RULE_OPTION_LABELS), ...Object.values(RENT_TERMS_LABELS)]) {
    assert.notEqual(label, label.toUpperCase(), `${label} is not all caps`);
  }
});

test('housingPriceLabels reads per person and deposit', () => {
  assert.deepEqual(housingPriceLabels({ rentPp: 8500, deposit: 120000 }), { rent: 'Rs 8.5k pp', deposit: 'Rs 1.2L dep' });
  assert.deepEqual(housingPriceLabels({ rentPp: 650, deposit: null }), { rent: 'Rs 650 pp', deposit: null });
  assert.deepEqual(housingPriceLabels({ rentPp: 12000, deposit: 0 }), { rent: 'Rs 12k pp', deposit: 'No deposit' });
});

test('containsPhoneNumber spots Indian mobiles, not prices or pincodes', () => {
  for (const text of ['call 9845012345', '+91 98450 12345', '+91-98450-12345', '984 501 2345', '09845012345', 'dm 9 8 4 5 0 1 2 3 4 5']) {
    assert.equal(containsPhoneNumber(text), true, text);
  }
  for (const text of ['Rent 8500, deposit 25000', 'Pin 560077', 'Rs 1.2L dep', '12345678901234', '2 sharing, 3 bhk, 1st floor']) {
    assert.equal(containsPhoneNumber(text), false, text);
  }
  assert.equal(normalizePhone('+91 98450-12345'), '9845012345');
});

test('house rules: no restrictions stays alone', () => {
  assert.deepEqual(toggleHouseRule(['no_restrictions'], 'veg_only'), ['veg_only']);
  assert.deepEqual(toggleHouseRule(['veg_only', 'curfew'], 'no_restrictions'), ['no_restrictions']);
  assert.deepEqual(toggleHouseRule(['veg_only', 'curfew'], 'curfew'), ['veg_only']);
  assert.equal(validHouseRules([]), false);
  assert.equal(validHouseRules(['no_restrictions', 'curfew']), false);
  assert.equal(validHouseRules(['curfew', 'curfew']), false);
  assert.equal(validHouseRules(['curfew', 'veg_only']), true);
});

test('roommateChips follow H2 order', () => {
  const chips = roommateChips(
    {
      moveIn: '2026-12-01',
      houseRules: ['no_smoking', 'veg_only'],
      whoCanStay: 'girls',
      roommate: { groupSize: 2, languages: ['Malayalam', 'English'], homeState: 'Kerala' },
    },
    NOW,
  );
  assert.deepEqual(chips, [
    { id: 'move_in', label: 'From 1 Dec' },
    { id: 'rule', label: 'No smoking' },
    { id: 'rule', label: 'Veg only' },
    { id: 'gender', label: 'For girls' },
    { id: 'group', label: 'We are 2 looking' },
    { id: 'languages', label: 'Speaks Malayalam, English' },
    { id: 'home_state', label: 'From Kerala' },
  ]);
  assert.deepEqual(roommateChips({ moveIn: null, houseRules: ['no_restrictions'], whoCanStay: 'anyone', roommate: { groupSize: 1 } }, NOW), [
    { id: 'move_in', label: 'Move in now' },
    { id: 'rule', label: 'No restrictions' },
    { id: 'gender', label: 'Anyone' },
  ]);
});

test('create schema accepts a complete post and fills defaults', () => {
  const result = HousingCreateSchema.safeParse(validInput());
  assert.equal(result.success, true, messages(result).join('; '));
  if (!result.success) return;
  assert.equal(result.data.whoCanStay, 'girls');
  assert.equal(result.data.brokerage, null);
  assert.equal(result.data.furnishing, null);
  assert.deepEqual(result.data.amenities, []);
  assert.deepEqual(result.data.place, { landmarkId: 'kju-main-falcon-hospital', area: null, roughDistanceM: null });
});

test('agent post without brokerage is rejected', () => {
  const result = HousingCreateSchema.safeParse({ ...validInput(), postedAs: 'agent' });
  assert.equal(result.success, false);
  assert.ok(messages(result).includes('Say if the agent charges brokerage'));
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), postedAs: 'agent', brokerage: { charged: false } }).success, true);
  const charged = HousingCreateSchema.safeParse({ ...validInput(), postedAs: 'agent', brokerage: { charged: true } });
  assert.ok(messages(charged).includes('Add the brokerage amount'));
  const paid = HousingCreateSchema.safeParse({ ...validInput(), postedAs: 'agent', brokerage: { charged: true, amount: 8500 } });
  assert.equal(paid.success, true);
  if (paid.success) assert.deepEqual(paid.data.brokerage, { charged: true, amount: 8500 });
});

test('phone number in description or title is rejected', () => {
  const description = HousingCreateSchema.safeParse({ ...validInput(), description: 'Call 98450 12345 for visit' });
  assert.equal(description.success, false);
  assert.ok(messages(description).includes('Remove phone numbers. Students reach you in chat.'));
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), title: 'PG 9845012345' }).success, false);
});

test('house rules: at least one, no restrictions exclusive', () => {
  const empty = HousingCreateSchema.safeParse({ ...validInput(), houseRules: [] });
  assert.ok(messages(empty).includes('Pick at least one house rule'));
  const mixed = HousingCreateSchema.safeParse({ ...validInput(), houseRules: ['no_restrictions', 'curfew'] });
  assert.ok(messages(mixed).includes('No restrictions cannot go with other rules'));
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), houseRules: ['no_restrictions'] }).success, true);
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), houseRules: ['curfew', 'curfew'] }).success, false);
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), houseRules: ['pets_ok'] }).success, false);
});

test('who can stay is required; the girls route forces girls', () => {
  const missing = { ...validInput() };
  delete missing.whoCanStay;
  assert.ok(messages(HousingCreateSchema.safeParse(missing)).includes('Pick who can stay'));

  const girls = housingCreateSchema({ audience: 'girls' });
  const forced = girls.safeParse(missing);
  assert.equal(forced.success, true);
  if (forced.success) assert.equal(forced.data.whoCanStay, 'girls');
  assert.equal(girls.safeParse({ ...validInput(), whoCanStay: 'boys' }).success, false);
  assert.equal(girls.safeParse({ ...validInput(), whoCanStay: 'anyone' }).success, false);
});

test('move-in, rent, deposit and rent terms are checked', () => {
  const noMoveIn = { ...validInput() };
  delete noMoveIn.moveIn;
  assert.ok(messages(HousingCreateSchema.safeParse(noMoveIn)).includes('Pick a move-in date'));
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), moveIn: '2026-02-30' }).success, false);
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), moveIn: 'next_sem' }).success, true);
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), moveIn: '2026-12-01' }).success, true);
  assert.ok(messages(HousingCreateSchema.safeParse({ ...validInput(), rentPp: -1 })).includes('Rent cannot be negative'));
  assert.ok(messages(HousingCreateSchema.safeParse({ ...validInput(), deposit: -5 })).includes('Deposit cannot be negative'));
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), rentPp: 0, deposit: 0 }).success, true);
  assert.equal(HousingCreateSchema.safeParse({ ...validInput(), deposit: null }).success, true);
  for (const rentTerms of ['fixed', 'negotiable', 'slightly_negotiable']) {
    assert.equal(HousingCreateSchema.safeParse({ ...validInput(), rentTerms }).success, true, rentTerms);
  }
  assert.ok(messages(HousingCreateSchema.safeParse({ ...validInput(), rentTerms: 'open' })).includes('Say if the rent is negotiable'));
});

test('place: a landmark, or other with typed area and rough distance', () => {
  const other = HousingCreateSchema.safeParse({ ...validInput(), place: { landmarkId: 'other', area: 'Chelekere', roughDistanceM: 1800 } });
  assert.equal(other.success, true);
  if (other.success) assert.deepEqual(other.data.place, { landmarkId: 'other', area: 'Chelekere', roughDistanceM: 1800 });
  const bare = HousingCreateSchema.safeParse({ ...validInput(), place: { landmarkId: 'other' } });
  assert.deepEqual(messages(bare), ['Type the area', 'Add a rough distance']);
  assert.ok(messages(HousingCreateSchema.safeParse({ ...validInput(), place: undefined })).includes('Pick a place'));
  const listed = housingCreateSchema({ landmarkIds: ['kju-main-falcon-hospital'] });
  assert.equal(listed.safeParse(validInput()).success, true);
  assert.ok(messages(listed.safeParse({ ...validInput(), place: { landmarkId: 'kju-main-nowhere' } })).includes('Pick a place from the list'));
});

test('patch union accepts each action and rejects unknown ones', () => {
  for (const body of [
    { action: 'confirm' },
    { action: 'reserve' },
    { action: 'unreserve' },
    { action: 'booked' },
    { action: 'close' },
    { action: 'lower_price', rentPp: 7500 },
    { action: 'beds', bedsLeft: 0 },
    { action: 'promotion', eligible: true },
  ]) {
    const result = HousingPatchSchema.safeParse(body);
    assert.equal(result.success, true, body.action);
    if (result.success) assert.deepEqual(result.data, body);
  }
  assert.equal(HousingPatchSchema.safeParse({ action: 'lower_price' }).success, false);
  assert.equal(HousingPatchSchema.safeParse({ action: 'lower_price', rentPp: -10 }).success, false);
  assert.equal(HousingPatchSchema.safeParse({ action: 'beds', bedsLeft: 1.5 }).success, false);
  const unknown = HousingPatchSchema.safeParse({ action: 'delete' });
  assert.equal(unknown.success, false);
  if (!unknown.success) assert.equal(firstIssueMessage(unknown.error), 'Unknown action');
});
