'use client';

// Demo stand-in for @clerk/nextjs (client). Only the demo dev build aliases it in
// (src/lib/demo/build-config.cjs). Who is signed in comes from the readable
// swoop_demo_session cookie; nothing here calls Clerk or any other host.
// Exports every name the repo imports from @clerk/nextjs. Never touches window at import.

import { useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { DemoSession } from '../contract.ts';
import { demoAuthFields, demoClerkUser, normaliseDemoEmail, type DemoClerkEmailAddress, type DemoClerkUser } from '../server/identity.ts';
import {
  DemoSessionError,
  addDemoEmail,
  currentDemoPath,
  demoSessionState,
  notifyDemoSessionChange,
  readRawDemoSession,
  signOut as signOutDemo,
  subscribe,
  useDemoSession,
  type DemoSessionState,
} from '../client/session.ts';
import { DemoClerkError } from './clerk-errors.ts';
import { DemoAccountChooserHost } from '../../../components/demo/auth/DemoAccountChooser.tsx';
import { DemoUserMenu } from '../../../components/demo/DemoUserMenu.tsx';
import { safeRedirectPath } from '../../utils/safeRedirect.ts';

function notInDemo(name: string): never {
  throw new Error(`Not in the demo: ${name}`);
}

const SIGN_IN_PATH = '/login';
const VERIFY_PATH = '/campus/verify';
const CALLBACK_DELAY_MS = 600;

// ---------------------------------------------------------------------------
// Provider and visibility helpers

/** Stands in for Clerk's provider. Mounts the demo account chooser once. */
export function ClerkProvider({ children }: { children?: ReactNode; [prop: string]: unknown }) {
  return (
    <>
      {children}
      <DemoAccountChooserHost />
    </>
  );
}

export function SignedIn({ children }: { children?: ReactNode }) {
  const state = useDemoSession();
  return state.isLoaded && state.session ? <>{children}</> : null;
}

export function SignedOut({ children }: { children?: ReactNode }) {
  const state = useDemoSession();
  return state.isLoaded && !state.session ? <>{children}</> : null;
}

/** The account button in the navbar: the demo avatar menu, or a Sign in link. */
export function UserButton({ afterSignOutUrl }: { afterSignOutUrl?: string; [prop: string]: unknown }) {
  return <DemoUserMenu afterSignOutUrl={afterSignOutUrl ?? '/'} />;
}

// ---------------------------------------------------------------------------
// Sign out and sign in

type SignOutOptions = { redirectUrl?: string | null; sessionId?: string };

/**
 * Clerk's signOut(options) or signOut(callback, options). With a callback the
 * page stays put and the callback runs; otherwise it loads redirectUrl or '/'.
 */
async function clerkSignOut(first?: unknown, second?: unknown): Promise<void> {
  const callback = typeof first === 'function' ? (first as () => unknown) : null;
  const options = ((typeof first === 'object' && first) || (typeof second === 'object' && second) || {}) as SignOutOptions;
  if (callback) {
    await signOutDemo(null);
    await callback();
    return;
  }
  await signOutDemo(options.redirectUrl ?? '/');
}

function signInPath(): string {
  const back = currentDemoPath();
  return back === '/' || back.startsWith(SIGN_IN_PATH) ? SIGN_IN_PATH : `${SIGN_IN_PATH}?redirect_url=${encodeURIComponent(back)}`;
}

function openSignIn(): void {
  window.location.assign(signInPath());
}

// ---------------------------------------------------------------------------
// Clerk-shaped user

type VerificationStatus = 'verified' | 'unverified';

export interface DemoEmailAddressResource extends Omit<DemoClerkEmailAddress, 'verification'> {
  verification: { status: VerificationStatus; strategy: 'from_oauth_google' | 'email_code' };
  prepareVerification: (params?: unknown) => Promise<DemoEmailAddressResource>;
  attemptVerification: (params: { code: string }) => Promise<DemoEmailAddressResource>;
  destroy: () => Promise<void>;
  toString: () => string;
}

export interface DemoClientUser
  extends Omit<DemoClerkUser, 'emailAddresses' | 'primaryEmailAddress' | 'createdAt' | 'updatedAt' | 'lastSignInAt'> {
  emailAddresses: DemoEmailAddressResource[];
  primaryEmailAddress: DemoEmailAddressResource | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt: Date | null;
  createEmailAddress: (params: { email: string }) => Promise<DemoEmailAddressResource>;
  reload: () => Promise<DemoClientUser>;
  update: (params?: unknown) => Promise<never>;
  delete: () => Promise<never>;
  setProfileImage: (params?: unknown) => Promise<never>;
  getSessions: () => Promise<never>;
}

const CODE_PATTERN = /^\d{6}$/;

/** Turns a failed PATCH /api/demo/session into the Clerk-shaped error the screens map. */
function toClerkError(error: unknown): unknown {
  if (!(error instanceof DemoSessionError)) return error;
  if (error.status === 400) return new DemoClerkError('form_param_format_invalid', error.message, 422);
  if (error.status === 401) return new DemoClerkError('session_reverification_required', error.message, 403);
  if (error.status === 409) return new DemoClerkError('demo_email_limit', error.message, 422);
  return error;
}

function emailResource(base: Omit<DemoEmailAddressResource, 'prepareVerification' | 'attemptVerification' | 'destroy' | 'toString'>): DemoEmailAddressResource {
  const resource: DemoEmailAddressResource = {
    ...base,
    // The demo sends no email: any 6 digits verify it.
    prepareVerification: async () => resource,
    attemptVerification: async (params) => {
      const code = String(params?.code ?? '').replace(/\s/g, '');
      if (!CODE_PATTERN.test(code)) throw new DemoClerkError('form_code_incorrect', 'Enter any 6 digits.', 422);
      if (resource.verification.status !== 'verified') {
        try {
          await addDemoEmail(resource.emailAddress);
        } catch (error) {
          throw toClerkError(error);
        }
      }
      return emailResource({ ...base, verification: { status: 'verified', strategy: base.verification.strategy } });
    },
    destroy: async () => notInDemo('emailAddress.destroy'),
    toString: () => base.emailAddress,
  };
  return resource;
}

let newEmailCount = 0;

function buildUser(session: DemoSession): DemoClientUser {
  const base = demoClerkUser(session);
  const emailAddresses = base.emailAddresses.map((email) => emailResource({ ...email }));
  const user: DemoClientUser = {
    ...base,
    emailAddresses,
    primaryEmailAddress: emailAddresses.find((email) => email.id === base.primaryEmailAddressId) ?? null,
    createdAt: new Date(base.createdAt),
    updatedAt: new Date(base.updatedAt),
    lastSignInAt: base.lastSignInAt === null ? null : new Date(base.lastSignInAt),
    createEmailAddress: async (params) => {
      const address = normaliseDemoEmail(params?.email);
      if (!address) throw new DemoClerkError('form_param_format_invalid', 'That email does not look right.', 422);
      const existing = emailAddresses.find((email) => email.emailAddress.toLowerCase() === address);
      if (existing?.verification.status === 'verified') {
        throw new DemoClerkError('form_identifier_exists', 'That email is already on this account.', 422);
      }
      newEmailCount += 1;
      return emailResource({
        id: `idn_demo_new_${newEmailCount}`,
        emailAddress: address,
        verification: { status: 'unverified', strategy: 'email_code' },
        linkedTo: [],
      });
    },
    reload: async () => {
      notifyDemoSessionChange();
      return userForState(demoSessionState(readRawDemoSession())) ?? user;
    },
    update: async () => notInDemo('user.update'),
    delete: async () => notInDemo('user.delete'),
    setProfileImage: async () => notInDemo('user.setProfileImage'),
    getSessions: async () => notInDemo('user.getSessions'),
  };
  return user;
}

// One user object per cookie value, so effects that depend on `user` stay quiet.
let cachedRaw: string | null = null;
let cachedUser: DemoClientUser | null = null;

function userForState(state: DemoSessionState): DemoClientUser | null {
  if (!state.isLoaded || !state.session || !state.raw) return null;
  if (cachedRaw !== state.raw || !cachedUser) {
    cachedUser = buildUser(state.session);
    cachedRaw = state.raw;
  }
  return cachedUser;
}

// ---------------------------------------------------------------------------
// Hooks

export function useUser() {
  const state = useDemoSession();
  return useMemo(() => {
    if (!state.isLoaded) return { isLoaded: false as const, isSignedIn: undefined, user: undefined };
    const user = userForState(state);
    return user
      ? { isLoaded: true as const, isSignedIn: true as const, user }
      : { isLoaded: true as const, isSignedIn: false as const, user: null };
  }, [state]);
}

export function useAuth() {
  const state = useDemoSession();
  return useMemo(() => {
    const fields = demoAuthFields(state.isLoaded ? state.session : null);
    const shared = {
      actor: null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      has: fields.has,
      getToken: fields.getToken,
      signOut: clerkSignOut,
    };
    if (!state.isLoaded) {
      return { ...shared, isLoaded: false as const, isSignedIn: undefined, userId: undefined, sessionId: undefined, sessionClaims: undefined };
    }
    return {
      ...shared,
      isLoaded: true as const,
      isSignedIn: Boolean(fields.userId),
      userId: fields.userId,
      sessionId: fields.sessionId,
      sessionClaims: fields.sessionClaims,
    };
  }, [state]);
}

function currentState(): DemoSessionState {
  return demoSessionState(typeof document === 'undefined' ? undefined : readRawDemoSession());
}

/** One object for the whole tab, like Clerk's. Reads the cookie on access. */
const clerk = {
  get loaded() {
    return currentState().isLoaded;
  },
  get user() {
    return userForState(currentState());
  },
  get session() {
    const state = currentState();
    const fields = demoAuthFields(state.isLoaded ? state.session : null);
    return fields.sessionId ? { id: fields.sessionId, status: 'active', user: userForState(state), getToken: fields.getToken } : null;
  },
  signOut: clerkSignOut,
  openSignIn,
  openSignUp: openSignIn,
  redirectToSignIn: async () => openSignIn(),
  redirectToSignUp: async () => openSignIn(),
  openUserProfile: () => window.location.assign('/profile'),
  redirectToUserProfile: async () => window.location.assign('/profile'),
  setActive: async (_params?: unknown): Promise<never> => notInDemo('clerk.setActive'),
  addListener: (listener: (resources: { user: DemoClientUser | null }) => void) =>
    subscribe(() => listener({ user: userForState(currentState()) })),
};

export function useClerk() {
  return clerk;
}

/** Sign-in and sign-up resources: every method throws. The demo /login uses its own hook. */
function throwingResource(name: string): Record<string, never> {
  return new Proxy({} as Record<string, never>, {
    get(_target, prop) {
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
      return () => notInDemo(`${name}.${prop}`);
    },
  });
}

const signInResource = throwingResource('signIn');
const signUpResource = throwingResource('signUp');
const setActive = async (_params?: unknown): Promise<never> => notInDemo('setActive');

export function useSignIn() {
  return { isLoaded: true as const, signIn: signInResource, setActive };
}

export function useSignUp() {
  return { isLoaded: true as const, signUp: signUpResource, setActive };
}

// ---------------------------------------------------------------------------
// /sso-callback

/**
 * Finishes the mocked Google step: after a short "Signing you in", replaces the
 * page with ?demo_next (or /campus/verify). Signed out, it goes to sign-in.
 */
export function AuthenticateWithRedirectCallback(props: {
  signInUrl?: string;
  signInFallbackRedirectUrl?: string | null;
  signUpFallbackRedirectUrl?: string | null;
  [prop: string]: unknown;
}) {
  const router = useRouter();
  const state = useDemoSession();
  const signInUrl = props.signInUrl;
  const fallback = props.signInFallbackRedirectUrl ?? props.signUpFallbackRedirectUrl;

  useEffect(() => {
    if (!state.isLoaded) return;
    const timer = window.setTimeout(() => {
      if (!state.session) {
        router.replace(safeRedirectPath(signInUrl, SIGN_IN_PATH));
        return;
      }
      const demoNext = new URLSearchParams(window.location.search).get('demo_next');
      const target = demoNext ? safeRedirectPath(demoNext, VERIFY_PATH) : safeRedirectPath(fallback, VERIFY_PATH);
      router.replace(target);
    }, CALLBACK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, router, signInUrl, fallback]);

  return null;
}
