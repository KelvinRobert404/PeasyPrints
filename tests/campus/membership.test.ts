import assert from 'node:assert/strict';
import test from 'node:test';
import type { CollegeMembership } from '../../src/types/campus.ts';
import {
  COLLEGE_LOCKED_MESSAGE,
  PICK_COLLEGE_FIRST_MESSAGE,
  applyOnboardingInput,
  buildCampusSession,
  campusConfigPayload,
  campusRefOf,
  collegeConfigFromDoc,
  computeNeeds,
  emailMatchesDomains,
  fixtureIdentity,
  matchCollegeEmail,
  parseCampusFlags,
  parseCollegeConfigDoc,
  parseOnboardingBody,
  serializeMembership,
  verificationStatus,
} from '../../src/lib/campus/membership.ts';
import { getCollege } from '../../src/lib/campus/catalog.ts';

const NOW = new Date('2026-11-07T10:00:00Z');
const FUTURE = '2027-06-01T00:00:00.000Z';
const PAST = '2026-01-01T00:00:00.000Z';

function member(overrides: Partial<CollegeMembership> = {}): CollegeMembership {
  return {
    userId: 'u1',
    collegeId: 'kju',
    collegeCode: 'KJU',
    collegeName: 'Kristu Jayanti University',
    displayName: 'Sana',
    student: { status: 'unverified', expiresAt: null },
    girlsSpace: { status: 'unverified', expiresAt: null },
    campusId: 'kju-main',
    campusLabel: 'KJU Main',
    ...overrides,
  };
}

test('emailMatchesDomains: exact or subdomain, case-insensitive', () => {
  assert.equal(emailMatchesDomains('a@kju.in', ['kju.in']), true);
  assert.equal(emailMatchesDomains('A@KJU.IN', ['Kju.In']), true);
  assert.equal(emailMatchesDomains('a@students.kju.in', ['kju.in']), true);
  assert.equal(emailMatchesDomains('a@kju.in', ['@kju.in']), true);
});

test('emailMatchesDomains: rejects lookalike and suffix tricks', () => {
  assert.equal(emailMatchesDomains('a@notkju.in', ['kju.in']), false);
  assert.equal(emailMatchesDomains('a@kju.in.evil.io', ['kju.in']), false);
  assert.equal(emailMatchesDomains('kju.in@evil.io', ['kju.in']), false);
  assert.equal(emailMatchesDomains('a@kju.in', []), false);
  assert.equal(emailMatchesDomains('a@kju.in', ['']), false);
  assert.equal(emailMatchesDomains('kju.in', ['kju.in']), false);
  assert.equal(emailMatchesDomains(null, ['kju.in']), false);
});

test('matchCollegeEmail: verified only, prefers Google, method follows source', () => {
  const domains = ['kju.in'];
  assert.equal(matchCollegeEmail([{ address: 'a@kju.in', verified: false, google: true }], domains), null);
  assert.deepEqual(matchCollegeEmail([{ address: 'A@kju.in', verified: true, google: false }], domains), { address: 'a@kju.in', method: 'email_code' });
  assert.deepEqual(
    matchCollegeEmail(
      [
        { address: 'me@gmail.com', verified: true, google: true },
        { address: 'code@kju.in', verified: true, google: false },
        { address: 'g@kju.in', verified: true, google: true },
      ],
      domains,
    ),
    { address: 'g@kju.in', method: 'google' },
  );
});

test('verificationStatus: approved only while unexpired', () => {
  assert.equal(verificationStatus({ status: 'approved', expiresAt: FUTURE }, NOW), 'approved');
  assert.equal(verificationStatus({ status: 'approved', expiresAt: PAST }, NOW), 'expired');
  assert.equal(verificationStatus({ status: 'approved' }, NOW), 'expired');
  assert.equal(verificationStatus({ status: 'bogus' }, NOW), 'unverified');
  assert.equal(verificationStatus(undefined, NOW), 'unverified');
});

test('serializeMembership: campus label from catalog, unknown college stays empty', () => {
  const data = { collegeId: 'kju', campusId: 'kju-airport-road', displayName: 'Kabir', studentVerification: { status: 'approved', method: 'google', expiresAt: FUTURE } };
  const m = serializeMembership('u2', data, null, NOW);
  assert.equal(m.collegeCode, 'KJU');
  assert.equal(m.campusLabel, 'KJU Airport Rd');
  assert.equal(m.student.status, 'approved');
  assert.equal(m.student.method, 'google');

  const stray = serializeMembership('u3', { collegeId: 'nope', campusId: 'kju-main' }, null, NOW);
  assert.equal(stray.collegeId, '');
  assert.equal(stray.campusId, undefined);

  const wrongCampus = serializeMembership('u4', { collegeId: 'jain', campusId: 'kju-main' }, null, NOW);
  assert.equal(wrongCampus.campusId, undefined);
});

