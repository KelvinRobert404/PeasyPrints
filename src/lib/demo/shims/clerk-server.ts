// Demo stand-in for @clerk/nextjs/server. Only the demo dev build aliases it in
// (src/lib/demo/build-config.cjs). Who is signed in comes from the
// swoop_demo_session cookie; nothing here calls Clerk. Never touches window.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import type { FixtureCookieReader } from '../../firebase/fixtureMode.ts';
import { isFixtureUserId } from '../../firebase/fixtureMode.ts';
import type { DemoSession } from '../contract.ts';
import {
  demoAuthFields,
  demoClerkUser,
  demoRouteMatcher,
  readDemoSession,
  type DemoAuthObject,
  type DemoClerkUser,
  type DemoRouteInput,
} from '../server/identity.ts';

function notInDemo(name: string): never {
  throw new Error(`Not in the demo: ${name}`);
}

const SIGN_IN_PATH = '/login';

function signInUrl(returnBackUrl?: string | URL | null): string {
  if (!returnBackUrl) return SIGN_IN_PATH;
  const raw = String(returnBackUrl);
  let target = raw;
  try {
    const parsed = new URL(raw, 'http://localhost');
    target = `${parsed.pathname}${parsed.search}`;
  } catch {
    target = '/';
  }
  return `${SIGN_IN_PATH}?redirect_url=${encodeURIComponent(target)}`;
}

/** Thrown inside clerkMiddleware to ask the wrapper for a sign-in redirect. */
class DemoSignInRedirect extends Error {
  url: string;

  constructor(url: string) {
    super('Demo sign-in redirect');
    this.url = url;
  }
}

export type DemoAuth = DemoAuthObject & {
  protect: () => Promise<DemoAuthObject>;
  redirectToSignIn: (options?: { returnBackUrl?: string | URL | null }) => never;
  redirectToSignUp: (options?: { returnBackUrl?: string | URL | null }) => never;
};

function buildAuth(session: DemoSession | null, goTo: (url: string) => never): DemoAuth {
  const fields = demoAuthFields(session);
  const redirectToSignIn = (options?: { returnBackUrl?: string | URL | null }) => goTo(signInUrl(options?.returnBackUrl));
  return {
    ...fields,
    redirectToSignIn,
    redirectToSignUp: redirectToSignIn,
    protect: async () => {
      if (!fields.userId) redirectToSignIn();
      return fields;
    },
  };
}

async function requestCookies(): Promise<FixtureCookieReader> {
  return cookies();
}

async function requestSession(): Promise<DemoSession | null> {
  return readDemoSession(await requestCookies());
}

/** auth(): who the demo session cookie says is signed in. */
async function authImpl(): Promise<DemoAuth> {
  return buildAuth(await requestSession(), (url) => redirect(url));
}

export const auth = Object.assign(authImpl, {
  protect: async () => (await authImpl()).protect(),
});

/** currentUser(): a Clerk-shaped user for the demo session, or null when signed out. */
export async function currentUser(): Promise<DemoClerkUser | null> {
  const session = await requestSession();
  return session ? demoClerkUser(session) : null;
}

// ---------------------------------------------------------------------------
// clerkClient()

/** Unknown properties throw 'Not in the demo: <name>'. 'then' stays undefined so awaiting works. */
function guarded<T extends object>(target: T, name: string): T {
  return new Proxy(target, {
    get(object, key, receiver) {
      if (typeof key === 'symbol' || key === 'then' || key in object) return Reflect.get(object, key, receiver);
      return () => notInDemo(`${name}.${key}`);
    },
  });
}

async function userFor(userId: string): Promise<DemoClerkUser> {
  if (!isFixtureUserId(userId)) notInDemo(`clerkClient().users.getUser(${userId})`);
  let session: DemoSession | null = null;
  try {
    session = await requestSession();
  } catch {
    session = null;
  }
  // The caller's own emails live in their cookie; anyone else gets their base identity.
  return demoClerkUser(session?.uid === userId ? session : { uid: userId });
}

const demoUsers = guarded(
  {
    getUser: (userId: string) => userFor(userId),
    getUserList: async () => ({ data: [] as DemoClerkUser[], totalCount: 0 }),
    getCount: async () => 0,
    // Writes are no-ops in the demo: the cookie is the account.
    updateUser: (userId: string) => userFor(userId),
    updateUserMetadata: (userId: string) => userFor(userId),
    lockUser: (userId: string) => userFor(userId),
    unlockUser: (userId: string) => userFor(userId),
    banUser: (userId: string) => userFor(userId),
    unbanUser: (userId: string) => userFor(userId),
    deleteUser: (userId: string) => userFor(userId),
  },
  'clerkClient().users',
);

const demoClient = guarded({ users: demoUsers }, 'clerkClient()');

export async function clerkClient() {
  return demoClient;
}

// ---------------------------------------------------------------------------
// clerkMiddleware() and createRouteMatcher()

type DemoMiddlewareAuth = (() => Promise<DemoAuth>) & { protect: () => Promise<DemoAuthObject> };
type DemoMiddlewareHandler = (
  auth: DemoMiddlewareAuth,
  req: NextRequest,
  event: NextFetchEvent,
) => Response | NextResponse | void | null | undefined | Promise<Response | NextResponse | void | null | undefined>;

/** Runs the handler with an auth that reads req.cookies. No handler lets the request through. */
export function clerkMiddleware(handler?: DemoMiddlewareHandler | Record<string, unknown>, _options?: unknown) {
  return async (req: NextRequest, event: NextFetchEvent): Promise<Response> => {
    if (typeof handler !== 'function') return NextResponse.next();
    const throwRedirect = (url: string): never => {
      throw new DemoSignInRedirect(url);
    };
    const authFor = async () => buildAuth(readDemoSession(req.cookies), throwRedirect);
    const middlewareAuth = Object.assign(authFor, { protect: async () => (await authFor()).protect() });
    try {
      const response = await handler(middlewareAuth, req, event);
      return response ?? NextResponse.next();
    } catch (error) {
      if (error instanceof DemoSignInRedirect) return NextResponse.redirect(new URL(error.url, req.url));
      throw error;
    }
  };
}

export function createRouteMatcher(routes: DemoRouteInput) {
  return demoRouteMatcher(routes) as (req: NextRequest) => boolean;
}

/** getAuth(req): the same auth, read from a request's cookies. */
export function getAuth(req: NextRequest): DemoAuthObject {
  return demoAuthFields(readDemoSession(req.cookies));
}

export function buildClerkProps() {
  return {};
}

export function verifyToken(): never {
  return notInDemo('verifyToken');
}

export function createClerkClient(): never {
  return notInDemo('createClerkClient');
}
