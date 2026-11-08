import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMO_EMAIL_DOMAIN,
  DEMO_PERSONAS,
  DEMO_SESSION_COOKIE,
  WALKTHROUGH_COLLEGE_EMAIL,
  WALKTHROUGH_PERSONAL_EMAIL,
  WALKTHROUGH_UID,
  encodeDemoSession,
  type DemoSession,
} from '../../src/lib/demo/contract.ts';
import {
  addDemoEmail,
  demoAuthFields,
  demoClerkUser,
  demoIdentity,
  demoRouteMatcher,
  demoSessionPayload,
  demoTokenFor,
  demoTokenUid,
  normaliseDemoEmail,
  parseSessionPost,
  readDemoSession,
  routePatternToRegExp,
} from '../../src/lib/demo/server/identity.ts';
import { fixtureIdentity, matchCollegeEmail } from '../../src/lib/campus/membership.ts';
import { buildUsers } from '../../src/lib/campus/fixtures/print.ts';

const KJU_DOMAINS = [DEMO_EMAIL_DOMAIN];

function cookieReader(value: string | undefined) {
  return { get: (name: string) => (name === DEMO_SESSION_COOKIE && value !== undefined ? { value } : undefined) };
}

/** The same mapping src/lib/campus/auth.ts applies to a Clerk user. */
function clerkEmails(user: ReturnType<typeof demoClerkUser>) {
  return user.emailAddresses.map((item) => ({
    address: item.emailAddress,
    verified: item.verification?.status === 'verified',
    google: Boolean(item.linkedTo?.some((link) => link.type === 'oauth_google')) || item.verification?.strategy === 'from_oauth_google',
  }));
}

/** The same check as verifiedPrimaryEmail in src/lib/admin/config.ts. */
function verifiedPrimary(user: ReturnType<typeof demoClerkUser>) {
  const primary = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId);
  return primary?.verification?.status === 'verified' ? primary.emailAddress : null;
}

function mustParse(body: unknown): DemoSession {
  const parsed = parseSessionPost(body);
  assert.ok(parsed.ok, JSON.stringify(parsed));
  return parsed.value.session;
}

function mustAdd(session: DemoSession, address: unknown): DemoSession {
  const result = addDemoEmail(session, address);
  assert.ok(result.ok, JSON.stringify(result));
  return result.value;
}

test('no cookie or a bad cookie is signed out', () => {
  assert.equal(readDemoSession(null), null);
  assert.equal(readDemoSession(cookieReader(undefined)), null);
  assert.equal(readDemoSession(cookieReader('')), null);
  assert.equal(readDemoSession(cookieReader('not-json!')), null);
  assert.equal(readDemoSession(cookieReader(encodeDemoSession({ uid: 'verified-kju-main' })))?.uid, 'verified-kju-main');
});

test('personas take names from fixtureIdentity and emails from the seeded users docs', () => {
  const users = new Map(buildUsers(new Date()).map((doc) => [doc.id, doc.data.email]));
  for (const persona of DEMO_PERSONAS) {
    const identity = demoIdentity({ uid: persona.uid });
    assert.equal(identity.userId, persona.uid);
    assert.equal(identity.displayName, fixtureIdentity(persona.uid).displayName);
    assert.equal(identity.displayName, persona.name);
    assert.equal(identity.primaryEmail, users.get(persona.uid));
    assert.equal(identity.persona?.id, persona.id);
    assert.equal(identity.admin, false);
  }
});

test('the college domain matches Sana, Kabir and Ananya but never Meera', () => {
  assert.ok(matchCollegeEmail(demoIdentity({ uid: 'verified-kju-main' }).emails, KJU_DOMAINS));
  assert.ok(matchCollegeEmail(demoIdentity({ uid: 'verified-kju-airport' }).emails, KJU_DOMAINS));
  assert.ok(matchCollegeEmail(demoIdentity({ uid: 'girls-approved' }).emails, KJU_DOMAINS));
  assert.equal(matchCollegeEmail(demoIdentity({ uid: 'pending-id-card' }).emails, KJU_DOMAINS), null);
});

