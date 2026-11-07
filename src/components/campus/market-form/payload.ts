// New listing form v2: form state -> market create payload. Pure module, no
// React, so node tests can load it. Runtime imports are relative with the .ts
// extension; '@/...' only as `import type`.

import type { CampusAudience, GenderPref } from '@/types/campus';
import type { ItemCondition, MarketCategory, MarketKind, PriceTerms } from '@/types/market';
import { marketCreateSchema, type MarketCreate } from '../../../lib/campus/marketSchema.ts';
import { MARKET_KINDS, MAX_BUNDLE_ITEMS, MAX_BUNDLE_PHOTOS, MAX_LISTING_PHOTOS } from '../../../lib/campus/market.ts';
import { parsePriceInput } from '../../../lib/format/price.ts';
import { askText } from '../../../lib/search/campusSearch.ts';

/** Kinds this form can build today. Seats, cabs, tickets, passes and vehicles come later. */
export const FORM_KINDS = ['item', 'wanted', 'bundle'] as const satisfies readonly MarketKind[];
export type FormKind = (typeof FORM_KINDS)[number];

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 1000;
export const HAND_OVER_MAX = 80;
export const BUNDLE_PART_TITLE_MAX = 60;

/** Room left in the description box once a bundle's hand-over and date lines are added. */
export const BUNDLE_DESCRIPTION_MAX = DESCRIPTION_MAX - 120;

export interface BundleRow {
  /** Stable key for the row, never sent. */
  id: string;
  title: string;
  /** What the student typed: '1.5k', '900', or empty. */
  priceText: string;
}

export interface MarketFormState {
  kind: FormKind;
  audience: CampusAudience;
  title: string;
  description: string;
  category: MarketCategory;
  price: number | null;
  priceTerms: PriceTerms;
  genderPref: GenderPref;
  images: string[];
  /** Landmark from the campus config. Null when none, or an 'Other place' pick. */
  landmarkId: string | null;
  whatsappNumber: string;
  useSavedNumber: boolean;
  // item
  condition: ItemCondition | null;
  brand: string;
  // wanted
  /** 'YYYY-MM-DD' or empty. */
  neededBy: string;
  // bundle
  parts: BundleRow[];
  splitOk: boolean;
  /** 'YYYY-MM-DD' or empty. Not in the schema yet: folded into the description. */
  availableUntil: string;
  /** Where and when to collect. Not in the schema yet: folded into the description. */
  handOver: string;
}

export type BuildResult =
  | { ok: true; payload: MarketCreate }
  | { ok: false; error: string; field: string | null };

const KIND_ALIASES: Record<string, FormKind> = {
  item: 'item',
  sell: 'item',
  wanted: 'wanted',
  ask: 'wanted',
  bundle: 'bundle',
  room: 'bundle',
  clear_out: 'bundle',
};

function firstValue(raw: string | string[] | undefined | null): string {
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : '';
  return typeof raw === 'string' ? raw : '';
}

/** ?kind=wanted -> 'wanted'. Unknown kinds, or kinds the form cannot build yet, -> null. */
export function parseKindParam(raw: string | string[] | undefined | null): FormKind | null {
  const value = firstValue(raw).trim().toLowerCase().replace(/-/g, '_');
  return KIND_ALIASES[value] ?? null;
}

/** True for any market kind id, built here or not. */
export function isMarketKind(value: string): value is MarketKind {
  return (MARKET_KINDS as readonly string[]).includes(value);
}

/** ?audience=girls -> 'girls'. Anything else is a campus post. */
export function parseAudienceParam(raw: string | string[] | undefined | null): CampusAudience {
  return firstValue(raw).trim().toLowerCase() === 'girls' ? 'girls' : 'campus';
}

/** ?q=cycle on a wanted post -> 'Any cycle available?'. Empty otherwise. */
export function prefillTitle(kind: FormKind | null, raw: string | string[] | undefined | null): string {
  const q = firstValue(raw).trim().slice(0, 200);
  if (kind !== 'wanted' || !q) return '';
  return askText(q).slice(0, TITLE_MAX);
}

export function maxPhotosFor(kind: FormKind): number {
  return kind === 'bundle' ? MAX_BUNDLE_PHOTOS : MAX_LISTING_PHOTOS;
}

/** Price terms each kind offers. Wanted has no free or swap; a bundle has no swap. */
export function priceTermsFor(kind: FormKind): readonly PriceTerms[] {
  if (kind === 'wanted') return ['negotiable', 'fixed'];
  if (kind === 'bundle') return ['fixed', 'negotiable', 'free'];
  return ['fixed', 'negotiable', 'free', 'swap'];
}

export function isFreeTerms(terms: PriceTerms): boolean {
  return terms === 'free' || terms === 'swap';
}

let rowCounter = 0;
export function newBundleRow(title = '', priceText = ''): BundleRow {
  rowCounter += 1;
  return { id: `row-${rowCounter}`, title, priceText };
}

export function initialFormState(kind: FormKind, audience: CampusAudience, title = ''): MarketFormState {
  return {
    kind,
    audience,
    title,
    description: '',
    category: kind === 'bundle' ? 'hostel_essentials' : 'other',
    price: null,
    priceTerms: priceTermsFor(kind)[0],
    genderPref: audience === 'girls' ? 'girls' : 'anyone',
    images: [],
    landmarkId: null,
    whatsappNumber: '',
    useSavedNumber: false,
    condition: null,
    brand: '',
    neededBy: '',
    parts: [newBundleRow()],
    splitOk: true,
    availableUntil: '',
    handOver: '',
  };
}

