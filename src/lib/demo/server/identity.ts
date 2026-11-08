// Demo identity: who the swoop_demo_session cookie says is signed in, as the
// Clerk stand-in (src/lib/demo/shims/clerk-server.ts) and the session API need it.
// Pure: no Next, no Firebase, no window. Node tests import it, so runtime
// imports stay relative with the .ts extension.

import type { IdentityEmail } from '@/lib/campus/membership';
import { fixtureIdentity } from '../../campus/membership.ts';
import type { FixtureCookieReader, FixtureUserId } from '../../firebase/fixtureMode.ts';
import { isFixtureUserId } from '../../firebase/fixtureMode.ts';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_MAX_EMAILS,
  WALKTHROUGH_UID,
  decodeDemoSession,
  demoPersona,
  demoPersonaByUid,
  isDemoPersonaId,
  walkthroughEmails,
} from '../contract.ts';
import type { DemoEmail, DemoPersona, DemoSession } from '../contract.ts';

// ---------------------------------------------------------------------------
// Session cookie

/** The signed-in demo session, or null (signed out). Pass `await cookies()` or `req.cookies`. */
export function readDemoSession(source: FixtureCookieReader | null | undefined): DemoSession | null {
  if (!source) return null;
  return decodeDemoSession(source.get(DEMO_SESSION_COOKIE)?.value);
}

// ---------------------------------------------------------------------------
// Identity

/**
 * The personas' own sign-in emails. They match the seeded users docs
 * (src/lib/campus/fixtures/print.ts), so the profile and /api/users/upsert agree.
 * Meera's is a personal address, so the college-domain check never approves her.
 */
const PERSONA_EMAILS: Partial<Record<FixtureUserId, DemoEmail>> = {
  'verified-kju-main': { address: `sana@${DEMO_EMAIL_DOMAIN}`, verified: true, google: false },
  'verified-kju-airport': { address: `kabir@${DEMO_EMAIL_DOMAIN}`, verified: true, google: true },
  'girls-approved': { address: `ananya@${DEMO_EMAIL_DOMAIN}`, verified: true, google: true },
  'pending-id-card': { address: 'meera.k@gmail.test', verified: true, google: true },
};

export interface DemoIdentity {
  userId: FixtureUserId;
  displayName: string;
  /** Every email on the account, the sign-in one first. */
  emails: IdentityEmail[];
  /** The first verified email, or null. */
  primaryEmail: string | null;
  admin: boolean;
  persona: DemoPersona | null;
}

function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Base emails for a uid before anything the cookie adds. */
export function demoBaseEmails(uid: FixtureUserId): IdentityEmail[] {
  const own = PERSONA_EMAILS[uid];
  if (own) return [{ ...own }];
  return fixtureIdentity(uid).emails.map((email) => ({ ...email }));
}

/**
 * The emails on a session. Riya (the walk-through user) signs in with the
 * emails in her cookie; a persona keeps her own email, plus any the cookie adds.
 */
export function demoSessionEmails(session: DemoSession): IdentityEmail[] {
  const extra = (session.emails ?? []).map((email) => ({ ...email }));
  const base = session.uid === WALKTHROUGH_UID && extra.length ? [] : demoBaseEmails(session.uid);
  const out: IdentityEmail[] = [...base];
  for (const email of extra) {
    const index = out.findIndex((item) => sameAddress(item.address, email.address));
    if (index < 0) out.push(email);
    else out[index] = { address: out[index].address, verified: out[index].verified || email.verified, google: out[index].google || email.google };
  }
  return out;
}

export function demoIdentity(session: DemoSession): DemoIdentity {
  const fixture = fixtureIdentity(session.uid);
  const emails = demoSessionEmails(session);
  return {
    userId: session.uid,
    displayName: fixture.displayName,
    emails,
    primaryEmail: emails.find((email) => email.verified)?.address ?? null,
    admin: fixture.admin,
    persona: demoPersonaByUid(session.uid),
  };
}

// ---------------------------------------------------------------------------
// Clerk-shaped user, enough for currentUser() and clerkClient().users.getUser()

export interface DemoClerkEmailAddress {
  id: string;
  emailAddress: string;
  verification: { status: 'verified' | 'unverified'; strategy: 'from_oauth_google' | 'email_code' };
  linkedTo: Array<{ type: 'oauth_google'; id: string }>;
}

