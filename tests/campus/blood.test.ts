import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BLOOD_GROUPS,
  alertCopy,
  canDonateTo,
  countByGroup,
  donorGroupsFor,
  firstName,
  isListed,
  matchDonors,
  neededByError,
  normalizeWhatsapp,
  urgencyFor,
  viewRequest,
  type BloodRequestRecord,
} from '../../src/lib/campus/blood.ts';
import type { BloodGroup } from '../../src/types/utilities.ts';

const time = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) });

/** Standard red cell table: recipient -> groups it can receive from. */
const RECEIVES_FROM: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

test('there are eight blood groups', () => {
  assert.equal(BLOOD_GROUPS.length, 8);
});

test('O- gives to every group', () => {
  for (const recipient of BLOOD_GROUPS) assert.equal(canDonateTo('O-', recipient), true, recipient);
});

test('AB+ receives from every group', () => {
  for (const donor of BLOOD_GROUPS) assert.equal(canDonateTo(donor, 'AB+'), true, donor);
});

test('AB+ gives only to AB+ and O- receives only from O-', () => {
  assert.deepEqual(BLOOD_GROUPS.filter((recipient) => canDonateTo('AB+', recipient)), ['AB+']);
  assert.deepEqual(BLOOD_GROUPS.filter((donor) => canDonateTo(donor, 'O-')), ['O-']);
});

test('the full compatibility table matches', () => {
  for (const recipient of BLOOD_GROUPS) {
    for (const donor of BLOOD_GROUPS) {
      assert.equal(canDonateTo(donor, recipient), RECEIVES_FROM[recipient].includes(donor), `${donor} -> ${recipient}`);
    }
  }
});

test('donorGroupsFor lists the exact group first', () => {
  assert.deepEqual(donorGroupsFor('B+'), ['B+', 'B-', 'O+', 'O-']);
  assert.equal(donorGroupsFor('AB-')[0], 'AB-');
  assert.equal(donorGroupsFor('O-').length, 1);
});