test('session POST bodies', () => {
  assert.deepEqual(mustParse({ persona: 'sana' }), { uid: 'verified-kju-main' });
  assert.deepEqual(mustParse({ persona: 'meera' }), { uid: 'pending-id-card' });
  assert.equal(parseSessionPost({ persona: 'admin' }).ok, false);
  assert.equal(parseSessionPost({ persona: 'verified-kju-main' }).ok, false);

  const college = parseSessionPost({ google: 'college' });
  assert.ok(college.ok);
  assert.equal(college.value.kind, 'walkthrough');
  assert.deepEqual(college.value.session, { uid: WALKTHROUGH_UID, emails: [{ address: WALKTHROUGH_COLLEGE_EMAIL, verified: true, google: true }] });
  assert.equal(mustParse({ google: 'personal' }).emails?.[0].address, WALKTHROUGH_PERSONAL_EMAIL);
  assert.equal(parseSessionPost({ google: 'work' }).ok, false);

  assert.deepEqual(mustParse({ emailCode: { email: ' Riya@KJU.test ' } }), {
    uid: WALKTHROUGH_UID,
    emails: [{ address: 'riya@kju.test', verified: true, google: false }],
  });
  assert.equal(parseSessionPost({ emailCode: { email: 'nope' } }).ok, false);
  assert.equal(parseSessionPost({ emailCode: 'riya@kju.test' }).ok, false);
  for (const bad of [null, undefined, 'sana', [], {}]) assert.equal(parseSessionPost(bad).ok, false);
  const failure = parseSessionPost({});
  assert.ok(!failure.ok);
  assert.equal(failure.status, 400);
});

test('Google college sign-in auto-approves through the domain check; personal does not', () => {
  const college = demoIdentity(mustParse({ google: 'college' }));
  assert.equal(college.displayName, 'Riya');
  assert.equal(college.primaryEmail, WALKTHROUGH_COLLEGE_EMAIL);
  assert.deepEqual(matchCollegeEmail(college.emails, KJU_DOMAINS), { address: WALKTHROUGH_COLLEGE_EMAIL, method: 'google' });

  const personal = demoIdentity(mustParse({ google: 'personal' }));
  assert.equal(personal.primaryEmail, WALKTHROUGH_PERSONAL_EMAIL);
  assert.equal(matchCollegeEmail(personal.emails, KJU_DOMAINS), null);
});

test('the Clerk-shaped user reads like Clerk to auth.ts and the admin check', () => {
  const session = mustParse({ google: 'college' });
  const user = demoClerkUser(session);
  assert.equal(user.id, WALKTHROUGH_UID);
  assert.equal(user.firstName, 'Riya');
  assert.equal(verifiedPrimary(user), WALKTHROUGH_COLLEGE_EMAIL);
  assert.deepEqual(clerkEmails(user), [{ address: WALKTHROUGH_COLLEGE_EMAIL, verified: true, google: true }]);
  assert.deepEqual(user.externalAccounts.map((account) => account.provider), ['oauth_google']);
  assert.deepEqual(user.phoneNumbers, []);
  assert.equal(user.primaryPhoneNumberId, null);

  const sana = demoClerkUser({ uid: 'verified-kju-main' });
  assert.equal(verifiedPrimary(sana), `sana@${DEMO_EMAIL_DOMAIN}`);
  assert.deepEqual(sana.externalAccounts, []);
  // What /api/users/upsert reads.
  assert.equal(sana.emailAddresses.find((item) => item.id === sana.primaryEmailAddressId)?.emailAddress, `sana@${DEMO_EMAIL_DOMAIN}`);
  assert.equal(sana.username, null);
});

test('adding the college email to a personal account approves by domain', () => {
  const personal = mustParse({ google: 'personal' });
  const added = mustAdd(personal, ' RIYA@kju.test ');
  assert.deepEqual(added.emails, [
    { address: WALKTHROUGH_PERSONAL_EMAIL, verified: true, google: true },
    { address: WALKTHROUGH_COLLEGE_EMAIL, verified: true, google: false },
  ]);
  // Still a valid cookie.
  assert.deepEqual(readDemoSession(cookieReader(encodeDemoSession(added))), added);
  const identity = demoIdentity(added);
  assert.equal(identity.primaryEmail, WALKTHROUGH_PERSONAL_EMAIL);
  assert.deepEqual(matchCollegeEmail(identity.emails, KJU_DOMAINS), { address: WALKTHROUGH_COLLEGE_EMAIL, method: 'email_code' });
  // Adding it again changes nothing.
  assert.deepEqual(mustAdd(added, WALKTHROUGH_COLLEGE_EMAIL), added);
});