export interface DemoClerkUser {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  username: string | null;
  imageUrl: string;
  hasImage: boolean;
  primaryEmailAddressId: string | null;
  primaryEmailAddress: DemoClerkEmailAddress | null;
  emailAddresses: DemoClerkEmailAddress[];
  primaryPhoneNumberId: string | null;
  primaryPhoneNumber: null;
  phoneNumbers: Array<{ id: string; phoneNumber: string }>;
  externalAccounts: Array<{ id: string; provider: 'oauth_google'; emailAddress: string }>;
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
  unsafeMetadata: Record<string, unknown>;
  passwordEnabled: boolean;
  twoFactorEnabled: boolean;
  banned: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
  lastSignInAt: number | null;
}

/** A Clerk-shaped user for a demo session. Google emails carry a Google account. */
export function demoClerkUser(session: DemoSession, now: Date = new Date()): DemoClerkUser {
  const identity = demoIdentity(session);
  const emailAddresses: DemoClerkEmailAddress[] = identity.emails.map((email, index) => ({
    id: `idn_demo_${identity.userId}_${index}`,
    emailAddress: email.address,
    verification: { status: email.verified ? 'verified' : 'unverified', strategy: email.google ? 'from_oauth_google' : 'email_code' },
    linkedTo: email.google ? [{ type: 'oauth_google', id: `idn_demo_google_${identity.userId}_${index}` }] : [],
  }));
  const primary = emailAddresses[0] ?? null;
  const at = now.getTime();
  return {
    id: identity.userId,
    firstName: identity.displayName,
    lastName: null,
    fullName: identity.displayName,
    username: null,
    imageUrl: '',
    hasImage: false,
    primaryEmailAddressId: primary?.id ?? null,
    primaryEmailAddress: primary,
    emailAddresses,
    primaryPhoneNumberId: null,
    primaryPhoneNumber: null,
    phoneNumbers: [],
    externalAccounts: emailAddresses
      .filter((email) => email.linkedTo.length > 0)
      .map((email) => ({ id: email.linkedTo[0].id, provider: 'oauth_google', emailAddress: email.emailAddress })),
    publicMetadata: { demo: true },
    privateMetadata: {},
    unsafeMetadata: {},
    passwordEnabled: false,
    twoFactorEnabled: false,
    banned: false,
    locked: false,
    createdAt: at,
    updatedAt: at,
    lastSignInAt: at,
  };
}

// ---------------------------------------------------------------------------
// Tokens

const DEMO_TOKEN_PREFIX = 'demo:';

/** The demo's stand-in for a Firebase custom or ID token. */
export function demoTokenFor(uid: string): string {
  return `${DEMO_TOKEN_PREFIX}${uid}`;
}

/** The uid in a 'demo:<uid>' bearer token, or null for anything else. */
export function demoTokenUid(token: string | null | undefined): FixtureUserId | null {
  if (typeof token !== 'string' || !token.startsWith(DEMO_TOKEN_PREFIX)) return null;
  const uid = token.slice(DEMO_TOKEN_PREFIX.length);
  return isFixtureUserId(uid) ? uid : null;
}

// ---------------------------------------------------------------------------
// Session API (/api/demo/session)

export type DemoSessionAction =
  | { kind: 'persona'; session: DemoSession }
  | { kind: 'walkthrough'; session: DemoSession };

export type DemoSessionResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, lower-cased address, or null if it is not an email. */
export function normaliseDemoEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const address = value.trim().toLowerCase();
  if (address.length > 254 || !EMAIL_PATTERN.test(address)) return null;
  return address;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Reads a POST body: {persona}, {google:'college'|'personal'} or {emailCode:{email}}.
 * Walk-through sign-ins are Riya (uid new-user).
 */
export function parseSessionPost(body: unknown): DemoSessionResult<DemoSessionAction> {
  const raw = record(body);
  if (!raw) return { ok: false, status: 400, error: 'Pick a sample student' };
  if (raw.persona !== undefined) {
    if (!isDemoPersonaId(raw.persona)) return { ok: false, status: 400, error: 'Unknown sample student' };
    return { ok: true, value: { kind: 'persona', session: { uid: demoPersona(raw.persona).uid } } };
  }
  if (raw.google !== undefined) {
    if (raw.google !== 'college' && raw.google !== 'personal') return { ok: false, status: 400, error: 'Pick a college or personal account' };
    return { ok: true, value: { kind: 'walkthrough', session: { uid: WALKTHROUGH_UID, emails: walkthroughEmails(raw.google) } } };
  }
  if (raw.emailCode !== undefined) {
    const address = normaliseDemoEmail(record(raw.emailCode)?.email);
    if (!address) return { ok: false, status: 400, error: 'Enter a valid email' };
    return { ok: true, value: { kind: 'walkthrough', session: { uid: WALKTHROUGH_UID, emails: [{ address, verified: true, google: false }] } } };
  }
  return { ok: false, status: 400, error: 'Pick a sample student' };
}