/** Moves the shared fields to another kind and fixes what no longer fits. */
export function switchKind(state: MarketFormState, kind: FormKind): MarketFormState {
  if (state.kind === kind) return state;
  const terms = priceTermsFor(kind);
  const priceTerms = terms.includes(state.priceTerms) ? state.priceTerms : terms[0];
  return {
    ...state,
    kind,
    priceTerms,
    price: isFreeTerms(priceTerms) ? null : state.price,
    images: state.images.slice(0, maxPhotosFor(kind)),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-11-20' -> '20 Nov'. Null when it is not a real date. */
export function formatDay(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${day} ${MONTHS[month - 1]}`;
}

/** The description sent for a bundle: the student's text, then the hand-over and date lines. */
export function bundleDescription(description: string, handOver: string, availableUntil: string): string {
  const lines = [description.trim()];
  const where = handOver.trim().replace(/\s+/g, ' ');
  if (where) lines.push(`Hand over: ${where}`);
  const day = formatDay(availableUntil);
  if (day) lines.push(`Available till ${day}`);
  return lines.filter(Boolean).join('\n');
}

/** Plain messages for the fields zod would otherwise describe in its own words. */
const FIELD_MESSAGES: Record<string, string> = {
  title: 'Add a title, up to 80 letters',
  description: 'Keep the description shorter',
  price: 'Add a price',
  budgetMax: 'Check the budget',
  landmarkId: 'Pick a place from the list',
  images: 'Too many photos',
  parts: 'Add at least one thing',
  neededBy: 'Pick a real date',
  whatsappNumber: 'Enter a 10 digit mobile number',
  category: 'Pick a category',
  condition: 'Pick a condition',
  brand: 'Check the brand name',
};

function fail(error: string, field: string | null): BuildResult {
  return { ok: false, error, field };
}

/**
 * Builds the POST body for /api/marketplace/listings and checks it with
 * marketCreateSchema, so the form shows the same errors the server would.
 */
export function buildMarketPayload(state: MarketFormState): BuildResult {
  const free = isFreeTerms(state.priceTerms);
  const price = free ? null : state.price;
  const girls = state.audience === 'girls';
  const savedNumber = state.useSavedNumber;
  const number = state.whatsappNumber.trim();
  if (!savedNumber && !number) return fail('Add your WhatsApp number', 'whatsappNumber');

  const base = {
    title: state.title.trim(),
    category: state.category,
    price,
    priceTerms: state.priceTerms,
    // Girls' space posts are always for girls.
    genderPref: girls ? ('girls' as const) : state.genderPref,
    images: state.images,
    ...(state.landmarkId ? { landmarkId: state.landmarkId } : {}),
    ...(savedNumber ? { useSavedNumber: true } : { whatsappNumber: number }),
  };

  let input: Record<string, unknown>;
  switch (state.kind) {
    case 'item': {
      if (!state.landmarkId) return fail('Pick a place from the list', 'landmarkId');
      const brand = state.brand.trim();
      input = {
        ...base,
        kind: 'item',
        description: state.description.trim() || undefined,
        condition: state.condition,
        brand: brand || null,
      };
      break;
    }
    case 'wanted': {
      const neededBy = state.neededBy.trim();
      input = {
        ...base,
        kind: 'wanted',
        description: state.description.trim() || undefined,
        // The budget is also the listing price, so the feed and search read it.
        budgetMax: price,
        neededBy: neededBy || null,
      };
      break;
    }
    case 'bundle': {
      if (!state.landmarkId) return fail('Pick a place from the list', 'landmarkId');
      if (state.handOver.trim().length > HAND_OVER_MAX) return fail('Keep the hand-over line short', 'handOver');
      const rows = state.parts.filter((row) => row.title.trim() || row.priceText.trim());
      if (rows.length === 0) return fail('Add at least one thing', 'parts');
      if (rows.length > MAX_BUNDLE_ITEMS) return fail(`At most ${MAX_BUNDLE_ITEMS} things`, 'parts');
      const parts: Array<{ title: string; price: number | null }> = [];
      for (const row of rows) {
        const title = row.title.trim();
        if (!title) return fail('Name every thing in the list', 'parts');
        if (title.length > BUNDLE_PART_TITLE_MAX) return fail('Keep each name under 60 letters', 'parts');
        const text = row.priceText.trim();
        const partPrice = free || !text ? null : parsePriceInput(text);
        if (!free && text && partPrice === null) return fail(`Check the price for ${title.slice(0, 30)}`, 'parts');
        parts.push({ title, price: partPrice });
      }
      const description = bundleDescription(state.description, state.handOver, state.availableUntil);
      input = {
        ...base,
        kind: 'bundle',
        description: description || undefined,
        parts,
        splitOk: state.splitOk,
      };
      break;
    }
    default:
      return fail('This kind of post is not open yet', 'kind');
  }

  const parsed = marketCreateSchema.safeParse(input);
  if (parsed.success) return { ok: true, payload: parsed.data };
  const issue = parsed.error.issues[0];
  const field = issue?.path.length ? String(issue.path[0]) : null;
  const message =
    issue?.code === 'custom' || field === 'whatsappNumber' ? issue.message : (field && FIELD_MESSAGES[field]) || issue?.message;
  return fail(message || 'Check the form', field);
}