const NOW = new Date('2026-11-07T10:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();

const donors = [
  { userId: 'a', bloodGroup: 'O-' as BloodGroup, available: true, lastDonatedAt: null },
  { userId: 'b', bloodGroup: 'B+' as BloodGroup, available: true, lastDonatedAt: daysAgo(200) },
  { userId: 'c', bloodGroup: 'A+' as BloodGroup, available: true, lastDonatedAt: null },
  { userId: 'd', bloodGroup: 'B-' as BloodGroup, available: false, lastDonatedAt: null },
  { userId: 'e', bloodGroup: 'O+' as BloodGroup, available: true, lastDonatedAt: daysAgo(30) },
  { userId: 'f', bloodGroup: 'B+' as BloodGroup, available: true, lastDonatedAt: null },
  { userId: 'b', bloodGroup: 'B+' as BloodGroup, available: true, lastDonatedAt: null },
];

test('matchDonors keeps compatible, available, rested donors, exact group first', () => {
  const matched = matchDonors(donors, 'B+', { now: NOW, excludeUserId: 'f' });
  // c is A+ (incompatible), d paused, e donated 30 days ago, f is the requester, b only once.
  assert.deepEqual(matched.map((donor) => donor.userId), ['b', 'a']);
});

test('matchDonors for O- only finds O- donors', () => {
  assert.deepEqual(matchDonors(donors, 'O-', { now: NOW }).map((donor) => donor.userId), ['a']);
});

test('matchDonors for AB+ finds every available rested donor', () => {
  assert.deepEqual(
    matchDonors(donors, 'AB+', { now: NOW }).map((donor) => donor.userId).sort(),
    ['a', 'b', 'c', 'f'],
  );
});

test('matchDonors honours a custom rest period and ignores bad groups', () => {
  const withBad = [...donors, { userId: 'z', bloodGroup: 'C+' as BloodGroup, available: true, lastDonatedAt: null }];
  assert.deepEqual(matchDonors(withBad, 'O+', { now: NOW, restDays: 0 }).map((donor) => donor.userId), ['e', 'a']);
});

test('countByGroup counts available donors only, every group present', () => {
  const counts = countByGroup(donors);
  assert.equal(Object.keys(counts).length, 8);
  assert.equal(counts['B+'], 3);
  assert.equal(counts['B-'], 0);
  assert.equal(counts['O-'], 1);
  assert.equal(counts['AB+'], 0);
});

test('urgencyFor buckets by time left', () => {
  assert.equal(urgencyFor(new Date(NOW.getTime() + 2 * 3600000), NOW), 'now');
  assert.equal(urgencyFor(new Date(NOW.getTime() + 12 * 3600000), NOW), 'today');
  assert.equal(urgencyFor(new Date(NOW.getTime() + 3 * 86400000), NOW), 'this_week');
});

test('neededByError rejects the past and beyond a week', () => {
  assert.equal(neededByError(new Date(NOW.getTime() + 3600000), NOW), null);
  assert.equal(neededByError(new Date(NOW.getTime() - 3600000), NOW), 'Pick a time from now on');
  assert.equal(neededByError(new Date(NOW.getTime() + 8 * 86400000), NOW), 'Pick a time within a week');
  assert.equal(neededByError('nonsense', NOW), 'Pick when it is needed');
});

test('normalizeWhatsapp keeps a 10-digit Indian mobile', () => {
  assert.deepEqual(normalizeWhatsapp('+91 98765 43210'), { ok: true, value: '9876543210' });
  assert.deepEqual(normalizeWhatsapp('09876543210'), { ok: true, value: '9876543210' });
  assert.equal(normalizeWhatsapp('12345').ok, false);
  assert.equal(normalizeWhatsapp('98765abc10').ok, false);
});

test('firstName keeps only the first word', () => {
  assert.equal(firstName('Sana Iqbal'), 'Sana');
  assert.equal(firstName('  '), 'Student');
});

function request(overrides: Partial<BloodRequestRecord> = {}): BloodRequestRecord & { id: string } {
  return {
    id: 'req-1',
    authorId: 'joel',
    campusId: 'kju-main',
    collegeId: 'kju',
    bloodGroup: 'B+',
    units: 2,
    urgency: 'today',
    status: 'open',
    hospital: 'Falcon Hospital',
    area: '',
    forWhom: null,
    neededBy: time('2026-11-07T18:00:00.000Z'),
    posterDisplayName: 'Joel Mathew',
    helpers: {
      k1: { userId: 'farhan', firstName: 'Farhan', createdAt: time('2026-11-07T09:00:00.000Z'), sharedWhatsapp: '9876543210', sharedAt: null },
      k2: { userId: 'vivek', firstName: 'Vivek Rao', createdAt: time('2026-11-07T09:30:00.000Z'), sharedWhatsapp: null, sharedAt: null },
    },
    createdAt: time('2026-11-07T08:00:00.000Z'),
    updatedAt: time('2026-11-07T08:00:00.000Z'),
    ...overrides,
  };
}

test('the requester sees a helper count and first names, never ids or numbers', () => {
  const view = viewRequest(request(), 'joel');
  assert.equal(view.isOwner, true);
  assert.equal(view.helperCount, 2);
  assert.deepEqual(view.helpers, [
    { key: 'k1', firstName: 'Farhan', shared: true },
    { key: 'k2', firstName: 'Vivek', shared: false },
  ]);
  const text = JSON.stringify(view);
  assert.equal(text.includes('farhan'), false);
  assert.equal(text.includes('9876543210'), false);
});

test('others see no helpers; a helper sees only the number shared with them', () => {
  const stranger = viewRequest(request(), 'sana', 'O-');
  assert.equal(stranger.helperCount, 0);
  assert.deepEqual(stranger.helpers, []);
  assert.equal(stranger.iCanHelp, false);
  assert.equal(stranger.sharedWhatsapp, null);
  assert.equal(stranger.canDonate, true);
  assert.equal(stranger.posterFirstName, 'Joel');

  const shared = viewRequest(request(), 'farhan', 'A+');
  assert.equal(shared.iCanHelp, true);
  assert.equal(shared.sharedWhatsapp, '9876543210');
  assert.equal(shared.canDonate, false);

  const waiting = viewRequest(request(), 'vivek');
  assert.equal(waiting.iCanHelp, true);
  assert.equal(waiting.sharedWhatsapp, null);
});

test('isListed hides closed and long-past requests', () => {
  const now = new Date('2026-11-07T20:00:00.000Z');
  assert.equal(isListed(request(), now), true);
  assert.equal(isListed(request({ status: 'closed' }), now), false);
  assert.equal(isListed(request(), new Date('2026-11-08T07:00:00.000Z')), false);
});

test('alertCopy keeps the title under 10 words', () => {
  const copy = alertCopy({ bloodGroup: 'AB-', units: 1, hospital: 'Falcon Hospital', urgency: 'now' });
  assert.equal(copy.title, 'AB- blood needed now');
  assert.ok(copy.title.split(' ').length < 10);
  assert.equal(copy.body, '1 unit at Falcon Hospital. Tap if you can help.');
});
