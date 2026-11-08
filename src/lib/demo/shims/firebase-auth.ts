// Demo stand-in for 'firebase/auth' (aliased in the demo dev build only, see
// src/lib/demo/build-config.cjs). Never talks to Google.
//
// Who may be signed in comes from the swoop_demo_session cookie. Like the real
// SDK, the Firebase session is separate from Clerk's: AuthProvider bridges it
// with signInWithCustomToken('demo:<uid>'), and the bridged uid is remembered
// in localStorage. currentUser is the cookie's user once that uid is bridged,
// and null otherwise (signed out, or a different student). Email and password
// sign-in always rejects: shop owners are not part of the demo.

import { DEMO_SESSION_COOKIE, WALKTHROUGH_NAME, WALKTHROUGH_UID, decodeDemoSession, demoPersonaByUid } from '../contract.ts';
import type { DemoSession } from '../contract.ts';
import { getApp } from './firebase-app.ts';
import type { FirebaseApp } from './firebase-app.ts';

const TOKEN_PREFIX = 'demo:';
const BRIDGE_STORAGE_KEY = 'swoop_demo_firebase_uid';
/** How often listeners re-read the session cookie. */
const COOKIE_POLL_MS = 1000;

// ---------------------------------------------------------------------------
// Errors

interface AuthError extends Error {
  code: string;
}

function authError(code: string, message: string): AuthError {
  return Object.assign(new Error(message), { name: 'FirebaseError', code: `auth/${code}` });
}

function notInDemo(name: string): AuthError {
  return authError('operation-not-allowed', `Not in the demo: ${name}`);
}

// ---------------------------------------------------------------------------
// Types

export interface UserInfo {
  readonly uid: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly photoURL: string | null;
  readonly providerId: string;
}

export interface IdTokenResult {
  token: string;
  claims: Record<string, unknown>;
  authTime: string;
  issuedAtTime: string;
  expirationTime: string;
  signInProvider: string | null;
  signInSecondFactor: string | null;
}

export interface User extends UserInfo {
  readonly emailVerified: boolean;
  readonly isAnonymous: boolean;
  readonly tenantId: string | null;
  readonly providerData: UserInfo[];
  readonly metadata: { creationTime?: string; lastSignInTime?: string };
  readonly refreshToken: string;
  getIdToken(forceRefresh?: boolean): Promise<string>;
  getIdTokenResult(forceRefresh?: boolean): Promise<IdTokenResult>;
  reload(): Promise<void>;
  delete(): Promise<void>;
  toJSON(): object;
}

export interface UserCredential {
  user: User;
  providerId: string | null;
  operationType: 'signIn' | 'link' | 'reauthenticate';
}

export type NextOrObserver<T> = ((value: T) => void) | { next?: (value: T) => void; error?: (error: Error) => void; complete?: () => void };
export type Unsubscribe = () => void;

export interface Persistence {
  readonly type: 'SESSION' | 'LOCAL' | 'NONE';
}

export const browserLocalPersistence: Persistence = { type: 'LOCAL' };
export const browserSessionPersistence: Persistence = { type: 'SESSION' };
export const inMemoryPersistence: Persistence = { type: 'NONE' };
export const indexedDBLocalPersistence: Persistence = { type: 'LOCAL' };

// ---------------------------------------------------------------------------
// Session cookie and bridge state (read lazily: never at import)

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

function readSession(): DemoSession | null {
  return decodeDemoSession(readCookie(DEMO_SESSION_COOKIE));
}

let memoryBridgedUid: string | null = null;

function readBridgedUid(): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(BRIDGE_STORAGE_KEY);
  } catch {
    // Storage blocked: fall back to memory.
  }
  return memoryBridgedUid;
}

function writeBridgedUid(uid: string | null): void {
  memoryBridgedUid = uid;
  try {
    if (typeof localStorage === 'undefined') return;
    if (uid) localStorage.setItem(BRIDGE_STORAGE_KEY, uid);
    else localStorage.removeItem(BRIDGE_STORAGE_KEY);
  } catch {
    // Storage blocked: memory keeps it for this tab.
  }
}

// ---------------------------------------------------------------------------
// Users

function displayNameFor(uid: string): string | null {
  if (uid === WALKTHROUGH_UID) return WALKTHROUGH_NAME;
  return demoPersonaByUid(uid)?.name ?? null;
}