/**
 * Adds a code-verified email to the session (any 6 digits work in the demo).
 * An address already on the account is marked verified instead.
 */
export function addDemoEmail(session: DemoSession, value: unknown): DemoSessionResult<DemoSession> {
  const address = normaliseDemoEmail(value);
  if (!address) return { ok: false, status: 400, error: 'Enter a valid email' };
  // Riya's cookie holds all her emails, so start it from her base ones if empty.
  const start = session.emails?.length ? session.emails : session.uid === WALKTHROUGH_UID ? demoBaseEmails(session.uid) : [];
  const emails = start.map((email) => ({ ...email }));
  const existing = emails.find((email) => sameAddress(email.address, address));
  if (existing) {
    existing.verified = true;
    return { ok: true, value: { uid: session.uid, emails } };
  }
  if (demoSessionEmails(session).some((email) => email.verified && sameAddress(email.address, address))) {
    return { ok: true, value: { uid: session.uid, emails } };
  }
  if (emails.length >= DEMO_SESSION_MAX_EMAILS) return { ok: false, status: 409, error: 'This account has enough emails' };
  emails.push({ address, verified: true, google: false });
  return { ok: true, value: { uid: session.uid, emails } };
}

/** What the session API sends back. */
export function demoSessionPayload(session: DemoSession | null) {
  if (!session) return { signedIn: false as const };
  const identity = demoIdentity(session);
  return {
    signedIn: true as const,
    uid: identity.userId,
    name: identity.displayName,
    persona: identity.persona?.id ?? null,
    emails: identity.emails,
    primaryEmail: identity.primaryEmail,
  };
}

// ---------------------------------------------------------------------------
// Clerk auth object and route matcher, for the server stand-in

export interface DemoAuthObject {
  userId: string | null;
  sessionId: string | null;
  sessionClaims: { sub: string; sid: string; demo: true } | null;
  actor: null;
  orgId: null;
  orgRole: null;
  orgSlug: null;
  orgPermissions: null;
  getToken: (options?: unknown) => Promise<string | null>;
  has: (params?: unknown) => boolean;
  debug: () => Record<string, unknown>;
}

/** The Clerk auth fields for a session (signed out when null). */
export function demoAuthFields(session: DemoSession | null): DemoAuthObject {
  const userId = session?.uid ?? null;
  const sessionId = userId ? `sess_demo_${userId}` : null;
  return {
    userId,
    sessionId,
    sessionClaims: userId && sessionId ? { sub: userId, sid: sessionId, demo: true } : null,
    actor: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    orgPermissions: null,
    getToken: async () => (userId ? demoTokenFor(userId) : null),
    has: () => false,
    debug: () => ({ demo: true, userId }),
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Turns a Clerk route string into an anchored RegExp. Supports the forms the
 * repo uses: literal paths, '(.*)' groups and ':param' segments.
 */
export function routePatternToRegExp(pattern: string): RegExp {
  let source = '';
  let index = 0;
  while (index < pattern.length) {
    if (pattern.startsWith('(.*)', index)) {
      source += '(.*)';
      index += 4;
      continue;
    }
    const param = /^:[A-Za-z_][A-Za-z0-9_]*/.exec(pattern.slice(index));
    if (param) {
      source += '([^/]+)';
      index += param[0].length;
      continue;
    }
    source += escapeRegExp(pattern[index]);
    index += 1;
  }
  return new RegExp(`^${source}$`);
}

export type DemoRouteInput = string | RegExp | ReadonlyArray<string | RegExp> | ((req: unknown) => boolean);

function pathnameOf(req: unknown): string {
  const raw = record(req);
  const nextUrl = record(raw?.nextUrl);
  if (typeof nextUrl?.pathname === 'string') return nextUrl.pathname;
  if (typeof raw?.url === 'string') {
    try {
      return new URL(raw.url, 'http://localhost').pathname;
    } catch {
      return '/';
    }
  }
  return '/';
}

/** Like Clerk's createRouteMatcher: true when the request path matches any route. */
export function demoRouteMatcher(routes: DemoRouteInput): (req: unknown) => boolean {
  if (typeof routes === 'function') return (req) => Boolean(routes(req));
  const list = (Array.isArray(routes) ? routes : [routes]) as Array<string | RegExp>;
  const patterns = list.map((route) => (typeof route === 'string' ? routePatternToRegExp(route) : route));
  return (req) => {
    const pathname = pathnameOf(req);
    return patterns.some((pattern) => pattern.test(pathname));
  };
}
