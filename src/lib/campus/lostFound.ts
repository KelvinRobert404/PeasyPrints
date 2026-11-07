// Lost and found: what each viewer may see of a post, the claim question and
// the answer check. Pure and dependency free so node tests can import it.
// Only the poster sees photos, ID numbers and the private claim answer.
import type { DocTime, ListingPlace } from '@/types/campus';
import type { LostFoundCategory, LostFoundDoc, LostFoundItem } from '@/types/utilities';
import { LOST_FOUND_CATEGORY_LABELS } from './constants.ts';

/** Categories whose title is replaced with a generic one for everyone but the poster. */
export const SENSITIVE_CATEGORIES: readonly LostFoundCategory[] = ['id_card', 'wallet'];

export const LOST_FOUND_CATEGORIES: readonly LostFoundCategory[] = [
  'id_card',
  'wallet',
  'keys',
  'phone',
  'bag',
  'bottle',
  'electronics',
  'books',
  'clothing',
  'other',
];

/** Shown in place of anything scrubbed from a post. */
export const HIDDEN = '[hidden]';

export const MAX_PHOTOS = 3;
export const MAX_CLAIMS_PER_POST = 20;
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const QUESTION_MAX = 120;
export const ANSWER_MAX = 120;
export const CLAIM_MESSAGE_MAX = 200;

/* Contact the poster picks. Shown only to a claimant they approve. */

export type LostFoundContactKind = 'whatsapp' | 'phone' | 'email' | 'instagram';

export const CONTACT_KINDS: readonly LostFoundContactKind[] = ['whatsapp', 'phone', 'email', 'instagram'];

export const CONTACT_KIND_LABELS: Record<LostFoundContactKind, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  email: 'Email',
  instagram: 'Instagram',
};

export interface LostFoundContact {
  kind: LostFoundContactKind;
  value: string;
}

export type LostFoundClaimStatus = 'pending' | 'approved';

/** One 'Is it yours?' ask, stored on the post keyed by its claim id. */
export interface LostFoundClaimRecord {
  claimantId: string;
  claimantName: string;
  /** What the claimant typed. Only the poster reads it. */
  answer: string;
  /** Whether it matched the poster's private answer; null when the poster set none. */
  matches: boolean | null;
  status: LostFoundClaimStatus;
  createdAt: DocTime;
  decidedAt: DocTime | null;
}

/** Stored fields this package adds to LostFoundDoc. */
export interface LostFoundExtras {
  claimQuestion?: string | null;
  /** Private answer to the claim question. Never leaves the server except to the poster. */
  claimAnswer?: string | null;
  contact?: LostFoundContact | null;
  claims?: Record<string, LostFoundClaimRecord> | null;
}

export type LostFoundRecord = LostFoundDoc & LostFoundExtras;

/** A claim as the poster sees it. */
export interface LostFoundClaimView {
  id: string;
  claimantName: string;
  answer: string;
  matches: boolean | null;
  status: LostFoundClaimStatus;
  createdAt: string;
}

/** A post as one viewer sees it. */
export type LostFoundView = LostFoundItem & {
  /** True when anything was hidden from this viewer. */
  redacted: boolean;
  /** Photos on the post; the urls are only sent to the poster. */
  photoCount: number;
  claimQuestion: string;
  /** Poster only. */
  claimAnswer: string | null;
  /** The poster's own contact, or the revealed contact for an approved claimant. Else null. */
  contact: LostFoundContact | null;
  /** The viewer's own ask on this post. */
  myClaim: { id: string; status: LostFoundClaimStatus; createdAt: string } | null;
  /** Poster only: every ask, newest first. */
  claims: LostFoundClaimView[] | null;
};

type TimeLike = DocTime | Date | string | number | null | undefined;

function iso(value: TimeLike): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().toISOString();
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/* Scrubbing ---------------------------------------------------------------- */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
/** A name written after 'name:', 'name -' or 'name is', up to the end of the clause. */
const NAME_AFTER_LABEL = /\b(name)(\s*(?::|-|–|\bis\b)\s*)[^\n,.;:()]+/gi;
/** Register or roll numbers: letters and digits mixed, 6+ long, at least 2 of each (e.g. 23BCAA12). */
const REGISTER_NUMBER = /\b(?=(?:[a-z]*\d){2})(?=(?:\d*[a-z]){2})[a-z0-9]{6,20}\b/gi;
/** Phone numbers and any run of 6+ digits, allowing spaces, dots or dashes between them. */
const DIGIT_RUN = /\+?\d(?:[\s.-]?\d){5,}/g;

/** Removes register numbers, long digit runs, phones, emails and names after 'name:'. */
export function scrubText(text: string): string {
  if (!text) return '';
  return text
    .replace(EMAIL, HIDDEN)
    .replace(NAME_AFTER_LABEL, (_match, label: string, separator: string) => `${label}${separator}${HIDDEN}`)
    .replace(REGISTER_NUMBER, HIDDEN)
    .replace(DIGIT_RUN, HIDDEN);
}

export function isSensitiveCategory(category: LostFoundCategory): boolean {
  return SENSITIVE_CATEGORIES.includes(category);
}

/** 'ID card near Main Library', or just 'ID card' with no place. */
export function genericTitle(category: LostFoundCategory, place: Pick<ListingPlace, 'label'> | null | undefined): string {
  const label = LOST_FOUND_CATEGORY_LABELS[category] ?? 'Item';
  const where = place?.label?.trim();
  return where ? `${label} near ${where}` : label;
}

/* Claims ------------------------------------------------------------------- */