const userCache = new Map<string, User>();

function makeUser(session: DemoSession): User {
  const uid = session.uid;
  const primary = session.emails?.[0] ?? null;
  const email = primary?.address ?? null;
  const emailVerified = primary?.verified ?? false;
  const key = `${uid}|${email ?? ''}|${emailVerified}`;
  const cached = userCache.get(key);
  if (cached) return cached;

  const signedInAt = new Date().toUTCString();
  const token = `${TOKEN_PREFIX}${uid}`;
  const user: User = {
    uid,
    email,
    emailVerified,
    displayName: displayNameFor(uid),
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
    isAnonymous: false,
    tenantId: null,
    // Custom-token sessions have no sign-in providers; AuthProvider relies on that.
    providerData: [],
    metadata: { creationTime: signedInAt, lastSignInTime: signedInAt },
    refreshToken: '',
    getIdToken: async () => token,
    getIdTokenResult: async () => {
      const now = Date.now();
      return {
        token,
        claims: { sub: uid, user_id: uid, demo: true },
        authTime: new Date(now).toUTCString(),
        issuedAtTime: new Date(now).toUTCString(),
        expirationTime: new Date(now + 60 * 60 * 1000).toUTCString(),
        signInProvider: 'custom',
        signInSecondFactor: null,
      };
    },
    reload: async () => undefined,
    delete: async () => {
      throw notInDemo('User.delete');
    },
    toJSON: () => ({ uid, email, emailVerified, displayName: displayNameFor(uid), providerData: [], demo: true }),
  };
  userCache.set(key, user);
  return user;
}

function resolveCurrentUser(): User | null {
  const session = readSession();
  if (!session) return null;
  return readBridgedUid() === session.uid ? makeUser(session) : null;
}

// ---------------------------------------------------------------------------
// Listeners

interface Listener {
  next: (user: User | null) => void;
  error?: (error: Error) => void;
}

const listeners = new Set<Listener>();
let lastEmitted: User | null | undefined;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function emit(): void {
  const user = resolveCurrentUser();
  if (user === lastEmitted) return;
  lastEmitted = user;
  for (const listener of [...listeners]) {
    try {
      listener.next(user);
    } catch (error) {
      console.error('[demo] auth listener failed', error);
    }
  }
}

function startPolling(): void {
  if (pollTimer !== null || typeof window === 'undefined') return;
  pollTimer = setInterval(emit, COOKIE_POLL_MS);
}