test('adding emails: bad input, limits and personas', () => {
  const personal = mustParse({ google: 'personal' });
  for (const bad of [undefined, '', 'riya', 'riya@kju', 42, 'a b@kju.test']) {
    const result = addDemoEmail(personal, bad);
    assert.ok(!result.ok);
    assert.equal(result.status, 400);
  }
  const full = mustAdd(mustAdd(personal, 'one@kju.test'), 'two@kju.test');
  assert.equal(full.emails?.length, 3);
  const over = addDemoEmail(full, 'three@kju.test');
  assert.ok(!over.ok);
  assert.equal(over.status, 409);

  // A persona keeps her own email; the cookie only holds what she adds.
  const meera = mustAdd({ uid: 'pending-id-card' }, 'meera@kju.test');
  assert.deepEqual(meera.emails, [{ address: 'meera@kju.test', verified: true, google: false }]);
  const identity = demoIdentity(meera);
  assert.deepEqual(identity.emails.map((email) => email.address), ['meera.k@gmail.test', 'meera@kju.test']);
  assert.equal(identity.primaryEmail, 'meera.k@gmail.test');
  assert.deepEqual(mustAdd({ uid: 'verified-kju-main' }, `SANA@${DEMO_EMAIL_DOMAIN}`), { uid: 'verified-kju-main', emails: [] });

  // Riya with no cookie emails starts from her own.
  const bare = mustAdd({ uid: WALKTHROUGH_UID }, WALKTHROUGH_COLLEGE_EMAIL);
  assert.equal(bare.emails?.length, 2);
  assert.equal(bare.emails?.[0].address, fixtureIdentity(WALKTHROUGH_UID).emails[0].address);
});

test('normaliseDemoEmail', () => {
  assert.equal(normaliseDemoEmail(' A@B.co '), 'a@b.co');
  assert.equal(normaliseDemoEmail(`${'a'.repeat(250)}@b.co`), null);
  assert.equal(normaliseDemoEmail(null), null);
});

test('demo tokens', () => {
  assert.equal(demoTokenFor('verified-kju-main'), 'demo:verified-kju-main');
  assert.equal(demoTokenUid('demo:verified-kju-main'), 'verified-kju-main');
  assert.equal(demoTokenUid(demoTokenFor(WALKTHROUGH_UID)), WALKTHROUGH_UID);
  for (const bad of [null, undefined, '', 'demo:', 'demo:someone', 'verified-kju-main', 'eyJhbGciOi.x.y', 'Demo:new-user']) {
    assert.equal(demoTokenUid(bad), null);
  }
});

test('auth fields signed out and signed in', async () => {
  const out = demoAuthFields(null);
  assert.equal(out.userId, null);
  assert.equal(out.sessionId, null);
  assert.equal(out.sessionClaims, null);
  assert.equal(await out.getToken(), null);
  assert.equal(out.has({ role: 'admin' }), false);

  const sana = demoAuthFields({ uid: 'verified-kju-main' });
  assert.equal(sana.userId, 'verified-kju-main');
  assert.equal(sana.sessionId, 'sess_demo_verified-kju-main');
  assert.equal(await sana.getToken(), 'demo:verified-kju-main');
  assert.equal(await sana.getToken({ template: 'firebase' }), 'demo:verified-kju-main');
});

test('session payload', () => {
  assert.deepEqual(demoSessionPayload(null), { signedIn: false });
  const sana = demoSessionPayload({ uid: 'verified-kju-main' });
  assert.ok(sana.signedIn);
  assert.equal(sana.name, 'Sana');
  assert.equal(sana.persona, 'sana');
  const riya = demoSessionPayload(mustParse({ google: 'college' }));
  assert.ok(riya.signedIn);
  assert.equal(riya.persona, null);
  assert.equal(riya.primaryEmail, WALKTHROUGH_COLLEGE_EMAIL);
});

test('route matcher handles the proxy route strings', () => {
  const isPublic = demoRouteMatcher(['/', '/upload(.*)', '/login(.*)', '/privacy', '/helper']);
  const at = (pathname: string) => ({ nextUrl: { pathname } });
  assert.equal(isPublic(at('/')), true);
  assert.equal(isPublic(at('/upload')), true);
  assert.equal(isPublic(at('/upload/abc')), true);
  assert.equal(isPublic(at('/login?x=1'.split('?')[0])), true);
  assert.equal(isPublic(at('/privacy')), true);
  assert.equal(isPublic(at('/privacy/more')), false);
  assert.equal(isPublic(at('/orders')), false);
  assert.equal(isPublic(at('/uploadx')), true); // '(.*)' matches like Clerk's path-to-regexp form
  assert.equal(isPublic({ url: 'http://localhost:3019/helper?x=1' }), true);
  assert.equal(isPublic({ url: 'http://localhost:3019/marketplace' }), false);

  assert.equal(routePatternToRegExp('/orders/:id').test('/orders/abc'), true);
  assert.equal(routePatternToRegExp('/orders/:id').test('/orders/abc/pickup'), false);
  assert.equal(routePatternToRegExp('/a.b').test('/axb'), false);
  assert.equal(demoRouteMatcher(/^\/api\//)(at('/api/x')), true);
  assert.equal(demoRouteMatcher('/demo(.*)')(at('/demo/not-included')), true);
  assert.equal(demoRouteMatcher(() => true)(at('/anything')), true);
});