test('computeNeeds walks college, verify, course, done', () => {
  assert.equal(computeNeeds(null), 'college');
  assert.equal(computeNeeds(member({ campusId: undefined })), 'college');
  assert.equal(computeNeeds(member()), 'verify');
  assert.equal(computeNeeds(member({ student: { status: 'pending', expiresAt: null } })), 'verify');
  assert.equal(computeNeeds(member({ student: { status: 'approved', expiresAt: FUTURE } })), 'course');
  assert.equal(
    computeNeeds(member({ student: { status: 'approved', expiresAt: FUTURE }, course: { programmeId: 'bcom', specialisation: null, semester: 3 } })),
    null,
  );
});

test('applyOnboardingInput: first pick sets college and campus', () => {
  const result = applyOnboardingInput(null, { collegeId: 'kju', campusId: 'kju-airport-road' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.patch, { collegeId: 'kju', collegeCode: 'KJU', collegeName: getCollege('kju')!.name, campusId: 'kju-airport-road' });
  assert.equal(result.collegeChanged, false);
});

test('applyOnboardingInput: needs a college and a campus of that college', () => {
  assert.deepEqual(applyOnboardingInput(null, {}), { ok: false, status: 409, error: PICK_COLLEGE_FIRST_MESSAGE });
  assert.equal(applyOnboardingInput(null, { collegeId: 'nope', campusId: 'kju-main' }).ok, false);
  assert.equal(applyOnboardingInput(null, { collegeId: 'kju' }).ok, false);
  assert.equal(applyOnboardingInput(null, { collegeId: 'jain', campusId: 'kju-main' }).ok, false);
});

test('applyOnboardingInput: college locked while pending or approved', () => {
  for (const status of ['pending', 'approved'] as const) {
    const current = member({ student: { status, expiresAt: status === 'approved' ? FUTURE : null } });
    assert.deepEqual(applyOnboardingInput(current, { collegeId: 'jain', campusId: 'jain-knowledge-campus' }), { ok: false, status: 409, error: COLLEGE_LOCKED_MESSAGE });
  }
  const blocked = applyOnboardingInput(member(), { collegeId: 'christ' }, { blocked: true });
  assert.equal(blocked.ok, false);
});

test('applyOnboardingInput: unverified member can change college, campus change always allowed', () => {
  const jainCampus = collegeConfigFromDoc('jain', null)!.campuses[0]!.id;
  const moved = applyOnboardingInput(member(), { collegeId: 'jain', campusId: jainCampus });
  assert.equal(moved.ok, true);
  if (moved.ok) assert.equal(moved.collegeChanged, true);

  const approved = member({ student: { status: 'approved', expiresAt: FUTURE } });
  const campus = applyOnboardingInput(approved, { collegeId: 'kju', campusId: 'kju-airport-road' });
  assert.equal(campus.ok, true);
  if (campus.ok) assert.equal(campus.patch.campusId, 'kju-airport-road');

  // Changing college without naming a new campus never keeps the old college's campus.
  assert.equal(applyOnboardingInput(member(), { collegeId: 'jain' }).ok, false);
});

test('applyOnboardingInput: stay distance rounded for privacy, 0 to 50 km', () => {
  const ok = applyOnboardingInput(member(), { stay: { type: 'pg', distanceM: 649 } });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.patch.stay, { type: 'pg', distanceM: 650 });

  const none = applyOnboardingInput(member(), { stay: { type: 'home' } });
  if (none.ok) assert.deepEqual(none.patch.stay, { type: 'home', distanceM: null });
  else assert.fail('home without distance should pass');

  for (const distanceM of [-1, 50_001, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(applyOnboardingInput(member(), { stay: { type: 'pg', distanceM } }).ok, false, String(distanceM));
  }
  assert.equal(applyOnboardingInput(member(), { stay: { type: 'pg', distanceM: 50_000 } }).ok, true);
});

test('applyOnboardingInput and parseOnboardingBody reject coordinates', () => {
  const withCoords = { type: 'pg', distanceM: 200, lat: 13.05, lng: 77.64 } as unknown as { type: 'pg'; distanceM: number };
  assert.equal(applyOnboardingInput(member(), { stay: withCoords }).ok, false);
  assert.equal(parseOnboardingBody({ collegeId: 'kju', campusId: 'kju-main', lat: 1, lng: 2 }).ok, false);
  assert.equal(parseOnboardingBody({ stay: { type: 'pg', latitude: 1 } }).ok, false);
});

test('applyOnboardingInput: course validated and canonicalised', () => {
  const ok = applyOnboardingInput(member(), { course: { programmeId: 'bcom', semester: 3 } });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.patch.course, { programmeId: 'bcom', specialisation: null, semester: 3 });
  assert.equal(applyOnboardingInput(member(), { course: { programmeId: 'nope', semester: 1 } }).ok, false);
  assert.equal(applyOnboardingInput(member(), { course: { programmeId: 'bcom', semester: 99 } }).ok, false);
});

