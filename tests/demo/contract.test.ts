import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DEMO_DATE,
  DEMO_DATE_COOKIE,
  DEMO_DATE_IDS,
  DEMO_EMAIL_DOMAIN,
  DEMO_PERSONAS,
  DEMO_PORT,
  DEMO_SESSION_COOKIE,
  DEMO_VISITOR_COOKIE,
  WALKTHROUGH_UID,
  decodeDemoSession,
  demoPersona,
  demoPersonaByUid,
  encodeDemoSession,
  isDemoDateId,
  isDemoPersonaId,
  isSeasonDocId,
  parseDemoDate,
  walkthroughEmails,
} from '../../src/lib/demo/contract.ts';
import { isDemoMode } from '../../src/lib/demo/mode.ts';
import { FIXTURE_USER_IDS, isFixtureMode } from '../../src/lib/firebase/fixtureMode.ts';

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const env = process.env as Record<string, string | undefined>;
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

function rawCookie(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

const email = (address: string) => ({ address, verified: true, google: true });

test('isDemoMode needs the exact flag and never runs in production', () => {
  withEnv({ NEXT_PUBLIC_SWOOP_DEMO: undefined, NODE_ENV: 'development' }, () => assert.equal(isDemoMode(), false));
  withEnv({ NEXT_PUBLIC_SWOOP_DEMO: 'true', NODE_ENV: 'development' }, () => assert.equal(isDemoMode(), false));
  withEnv({ NEXT_PUBLIC_SWOOP_DEMO: '1', NODE_ENV: 'production' }, () => assert.equal(isDemoMode(), false));
  withEnv({ NEXT_PUBLIC_SWOOP_DEMO: '1', NODE_ENV: 'development' }, () => assert.equal(isDemoMode(), true));
});

test('demo mode implies fixture mode, still never in production', () => {
  withEnv({ NEXT_PUBLIC_SWOOP_DEMO: '1', NEXT_PUBLIC_SWOOP_FIXTURES: undefined, NODE_ENV: 'development' }, () =>
    assert.equal(isFixtureMode(), true)
  );
  withEnv({ NEXT_PUBLIC_SWOOP_DEMO: '1', NEXT_PUBLIC_SWOOP_FIXTURES: undefined, NODE_ENV: 'production' }, () =>
    assert.equal(isFixtureMode(), false)
  );
  withEnv({ NEXT_PUBLIC_SWOOP_DEMO: undefined, NEXT_PUBLIC_SWOOP_FIXTURES: undefined, NODE_ENV: 'development' }, () =>
    assert.equal(isFixtureMode(), false)
  );
});

test('cookie names and port are fixed', () => {
  assert.equal(DEMO_VISITOR_COOKIE, 'swoop_demo_visitor');
  assert.equal(DEMO_SESSION_COOKIE, 'swoop_demo_session');
  assert.equal(DEMO_DATE_COOKIE, 'swoop_demo_date');
  assert.equal(DEMO_PORT, 3019);
});

test('session codec round-trips a persona and a walk-through session', () => {
  const sana = { uid: 'verified-kju-main' as const };
  const encoded = encodeDemoSession(sana);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeDemoSession(encoded), sana);
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')), sana);

  const riya = { uid: WALKTHROUGH_UID, emails: [...walkthroughEmails('personal'), { address: 'riya@kju.test', verified: true, google: false }] };
  assert.deepEqual(decodeDemoSession(encodeDemoSession(riya)), riya);
});

test('session codec: empty input is signed out', () => {
  assert.equal(decodeDemoSession(undefined), null);
  assert.equal(decodeDemoSession(null), null);
  assert.equal(decodeDemoSession(''), null);
});