function stopPollingIfIdle(): void {
  if (listeners.size > 0 || pollTimer === null) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function toListener(nextOrObserver: NextOrObserver<User | null>, error?: (error: Error) => void): Listener {
  if (typeof nextOrObserver === 'function') return { next: nextOrObserver, error };
  return {
    next: (user) => nextOrObserver.next?.(user),
    error: (err) => nextOrObserver.error?.(err),
  };
}

function subscribe(nextOrObserver: NextOrObserver<User | null>, error?: (error: Error) => void): Unsubscribe {
  const listener = toListener(nextOrObserver, error);
  listeners.add(listener);
  startPolling();
  // Like the SDK: the first call comes asynchronously, with the current user.
  let active = true;
  queueMicrotask(() => {
    if (!active) return;
    const user = resolveCurrentUser();
    lastEmitted = user;
    try {
      listener.next(user);
    } catch (err) {
      console.error('[demo] auth listener failed', err);
    }
  });
  return () => {
    active = false;
    listeners.delete(listener);
    stopPollingIfIdle();
  };
}

// ---------------------------------------------------------------------------
// Auth

export interface Auth {
  readonly app: FirebaseApp;
  readonly name: string;
  readonly config: Record<string, unknown>;
  readonly currentUser: User | null;
  languageCode: string | null;
  tenantId: string | null;
  readonly settings: { appVerificationDisabledForTesting: boolean };
  authStateReady(): Promise<void>;
  onAuthStateChanged(nextOrObserver: NextOrObserver<User | null>, error?: (error: Error) => void): Unsubscribe;
  onIdTokenChanged(nextOrObserver: NextOrObserver<User | null>, error?: (error: Error) => void): Unsubscribe;
  setPersistence(persistence: Persistence): Promise<void>;
  signOut(): Promise<void>;
  updateCurrentUser(user: User | null): Promise<void>;
  useDeviceLanguage(): void;
}

class DemoAuth implements Auth {
  readonly app: FirebaseApp;
  readonly name: string;
  readonly config: Record<string, unknown> = { demo: true };
  languageCode: string | null = null;
  tenantId: string | null = null;
  readonly settings = { appVerificationDisabledForTesting: false };

  constructor(app: FirebaseApp) {
    this.app = app;
    this.name = app.name;
  }

  get currentUser(): User | null {
    return resolveCurrentUser();
  }

  async authStateReady(): Promise<void> {
    // The demo session is known synchronously.
  }

  onAuthStateChanged(nextOrObserver: NextOrObserver<User | null>, error?: (error: Error) => void): Unsubscribe {
    return subscribe(nextOrObserver, error);
  }

  onIdTokenChanged(nextOrObserver: NextOrObserver<User | null>, error?: (error: Error) => void): Unsubscribe {
    return subscribe(nextOrObserver, error);
  }

  async setPersistence(): Promise<void> {
    // The demo always remembers the bridged uid in localStorage.
  }

  async signOut(): Promise<void> {
    writeBridgedUid(null);
    emit();
  }

  async updateCurrentUser(): Promise<void> {
    throw notInDemo('updateCurrentUser');
  }

  useDeviceLanguage(): void {
    this.languageCode = typeof navigator !== 'undefined' ? navigator.language : null;
  }
}

const auths = new Map<string, DemoAuth>();

/** Never throws, with or without env. */
export function getAuth(app?: FirebaseApp): Auth {
  const target = app ?? getApp();
  let auth = auths.get(target.name);
  if (!auth) {
    auth = new DemoAuth(target);
    auths.set(target.name, auth);
  }
  return auth;
}

export function initializeAuth(app: FirebaseApp): Auth {
  return getAuth(app);
}

export function onAuthStateChanged(auth: Auth, nextOrObserver: NextOrObserver<User | null>, error?: (error: Error) => void): Unsubscribe {
  return auth.onAuthStateChanged(nextOrObserver, error);
}

export function onIdTokenChanged(auth: Auth, nextOrObserver: NextOrObserver<User | null>, error?: (error: Error) => void): Unsubscribe {
  return auth.onIdTokenChanged(nextOrObserver, error);
}

/** Accepts only 'demo:<uid>' for the student signed in to the demo. */
export async function signInWithCustomToken(auth: Auth, token: string): Promise<UserCredential> {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) throw authError('invalid-custom-token', 'The demo only takes demo:<uid> tokens.');
  const uid = token.slice(TOKEN_PREFIX.length);
  const session = readSession();
  if (!session || session.uid !== uid) throw authError('invalid-custom-token', 'This token is not for the demo student signed in.');
  writeBridgedUid(uid);
  emit();
  const user = auth.currentUser;
  if (!user) throw authError('internal-error', 'Demo sign-in did not stick.');
  return { user, providerId: null, operationType: 'signIn' };
}

export async function signOut(auth: Auth): Promise<void> {
  await auth.signOut();
}

export async function setPersistence(auth: Auth, persistence: Persistence): Promise<void> {
  await auth.setPersistence(persistence);
}

export async function signInWithEmailAndPassword(_auth: Auth, _email: string, _password: string): Promise<UserCredential> {
  void _auth;
  void _email;
  void _password;
  throw notInDemo('signInWithEmailAndPassword');
}

export async function createUserWithEmailAndPassword(_auth: Auth, _email: string, _password: string): Promise<UserCredential> {
  void _auth;
  void _email;
  void _password;
  throw notInDemo('createUserWithEmailAndPassword');
}

export async function sendPasswordResetEmail(_auth: Auth, _email: string): Promise<void> {
  void _auth;
  void _email;
  throw notInDemo('sendPasswordResetEmail');
}

export async function signInWithPopup(): Promise<UserCredential> {
  throw notInDemo('signInWithPopup');
}

export async function signInWithRedirect(): Promise<never> {
  throw notInDemo('signInWithRedirect');
}

export async function signInAnonymously(): Promise<UserCredential> {
  throw notInDemo('signInAnonymously');
}

export function connectAuthEmulator(): void {
  throw notInDemo('connectAuthEmulator');
}