test('parseOnboardingBody: shapes the input', () => {
  const parsed = parseOnboardingBody({ collegeId: ' kju ', campusId: 'kju-main', stay: { type: 'flat', distanceM: 1200 }, course: { programmeId: 'bca', semester: 2 } });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.input.collegeId, 'kju');
    assert.deepEqual(parsed.input.stay, { type: 'flat', distanceM: 1200 });
    assert.equal(parsed.input.course?.programmeId, 'bca');
  }
  assert.equal(parseOnboardingBody(null).ok, false);
  assert.equal(parseOnboardingBody({ stay: { type: 'castle' } }).ok, false);
  assert.equal(parseOnboardingBody({ collegeId: 5 }).ok, false);
});

test('college config doc: sanitized override and flags', () => {
  const doc = {
    launchState: 'waitlist',
    emailDomains: [' @KJU.in ', 'bad', 7],
    semesterStarts: [{ term: 'odd', month: 7 }, { term: 'odd', month: 13 }],
    campuses: { 'kju-main': { label: 'Main', pickupPoints: [{ id: 'gate', label: 'Gate' }, { id: '', label: 'x' }] } },
    housingEnabled: false,
  };
  const override = parseCollegeConfigDoc(doc);
  assert.equal(override.launchState, 'waitlist');
  assert.deepEqual(override.emailDomains, ['kju.in']);
  assert.deepEqual(override.semesterStarts, [{ term: 'odd', month: 7 }]);
  assert.deepEqual(override.campuses?.['kju-main']?.pickupPoints, [{ id: 'gate', label: 'Gate' }]);

  const flags = parseCampusFlags(doc);
  assert.equal(flags.housing, false);
  assert.equal(flags.marketplace, true);

  const config = collegeConfigFromDoc('kju', doc)!;
  assert.equal(config.college.launchState, 'waitlist');
  assert.equal(config.campuses.find((c) => c.id === 'kju-main')?.label, 'Main');
  assert.equal(collegeConfigFromDoc('nope', doc), null);
});

test('campusConfigPayload: member campus only', () => {
  const config = collegeConfigFromDoc('kju', null)!;
  const payload = campusConfigPayload(config, 'kju-airport-road')!;
  assert.equal(payload.campus.label, 'KJU Airport Rd');
  assert.equal(payload.college.code, 'KJU');
  assert.ok(Array.isArray(payload.campus.landmarks));
  assert.equal(campusConfigPayload(config, 'jain-knowledge-campus'), null);
  assert.equal(campusConfigPayload(config, null), null);
});

test('fixture users resolve to KJU Main and KJU Airport Rd', () => {
  const expected = {
    'verified-kju-main': { label: 'KJU Main', needs: null },
    'verified-kju-airport': { label: 'KJU Airport Rd', needs: null },
    'girls-approved': { label: 'KJU Main', needs: null },
    admin: { label: 'KJU Main', needs: null },
    'unverified-kju': { label: 'KJU Main', needs: 'verify' },
    'pending-id-card': { label: 'KJU Main', needs: 'verify' },
  } as const;
  for (const [id, want] of Object.entries(expected)) {
    const fixture = fixtureIdentity(id as keyof typeof expected, NOW);
    const config = collegeConfigFromDoc('kju', null);
    const membership = serializeMembership(id, fixture.membership!, config, NOW);
    const session = buildCampusSession(membership, config, 0);
    assert.equal(session.campus?.label, want.label, id);
    assert.equal(session.onboarding?.needs, want.needs, id);
  }
  assert.equal(fixtureIdentity('girls-approved', NOW).membership && serializeMembership('g', fixtureIdentity('girls-approved', NOW).membership!, null, NOW).girlsSpace.status, 'approved');
  assert.equal(fixtureIdentity('admin', NOW).admin, true);
  assert.equal(fixtureIdentity('verified-kju-main', NOW).admin, false);

  const fresh = fixtureIdentity('new-user', NOW);
  assert.equal(fresh.membership, null);
  assert.equal(buildCampusSession(null, null, 0).onboarding?.needs, 'college');
  assert.equal(campusRefOf(null), null);
});
