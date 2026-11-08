// The demo's shared contract: cookie names, the session codec, personas,
// demo dates and the port. Pure: no window access, no Node-only APIs, so the
// proxy, route handlers, the browser, shims and node tests can all import it.

import { FIXTURE_USER_IDS } from '../firebase/fixtureMode.ts';
import type { FixtureUserId } from '../firebase/fixtureMode.ts';

// ---------------------------------------------------------------------------
// Port and cookies

export const DEMO_PORT = 3019;
export const DEMO_ORIGIN = `http://localhost:${DEMO_PORT}`;

/** Visitor id, minted by the proxy. Picks the visitor's own fake world. */
export const DEMO_VISITOR_COOKIE = 'swoop_demo_visitor';
/** Client-readable base64url JSON DemoSession. No cookie means signed out. */
export const DEMO_SESSION_COOKIE = 'swoop_demo_session';
/** 'nov' | 'may' | 'july'. No cookie means 'nov'. */
export const DEMO_DATE_COOKIE = 'swoop_demo_date';

// ---------------------------------------------------------------------------
// Session

export const DEMO_SESSION_MAX_EMAILS = 3;

export interface DemoEmail {
  address: string;
  verified: boolean;
  google: boolean;
}

export interface DemoSession {
  uid: FixtureUserId;
  emails?: DemoEmail[];
}

function isFixtureUid(value: unknown): value is FixtureUserId {
  return typeof value === 'string' && (FIXTURE_USER_IDS as readonly string[]).includes(value);
}

function toDemoEmail(value: unknown): DemoEmail | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { address, verified, google } = value as Record<string, unknown>;
  if (typeof address !== 'string' || !address.includes('@') || address.length > 254) return null;
  if (typeof verified !== 'boolean' || typeof google !== 'boolean') return null;
  return { address, verified, google };
}

/** Checks a decoded value and returns a clean DemoSession, or null if anything is off. */
export function toDemoSession(value: unknown): DemoSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!isFixtureUid(raw.uid)) return null;
  if (raw.emails === undefined) return { uid: raw.uid };
  if (!Array.isArray(raw.emails) || raw.emails.length > DEMO_SESSION_MAX_EMAILS) return null;
  const emails: DemoEmail[] = [];
  for (const entry of raw.emails) {
    const email = toDemoEmail(entry);
    if (!email) return null;
    emails.push(email);
  }
  return { uid: raw.uid, emails };
}

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(value: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Encodes a session for the swoop_demo_session cookie. Throws on an invalid session. */
export function encodeDemoSession(session: DemoSession): string {
  const clean = toDemoSession(session);
  if (!clean) throw new Error('Invalid demo session');
  return utf8ToBase64Url(JSON.stringify(clean));
}

/** Decodes the swoop_demo_session cookie. Missing or bad input gives null (signed out). */
export function decodeDemoSession(raw: string | null | undefined): DemoSession | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) return null;
  const json = base64UrlToUtf8(raw);
  if (json === null) return null;
  try {
    return toDemoSession(JSON.parse(json));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Personas

export const DEMO_EMAIL_DOMAIN = 'kju.test';

export type DemoPersonaId = 'sana' | 'kabir' | 'ananya' | 'meera';

export interface DemoPersona {
  id: DemoPersonaId;
  uid: FixtureUserId;
  name: string;
  campusLabel: string;
  /** One short plain-English line about who this student is. */
  line: string;
}

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { id: 'sana', uid: 'verified-kju-main', name: 'Sana', campusLabel: 'KJU Main', line: 'Verified student at the main campus' },
  { id: 'kabir', uid: 'verified-kju-airport', name: 'Kabir', campusLabel: 'KJU Airport Rd', line: 'Verified student at Airport Road' },
  { id: 'ananya', uid: 'girls-approved', name: 'Ananya', campusLabel: 'KJU Main', line: "Has access to the Girls' space" },
  { id: 'meera', uid: 'pending-id-card', name: 'Meera', campusLabel: 'KJU Main', line: 'ID card waiting for review' },
];

export const DEFAULT_DEMO_PERSONA_ID: DemoPersonaId = 'sana';

export function isDemoPersonaId(value: unknown): value is DemoPersonaId {
  return typeof value === 'string' && DEMO_PERSONAS.some((persona) => persona.id === value);
}

export function demoPersona(id: DemoPersonaId): DemoPersona {
  const persona = DEMO_PERSONAS.find((entry) => entry.id === id);
  if (!persona) throw new Error(`Unknown demo persona: ${id}`);
  return persona;
}

export function demoPersonaByUid(uid: string | null | undefined): DemoPersona | null {
  return DEMO_PERSONAS.find((persona) => persona.uid === uid) ?? null;
}

// ---------------------------------------------------------------------------
// New-student walk-through (Riya)

export const WALKTHROUGH_UID: FixtureUserId = 'new-user';
export const WALKTHROUGH_NAME = 'Riya';

export type WalkthroughEmailKind = 'college' | 'personal';

export const WALKTHROUGH_COLLEGE_EMAIL = `riya@${DEMO_EMAIL_DOMAIN}`;
export const WALKTHROUGH_PERSONAL_EMAIL = 'riya.t@gmail.test';

/** The emails Riya signs in with through the mocked Google step. */
export function walkthroughEmails(kind: WalkthroughEmailKind): DemoEmail[] {
  const address = kind === 'college' ? WALKTHROUGH_COLLEGE_EMAIL : WALKTHROUGH_PERSONAL_EMAIL;
  return [{ address, verified: true, google: true }];
}

// ---------------------------------------------------------------------------
// Demo date

export const DEMO_DATE_IDS = ['nov', 'may', 'july'] as const;
export type DemoDateId = (typeof DEMO_DATE_IDS)[number];
export const DEFAULT_DEMO_DATE: DemoDateId = 'nov';

export function isDemoDateId(value: unknown): value is DemoDateId {
  return typeof value === 'string' && (DEMO_DATE_IDS as readonly string[]).includes(value);
}

/** Maps a raw swoop_demo_date cookie value to a demo date, falling back to 'nov'. */
export function parseDemoDate(raw: string | null | undefined): DemoDateId {
  return isDemoDateId(raw) ? raw : DEFAULT_DEMO_DATE;
}

// ---------------------------------------------------------------------------
// Seasonal sample packs

export const SEASON_DOC_PREFIX = 'season-';

export function isSeasonDocId(id: string): boolean {
  return id.startsWith(SEASON_DOC_PREFIX);
}