const DEFAULT_FOUND_QUESTIONS: Partial<Record<LostFoundCategory, string>> = {
  id_card: 'What name is on the card?',
  wallet: 'What is inside the wallet?',
  keys: 'What is on the keychain?',
  phone: 'What is the phone cover like?',
  bag: 'What is inside the bag?',
  bottle: 'Any sticker or mark on it?',
};

/** The question a claimant answers: the poster's own, else a default. */
export function claimQuestion(item: Pick<LostFoundRecord, 'kind' | 'category' | 'claimQuestion'>): string {
  const own = item.claimQuestion?.trim();
  if (own) return own;
  if (item.kind === 'lost') return 'Where did you find it?';
  return DEFAULT_FOUND_QUESTIONS[item.category] ?? 'Name one detail only the owner knows.';
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Case-insensitive match against the poster's private answer. False when there is none. */
export function verifyClaimAnswer(expected: string | null | undefined, given: string | null | undefined): boolean {
  const want = normalizeAnswer(expected ?? '');
  const got = normalizeAnswer(given ?? '');
  return want.length > 0 && want === got;
}

/** The viewer's own claim on a post, with its id. */
export function claimOf(item: Pick<LostFoundRecord, 'claims'>, viewerId: string): { id: string; claim: LostFoundClaimRecord } | null {
  if (!viewerId || !item.claims) return null;
  for (const [id, claim] of Object.entries(item.claims)) {
    if (claim && claim.claimantId === viewerId) return { id, claim };
  }
  return null;
}

/* Contact ------------------------------------------------------------------ */

export type ContactCheck = { ok: true; contact: LostFoundContact } | { ok: false; error: string };

/** Checks and tidies the poster's contact: 10-digit Indian mobile, email or Instagram handle. */
export function normalizeContact(kind: LostFoundContactKind, raw: string): ContactCheck {
  const value = raw.trim();
  if (kind === 'whatsapp' || kind === 'phone') {
    let digits = value.replace(/[\s().-]/g, '');
    if (digits.startsWith('+91')) digits = digits.slice(3);
    else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (!/^[6-9]\d{9}$/.test(digits)) return { ok: false, error: 'Use a 10-digit mobile number' };
    return { ok: true, contact: { kind, value: digits } };
  }
  if (kind === 'email') {
    const email = value.toLowerCase();
    if (email.length > 120 || !/^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email)) {
      return { ok: false, error: 'Use a valid email' };
    }
    return { ok: true, contact: { kind, value: email } };
  }
  const handle = value.replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) return { ok: false, error: 'Use your Instagram handle' };
  return { ok: true, contact: { kind, value: handle } };
}

/** A link that opens the contact, e.g. 'https://wa.me/919876543210'. */
export function contactHref(contact: LostFoundContact): string {
  switch (contact.kind) {
    case 'whatsapp':
      return `https://wa.me/91${contact.value}`;
    case 'phone':
      return `tel:+91${contact.value}`;
    case 'email':
      return `mailto:${contact.value}`;
    default:
      return `https://instagram.com/${contact.value}`;
  }
}

/* Redaction ---------------------------------------------------------------- */

function viewPlace(place: ListingPlace | null | undefined): LostFoundView['place'] {
  if (!place) return null;
  return {
    landmarkId: place.landmarkId,
    label: place.label,
    area: place.area,
    campusId: place.campusId,
    roughDistanceM: place.roughDistanceM,
  };
}

function claimViews(claims: LostFoundRecord['claims']): LostFoundClaimView[] {
  return Object.entries(claims ?? {})
    .filter(([, claim]) => Boolean(claim))
    .map(([id, claim]) => ({
      id,
      claimantName: claim.claimantName || 'Student',
      answer: claim.answer,
      matches: claim.matches ?? null,
      status: claim.status,
      createdAt: iso(claim.createdAt) ?? new Date(0).toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The post as `viewerId` may see it. The poster sees everything. Everyone
 * else gets no photos, scrubbed text, a generic title on ID cards and wallets,
 * and the poster's contact only once the poster approves their claim.
 */
export function redactForViewer(item: LostFoundRecord & { id: string }, viewerId: string): LostFoundView {
  const isOwner = Boolean(viewerId) && item.authorId === viewerId;
  const images = Array.isArray(item.images) ? item.images : [];
  const base = {
    id: item.id,
    campusId: item.campusId,
    kind: item.kind,
    category: item.category,
    status: item.status,
    keptAt: item.keptAt ?? null,
    place: viewPlace(item.place),
    happenedAt: iso(item.happenedAt),
    createdAt: iso(item.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(item.updatedAt) ?? new Date(0).toISOString(),
    poster: { displayName: item.posterDisplayName || 'Student', verified: true as const },
    isOwner,
    photoCount: images.length,
    claimQuestion: claimQuestion(item),
  };

  if (isOwner) {
    return {
      ...base,
      title: item.title,
      description: item.description ?? '',
      images: [...images],
      redacted: false,
      claimAnswer: item.claimAnswer ?? null,
      contact: item.contact ? { ...item.contact } : null,
      myClaim: null,
      claims: claimViews(item.claims),
    };
  }

  const title = isSensitiveCategory(item.category) ? genericTitle(item.category, item.place) : scrubText(item.title);
  const description = scrubText(item.description ?? '');
  const mine = claimOf(item, viewerId);
  const approved = mine?.claim.status === 'approved';
  return {
    ...base,
    title,
    description,
    images: [],
    redacted: title !== item.title || description !== (item.description ?? '') || images.length > 0,
    claimAnswer: null,
    contact: approved && item.contact ? { ...item.contact } : null,
    myClaim: mine ? { id: mine.id, status: mine.claim.status, createdAt: iso(mine.claim.createdAt) ?? new Date(0).toISOString() } : null,
    claims: null,
  };
}

/** Open posts first by newest. */
export function sortNewestFirst<T extends { createdAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
