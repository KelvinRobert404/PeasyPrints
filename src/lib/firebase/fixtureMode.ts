// Offline fixture mode: the app runs against in-memory fakes instead of
// Firebase and Clerk. Dev only: it can never turn on in a production build.
// Kept free of imports so the proxy, the client and node tests can all use it.

export const FIXTURE_USER_IDS = [
  'new-user',
  'unverified-kju',
  'pending-id-card',
  'verified-kju-main',
  'verified-kju-airport',
  'girls-approved',
  'admin',
] as const;

export type FixtureUserId = (typeof FIXTURE_USER_IDS)[number];

export const DEFAULT_FIXTURE_USER_ID: FixtureUserId = 'verified-kju-main';

export const FIXTURE_USER_COOKIE = 'swoop_fixture_user';

/** Anything with a `get(name)` that returns `{ value }`: NextRequest.cookies or `await cookies()`. */
export interface FixtureCookieReader {
  get(name: string): { value: string } | undefined;
}

export function isFixtureMode(): boolean {
  // Literal process.env reads so Next can inline them into client bundles.
  // Demo mode (NEXT_PUBLIC_SWOOP_DEMO, see src/lib/demo/mode.ts) implies fixture mode.
  return (
    (process.env.NEXT_PUBLIC_SWOOP_FIXTURES === '1' || process.env.NEXT_PUBLIC_SWOOP_DEMO === '1') &&
    process.env.NODE_ENV !== 'production'
  );
}

export function isFixtureUserId(value: unknown): value is FixtureUserId {
  return typeof value === 'string' && (FIXTURE_USER_IDS as readonly string[]).includes(value);
}

/** Maps a raw cookie value to a known fixture user, falling back to the default user. */
export function parseFixtureUserId(raw: string | null | undefined): FixtureUserId {
  return isFixtureUserId(raw) ? raw : DEFAULT_FIXTURE_USER_ID;
}

function readCookieHeader(header: string, name: string): string | undefined {
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * The fixture user picked through the swoop_fixture_user cookie.
 * Server: pass the request cookies (`req.cookies` or `await cookies()`).
 * Browser: call with no argument and it reads document.cookie.
 * Unknown or missing values resolve to the default user.
 */
export function fixtureUserId(source?: FixtureCookieReader | null): FixtureUserId {
  if (source) return parseFixtureUserId(source.get(FIXTURE_USER_COOKIE)?.value);
  if (typeof document !== 'undefined') return parseFixtureUserId(readCookieHeader(document.cookie, FIXTURE_USER_COOKIE));
  return DEFAULT_FIXTURE_USER_ID;
}