test('session codec: malformed input gives null', () => {
  assert.equal(decodeDemoSession('not base64!'), null);
  assert.equal(decodeDemoSession('e30'), null); // {}
  assert.equal(decodeDemoSession(Buffer.from('{"uid":', 'utf8').toString('base64url')), null);
  assert.equal(decodeDemoSession(rawCookie('verified-kju-main')), null);
  assert.equal(decodeDemoSession(rawCookie([{ uid: 'verified-kju-main' }])), null);
  assert.equal(decodeDemoSession(rawCookie({ uid: 'verified-kju-main', emails: 'sana@kju.test' })), null);
  assert.equal(decodeDemoSession(rawCookie({ uid: 'verified-kju-main', emails: [{ address: 'x@kju.test' }] })), null);
  assert.equal(decodeDemoSession(rawCookie({ uid: 'verified-kju-main', emails: [{ address: 'nope', verified: true, google: true }] })), null);
  assert.equal(decodeDemoSession(Buffer.from([0xff, 0xfe, 0xfd]).toString('base64url')), null);
});

test('session codec: unknown uid gives null', () => {
  assert.equal(decodeDemoSession(rawCookie({ uid: 'someone-else' })), null);
  assert.equal(decodeDemoSession(rawCookie({ uid: 42 })), null);
  assert.throws(() => encodeDemoSession({ uid: 'someone-else' as never }));
});

test('session codec: more than 3 emails gives null', () => {
  const emails = ['a@kju.test', 'b@kju.test', 'c@kju.test', 'd@kju.test'].map(email);
  assert.equal(decodeDemoSession(rawCookie({ uid: WALKTHROUGH_UID, emails })), null);
  assert.throws(() => encodeDemoSession({ uid: WALKTHROUGH_UID, emails }));
  assert.deepEqual(decodeDemoSession(rawCookie({ uid: WALKTHROUGH_UID, emails: emails.slice(0, 3) })), {
    uid: WALKTHROUGH_UID,
    emails: emails.slice(0, 3),
  });
});

test('session codec drops unknown fields', () => {
  assert.deepEqual(decodeDemoSession(rawCookie({ uid: 'girls-approved', admin: true })), { uid: 'girls-approved' });
});

test('persona table matches the contract', () => {
  assert.deepEqual(
    DEMO_PERSONAS.map((p) => [p.id, p.uid, p.name]),
    [
      ['sana', 'verified-kju-main', 'Sana'],
      ['kabir', 'verified-kju-airport', 'Kabir'],
      ['ananya', 'girls-approved', 'Ananya'],
      ['meera', 'pending-id-card', 'Meera'],
    ]
  );
  assert.equal(DEMO_PERSONAS[0].campusLabel, 'KJU Main');
  assert.equal(demoPersona('kabir').campusLabel, 'KJU Airport Rd');
  for (const persona of DEMO_PERSONAS) {
    assert.ok((FIXTURE_USER_IDS as readonly string[]).includes(persona.uid));
    assert.ok(persona.line.length > 0 && persona.line.split(/\s+/).length < 10, persona.line);
    assert.equal(isDemoPersonaId(persona.id), true);
    assert.equal(demoPersonaByUid(persona.uid), persona);
  }
  assert.equal(isDemoPersonaId('riya'), false);
  assert.equal(demoPersonaByUid(WALKTHROUGH_UID), null);
});

test('walk-through emails', () => {
  assert.equal(WALKTHROUGH_UID, 'new-user');
  assert.equal(DEMO_EMAIL_DOMAIN, 'kju.test');
  assert.deepEqual(walkthroughEmails('college'), [{ address: 'riya@kju.test', verified: true, google: true }]);
  assert.deepEqual(walkthroughEmails('personal'), [{ address: 'riya.t@gmail.test', verified: true, google: true }]);
});

test('demo date ids', () => {
  assert.deepEqual([...DEMO_DATE_IDS], ['nov', 'may', 'july']);
  assert.equal(DEFAULT_DEMO_DATE, 'nov');
  assert.equal(isDemoDateId('may'), true);
  assert.equal(isDemoDateId('jul'), false);
  assert.equal(parseDemoDate('july'), 'july');
  assert.equal(parseDemoDate(undefined), 'nov');
  assert.equal(parseDemoDate('december'), 'nov');
});

test('season doc ids', () => {
  assert.equal(isSeasonDocId('season-may-bundle-1'), true);
  assert.equal(isSeasonDocId('listing-1'), false);
});
