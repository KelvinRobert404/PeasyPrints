// Demo session in the browser: who the swoop_demo_session cookie says is
// signed in, and the sign-in, switch and sign-out actions. Each action calls
// /api/demo/session (which sets or clears the cookie), then does a full page
// load so every client store starts fresh. Never touches window at import.

import { useSyncExternalStore } from 'react';
import { DEMO_SESSION_COOKIE, decodeDemoSession } from '@/lib/demo/contract';
import type { DemoEmail, DemoPersonaId, DemoSession, WalkthroughEmailKind } from '@/lib/demo/contract';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';

const SESSION_API = '/api/demo/session';

// ---------------------------------------------------------------------------
// Reading the cookie

/** The raw swoop_demo_session value from a cookie string, or null. */
export function rawDemoSessionFrom(cookieString: string | null | undefined): string | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== DEMO_SESSION_COOKIE) continue;
    const value = part.slice(index + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** The raw cookie value in this browser, or null (signed out, or on the server). */
export function readRawDemoSession(): string | null {
  if (typeof document === 'undefined') return null;
  return rawDemoSessionFrom(document.cookie);
}

/** The signed-in demo session, or null when signed out. */
export function readDemoSession(): DemoSession | null {
  return decodeDemoSession(readRawDemoSession());
}

// ---------------------------------------------------------------------------
// Change notifications

const listeners = new Set<() => void>();
let detachBrowserEvents: (() => void) | null = null;

/** Tells every subscriber to read the cookie again (after a PATCH, or a reload). */
export function notifyDemoSessionChange(): void {
  for (const listener of [...listeners]) listener();
}

function attachBrowserEvents(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onChange = () => notifyDemoSessionChange();
  const onVisibility = () => {
    if (document.visibilityState === 'visible') onChange();
  };
  window.addEventListener('focus', onChange);
  document.addEventListener('visibilitychange', onVisibility);
  // Chrome's Cookie Store API reports cookie changes made by other tabs.
  const store = (window as unknown as { cookieStore?: EventTarget }).cookieStore;
  store?.addEventListener?.('change', onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    document.removeEventListener('visibilitychange', onVisibility);
    store?.removeEventListener?.('change', onChange);
  };
}

/** Calls listener whenever the session cookie may have changed. Returns an unsubscribe. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!detachBrowserEvents) detachBrowserEvents = attachBrowserEvents();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detachBrowserEvents) {
      detachBrowserEvents();
      detachBrowserEvents = null;
    }
  };
}

// ---------------------------------------------------------------------------
// React hook

export type DemoSessionState =
  | { isLoaded: false; raw: undefined; session: undefined }
  | { isLoaded: true; raw: string | null; session: DemoSession | null };

const NOT_LOADED: DemoSessionState = { isLoaded: false, raw: undefined, session: undefined };
const SIGNED_OUT: DemoSessionState = { isLoaded: true, raw: null, session: null };
let lastState: DemoSessionState = SIGNED_OUT;

/** One stable state object per cookie value, so hooks can depend on it. */
export function demoSessionState(raw: string | null | undefined): DemoSessionState {
  if (raw === undefined) return NOT_LOADED;
  if (raw === null) return SIGNED_OUT;
  if (lastState.raw !== raw) lastState = { isLoaded: true, raw, session: decodeDemoSession(raw) };
  return lastState;
}

function clientSnapshot(): string | null {
  return readRawDemoSession();
}

function serverSnapshot(): undefined {
  return undefined;
}

/**
 * The demo session as React state. Not loaded on the server and during
 * hydration, like Clerk; then the cookie's session, or null when signed out.
 */
export function useDemoSession(): DemoSessionState {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, clientSnapshot, serverSnapshot);
  return demoSessionState(raw);
}

// ---------------------------------------------------------------------------
// Session API

export type DemoSessionPayload =
  | { signedIn: false }
  | {
      signedIn: true;
      uid: string;
      name: string;
      persona: DemoPersonaId | null;
      emails: DemoEmail[];
      primaryEmail: string | null;
    };

/** A failed /api/demo/session call. `message` is plain English. */
export class DemoSessionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DemoSessionError';
    this.status = status;
  }
}

async function sessionRequest(method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<DemoSessionPayload> {
  let response: Response;
  try {
    response = await fetch(SESSION_API, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new DemoSessionError('The demo server is not answering.', 0);
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = typeof data?.error === 'string' && data.error ? data.error : 'Could not change the sample account.';
    throw new DemoSessionError(error, response.status);
  }
  return (data ?? { signedIn: false }) as DemoSessionPayload;
}

/** Full page load, so every client store starts again for the new account. */
function go(target: string): void {
  window.location.assign(target);
}

function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${DEMO_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Signs in as a sample student, then loads `next` (a same-origin path; default '/'). */
export async function signInAs(personaId: DemoPersonaId, next?: string | null): Promise<void> {
  await sessionRequest('POST', { persona: personaId });
  go(safeRedirectPath(next));
}

/**
 * The mocked Google step: signs in as Riya with her college or personal account,
 * then goes through /sso-callback ("Signing you in") to `next`.
 */
export async function signInWithGoogle(kind: WalkthroughEmailKind, next?: string | null): Promise<void> {
  await sessionRequest('POST', { google: kind });
  go(next ? `/sso-callback?demo_next=${encodeURIComponent(safeRedirectPath(next))}` : '/sso-callback');
}

/** The email-code sign-in: Riya with this email (any 6 digits work), then `next`. */
export async function signInWithEmailCode(email: string, next?: string | null): Promise<void> {
  await sessionRequest('POST', { emailCode: { email } });
  go(safeRedirectPath(next));
}

/**
 * Signs out, then loads `next` (default '/'). Pass null to stay on the page;
 * subscribers still hear the change. Never fails: if the server can't be
 * reached, the readable cookie is cleared here instead.
 */
export async function signOut(next: string | null = '/'): Promise<void> {
  try {
    await sessionRequest('DELETE');
  } catch {
    clearSessionCookie();
  }
  if (next === null) {
    notifyDemoSessionChange();
    return;
  }
  go(safeRedirectPath(next));
}

/** Adds a code-checked email to the signed-in account. No page load. */
export async function addDemoEmail(address: string): Promise<DemoSessionPayload> {
  const payload = await sessionRequest('PATCH', { addEmail: address });
  notifyDemoSessionChange();
  return payload;
}

/** The current path with its query, for "come back here" links. */
export function currentDemoPath(): string {
  if (typeof window === 'undefined') return '/';
  return safeRedirectPath(`${window.location.pathname}${window.location.search}`);
}
