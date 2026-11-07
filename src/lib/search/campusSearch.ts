// Campus search (KADA-18). Pure module: no React, no services, safe for node tests.
// Reads one search box line ('kjc cycle under 2k', 'pg near kothnur') into a
// structured query, then matches market and housing listings against it.
// Campus comes from the session; places are only ever read from the text.
import type { Campus, CollegeId, Landmark } from '@/types/college';
import type { GenderPref } from '@/types/campus';
import { campusesOf, getCampus, listCampuses, listColleges, normalizeSearch } from '../campus/catalog.ts';
import { parsePriceInput, parsePriceQuery } from '../format/price.ts';

/** Browse groups a search can point at. */
export type SearchCategory = 'vehicles' | 'room' | 'passes' | 'trips' | 'tickets' | 'books_notes';

export type SearchGender = Exclude<GenderPref, 'anyone'>;

export interface SearchContext {
  /** The viewer's college, from the session. 'clg' and 'college' mean this. */
  viewerCollegeId?: string | null;
  /** The viewer's campus, from the session. Places are looked up around it. */
  campusId?: string | null;
}

export interface ParsedQuery {
  collegeId?: CollegeId;
  /** Canonical area names, e.g. 'Kothanur'. */
  areaIds: string[];
  /** Catalog landmark ids, e.g. 'kju-main-falcon-hospital'. */
  landmarkIds: string[];
  category?: SearchCategory;
  gender?: SearchGender;
  min?: number;
  max?: number;
  /** Words left to match against the listing text. */
  terms: string[];
}

/** Structural listing shape: market listings and housing listings both fit. */
export interface SearchableItem {
  title?: string | null;
  description?: string | null;
  serial?: string | null;
  collegeId?: string | null;
  kind?: string | null;
  category?: string | null;
  stayType?: string | null;
  price?: number | null;
  rentPp?: number | null;
  genderPref?: GenderPref | null;
  whoCanStay?: GenderPref | null;
  place?: { landmarkId?: string | null; label?: string | null; area?: string | null } | null;
  details?: Record<string, unknown> | null;
}

/** Lowercase, strip punctuation, collapse spaces. */
export function normalize(text: string): string {
  return typeof text === 'string' ? normalizeSearch(text) : '';
}

// ---------------------------------------------------------------------------
// Vocabulary

/** Words that mean the viewer's own college. */
const OWN_COLLEGE_WORDS = new Set(['clg', 'cllg', 'colg', 'college', 'campus']);

const GENDER_WORDS: Readonly<Record<string, SearchGender>> = {
  girls: 'girls',
  girl: 'girls',
  ladies: 'girls',
  lady: 'girls',
  female: 'girls',
  females: 'girls',
  women: 'girls',
  woman: 'girls',
  boys: 'boys',
  boy: 'boys',
  gents: 'boys',
  male: 'boys',
  males: 'boys',
  men: 'boys',
};

/** Specific things: they pick a category and stay as search words. */
const ITEM_WORDS: Readonly<Record<string, SearchCategory>> = {
  bike: 'vehicles',
  bikes: 'vehicles',
  scooty: 'vehicles',
  scooter: 'vehicles',
  activa: 'vehicles',
  cycle: 'vehicles',
  cycles: 'vehicles',
  bicycle: 'vehicles',
  mattress: 'room',
  bucket: 'room',
  table: 'room',
  chair: 'room',
  mess: 'passes',
  gym: 'passes',
  bus: 'trips',
  train: 'trips',
  seat: 'trips',
  cab: 'trips',
};

/** Category names: they pick a category and are used up. */
const CATEGORY_WORDS: Readonly<Record<string, SearchCategory>> = {
  vehicle: 'vehicles',
  vehicles: 'vehicles',
  pass: 'passes',
  passes: 'passes',
  trip: 'trips',
  trips: 'trips',
  ticket: 'tickets',
  tickets: 'tickets',
  book: 'books_notes',
  books: 'books_notes',
  notes: 'books_notes',
};

/** Every word that hints at a category, for text-based category matches. */
const CATEGORY_HINTS: Readonly<Record<SearchCategory, readonly string[]>> = (() => {
  const hints: Record<SearchCategory, string[]> = {
    vehicles: [],
    room: [],
    passes: [],
    trips: [],
    tickets: [],
    books_notes: [],
  };
  for (const [word, category] of [...Object.entries(ITEM_WORDS), ...Object.entries(CATEGORY_WORDS)]) {
    hints[category].push(word);
  }
  return hints;
})();

const PLACE_WORDS = new Set(['near', 'nearby', 'around', 'opp', 'opposite', 'behind', 'beside']);

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'any',
  'some',
  'for',
  'in',
  'at',
  'to',
  'of',
  'by',
  'on',
  'with',
  'and',
  'or',
  'i',
  'me',
  'my',
  'need',
  'want',
  'wanted',
  'looking',
  'available',
  'anyone',
  'selling',
  'close',
  'only',
]);

const MAX_PHRASE_WORDS = 4;

/** Normalized college alias -> college id, built once from the catalog. */
const COLLEGE_ALIASES: ReadonlyMap<string, CollegeId> = (() => {
  const map = new Map<string, CollegeId>();
  for (const college of listColleges()) {
    for (const raw of [college.code, college.shortName, ...college.aliases]) {
      const alias = normalize(raw);
      if (alias && !OWN_COLLEGE_WORDS.has(alias) && !map.has(alias)) map.set(alias, college.id);
    }
  }
  return map;
})();

const LANDMARK_BY_ID: ReadonlyMap<string, Landmark> = new Map(
  listCampuses().flatMap((campus) => campus.landmarks.map((landmark) => [landmark.id, landmark] as const)),
);

// ---------------------------------------------------------------------------
// Places

type PlaceHit = { kind: 'area' | 'landmark'; id: string };

interface PlaceIndex {
  exact: Map<string, PlaceHit>;
  /** Single-word names for typo matching ('kothnur' -> 'kothanur'). */
  words: { word: string; hit: PlaceHit }[];
}

/** An area chip is a landmark named after its own area. */
function isAreaChip(landmark: Landmark): boolean {
  return normalize(landmark.label) === normalize(landmark.area);
}

function placeCampuses(collegeId: string | null | undefined, campusId: string | null | undefined): Campus[] {
  const pool: Campus[] = [];
  const own = getCampus(campusId);
  if (own) pool.push(own);
  for (const campus of campusesOf(collegeId ?? own?.collegeId)) {
    if (!pool.includes(campus)) pool.push(campus);
  }
  return pool;
}

function buildPlaceIndex(campuses: readonly Campus[]): PlaceIndex {
  const exact = new Map<string, PlaceHit>();
  const add = (raw: string, hit: PlaceHit) => {
    const name = normalize(raw);
    if (!name) return;
    const existing = exact.get(name);
    // Areas win over landmarks of the same name; the first campus wins ties.
    if (!existing || (existing.kind === 'landmark' && hit.kind === 'area')) exact.set(name, hit);
  };
  for (const campus of campuses) {
    for (const landmark of campus.landmarks) {
      add(landmark.area, { kind: 'area', id: landmark.area });
      const hit: PlaceHit = isAreaChip(landmark) ? { kind: 'area', id: landmark.area } : { kind: 'landmark', id: landmark.id };
      add(landmark.label, hit);
      for (const alias of landmark.aliases) add(alias, hit);
    }
  }
  const words = [...exact.entries()].filter(([name]) => !name.includes(' ')).map(([word, hit]) => ({ word, hit }));
  return { exact, words };
}

/** Levenshtein distance, stopping early once it passes `limit`. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      row.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    prev = row;
  }
  return prev[b.length];
}

/** Typo match for one word. Short words need an exact name, unless they follow 'near'. */
function fuzzyPlace(word: string, index: PlaceIndex, afterPlaceWord: boolean): PlaceHit | null {
  const limit = word.length >= 8 ? 2 : word.length >= 5 || (afterPlaceWord && word.length >= 4) ? 1 : 0;
  if (limit === 0) return null;
  let best: { hit: PlaceHit; distance: number } | null = null;
  for (const entry of index.words) {
    if (entry.word.length < 4) continue;
    const distance = editDistance(word, entry.word, limit);
    if (distance > limit) continue;
    const better =
      !best || distance < best.distance || (distance === best.distance && best.hit.kind === 'landmark' && entry.hit.kind === 'area');
    if (better) best = { hit: entry.hit, distance };
  }
  return best?.hit ?? null;
}

// ---------------------------------------------------------------------------
// Prices

const RANGE_SIDE = String.raw`((?:rs\.?|inr|₹)?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l)?)`;
const RANGE_PATTERN = new RegExp(String.raw`(?:\bbetween\s+)?${RANGE_SIDE}\s*(?:-|\bto\b|\band\b)\s*${RANGE_SIDE}(?![\w.])`, 'i');
const BARE_PRICE = /(^|\s)((?:rs\.?|inr|₹)\s*\d[\d,]*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|l)?|\d[\d,]*(?:\.\d+)?\s*(?:k|lakhs?|lacs?))(?![\w.])/i;
const HAS_UNIT = /(?:rs|inr|₹|k|l|lakhs?|lacs?)\s*$|^\s*(?:rs|inr|₹)/i;

/** Price limits out of the raw text. Returns the text with them taken out. */
function takePrices(raw: string): { min?: number; max?: number; rest: string } {
  const { min, max, rest: afterLimits } = parsePriceQuery(raw);
  const result: { min?: number; max?: number; rest: string } = { min, max, rest: afterLimits };

  if (result.min === undefined && result.max === undefined) {
    const range = RANGE_PATTERN.exec(result.rest);
    if (range && (HAS_UNIT.test(range[1]) || HAS_UNIT.test(range[2]) || /between/i.test(range[0]))) {
      const low = parsePriceInput(range[1].replace(/\s+/g, ' ').trim());
      const high = parsePriceInput(range[2].replace(/\s+/g, ' ').trim());
      if (low !== null && high !== null) {
        // '5 to 10k' means 5k to 10k.
        const unit = /(k|lakhs?|lacs?|l)\s*$/i.exec(range[2])?.[1];
        const lowValue = unit && !HAS_UNIT.test(range[1]) && low < high / 100 ? parsePriceInput(`${range[1].trim()}${unit}`) ?? low : low;
        result.min = Math.min(lowValue, high);
        result.max = Math.max(lowValue, high);
        result.rest = result.rest.replace(range[0], ' ');
      }
    }
  }

  if (result.min === undefined && result.max === undefined) {
    // A lone '2k' or 'Rs 900' reads as a budget. Plain numbers stay words (serials).
    const bare = BARE_PRICE.exec(result.rest);
    const value = bare ? parsePriceInput(bare[2].replace(/\s+/g, ' ').trim()) : null;
    if (bare && value !== null) {
      result.max = value;
      result.rest = result.rest.replace(bare[2], ' ');
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Parsing

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/**
 * Reads a search line.
 * 'kjc cycle under 2k' -> { collegeId: 'kju', category: 'vehicles', terms: ['cycle'], max: 2000 }
 * 'pg near kothnur' -> { areaIds: ['Kothanur'], terms: ['pg'] }
 * 'clg' -> { collegeId: viewer's college }
 */
export function parseQuery(text: string, context: SearchContext = {}): ParsedQuery {
  const parsed: ParsedQuery = { areaIds: [], landmarkIds: [], terms: [] };
  const raw = typeof text === 'string' ? text.toLowerCase() : '';
  const prices = takePrices(raw);
  if (prices.min !== undefined) parsed.min = prices.min;
  if (prices.max !== undefined) parsed.max = prices.max;

  const tokens = normalize(prices.rest).split(' ').filter(Boolean);
  const viewerCollege = listColleges().find((college) => college.id === context.viewerCollegeId)?.id;

  // Colleges first, so 'kjc' or 'clg' decides which campus places come from.
  tokens.forEach((token, start) => {
    if (OWN_COLLEGE_WORDS.has(token) && viewerCollege) parsed.collegeId = viewerCollege;
    for (let n = 1; n <= MAX_PHRASE_WORDS && start + n <= tokens.length; n += 1) {
      const college = COLLEGE_ALIASES.get(tokens.slice(start, start + n).join(' '));
      if (college) parsed.collegeId = college;
    }
  });
  const places = buildPlaceIndex(placeCampuses(parsed.collegeId ?? viewerCollege, context.campusId));

  let afterPlaceWord = false;
  let i = 0;
  while (i < tokens.length) {
    let used = 0;
    for (let n = Math.min(MAX_PHRASE_WORDS, tokens.length - i); n >= 1 && used === 0; n -= 1) {
      const phrase = tokens.slice(i, i + n).join(' ');
      const college = COLLEGE_ALIASES.get(phrase);
      const place = places.exact.get(phrase);
      if (n === 1 && OWN_COLLEGE_WORDS.has(phrase)) {
        used = 1; // already read above
      } else if (n === 1 && GENDER_WORDS[phrase]) {
        parsed.gender = GENDER_WORDS[phrase];
        used = 1;
      } else if (n === 1 && CATEGORY_WORDS[phrase]) {
        parsed.category ??= CATEGORY_WORDS[phrase];
        used = 1;
      } else if (n === 1 && ITEM_WORDS[phrase]) {
        parsed.category ??= ITEM_WORDS[phrase];
        pushUnique(parsed.terms, phrase);
        used = 1;
      } else if (college) {
        parsed.collegeId = college;
        used = n;
      } else if (place) {
        pushUnique(place.kind === 'area' ? parsed.areaIds : parsed.landmarkIds, place.id);
        used = n;
      }
    }

    if (used > 0) {
      afterPlaceWord = false;
      i += used;
      continue;
    }

    const token = tokens[i];
    i += 1;
    if (PLACE_WORDS.has(token)) {
      afterPlaceWord = true;
      continue;
    }
    if (STOP_WORDS.has(token)) continue;
    const fuzzy = /^[a-z]+$/.test(token) ? fuzzyPlace(token, places, afterPlaceWord) : null;
    if (fuzzy) {
      pushUnique(fuzzy.kind === 'area' ? parsed.areaIds : parsed.landmarkIds, fuzzy.id);
    } else {
      pushUnique(parsed.terms, token);
    }
    afterPlaceWord = false;
  }

  return parsed;
}

/** True when the query narrows nothing (empty or only stop words). */
export function isEmptyQuery(parsed: ParsedQuery): boolean {
  return (
    parsed.collegeId === undefined &&
    parsed.areaIds.length === 0 &&
    parsed.landmarkIds.length === 0 &&
    parsed.category === undefined &&
    parsed.gender === undefined &&
    parsed.min === undefined &&
    parsed.max === undefined &&
    parsed.terms.length === 0
  );
}

// ---------------------------------------------------------------------------
// Matching

function detailText(details: Record<string, unknown> | null | undefined): string[] {
  if (!details) return [];
  const keys = ['vehicleType', 'passType', 'seatFor', 'from', 'to', 'venue', 'brand'];
  return keys.map((key) => details[key]).filter((value): value is string => typeof value === 'string');
}

function itemWords(item: SearchableItem): string[] {
  const parts = [
    item.title,
    item.description,
    item.serial,
    item.category?.replace(/_/g, ' '),
    item.kind?.replace(/_/g, ' '),
    item.stayType,
    item.place?.label,
    item.place?.area,
    ...detailText(item.details),
  ];
  return normalize(parts.filter((part): part is string => typeof part === 'string').join(' '))
    .split(' ')
    .filter(Boolean);
}

/** A word matches when a listing word starts with it ('cycle' finds 'cycles'). */
function hasWord(words: readonly string[], term: string): boolean {
  const stem = term.length > 3 && term.endsWith('s') ? term.slice(0, -1) : term;
  return words.some((word) => word.startsWith(stem));
}

function inCategory(item: SearchableItem, category: SearchCategory): boolean {
  const kind = item.kind ?? '';
  const group = item.category ?? '';
  switch (category) {
    case 'vehicles':
      return kind === 'vehicle' || group === 'cycles';
    case 'room':
      return kind === 'bundle' || group === 'hostel_essentials';
    case 'passes':
      return kind === 'pass';
    case 'trips':
      return kind === 'seat' || kind === 'cab_split' || group === 'travel';
    case 'tickets':
      return kind === 'ticket';
    case 'books_notes':
      return group === 'books_notes';
  }
}

function itemPrice(item: SearchableItem): number | null {
  if (typeof item.price === 'number' && Number.isFinite(item.price)) return item.price;
  if (typeof item.rentPp === 'number' && Number.isFinite(item.rentPp)) return item.rentPp;
  return null;
}

function placeMatches(item: SearchableItem, parsed: ParsedQuery): boolean {
  const place = item.place;
  if (!place) return false;
  if (place.landmarkId && parsed.landmarkIds.includes(place.landmarkId)) return true;

  // Anything in the same area counts as near.
  const areas = new Set(parsed.areaIds.map(normalize));
  for (const id of parsed.landmarkIds) {
    const landmark = LANDMARK_BY_ID.get(id);
    if (landmark) areas.add(normalize(landmark.area));
  }
  const itemAreas = [place.area, place.landmarkId ? LANDMARK_BY_ID.get(place.landmarkId)?.area : null]
    .filter((area): area is string => typeof area === 'string')
    .map(normalize);
  return itemAreas.some((area) => areas.has(area));
}

/**
 * Structural match over title, description, serial, category, place and price.
 * Gender: 'girls' finds girls-only and anyone. Null price passes a max, fails a min.
 */
export function matchItem(item: SearchableItem, parsed: ParsedQuery): boolean {
  if (parsed.collegeId && item.collegeId && item.collegeId !== parsed.collegeId) return false;

  if (parsed.gender) {
    const who = item.genderPref ?? item.whoCanStay;
    if (who && who !== 'anyone' && who !== parsed.gender) return false;
  }

  const price = itemPrice(item);
  if (parsed.min !== undefined && (price === null || price < parsed.min)) return false;
  if (parsed.max !== undefined && price !== null && price > parsed.max) return false;

  if ((parsed.areaIds.length > 0 || parsed.landmarkIds.length > 0) && !placeMatches(item, parsed)) return false;

  const words = itemWords(item);
  if (parsed.category && !inCategory(item, parsed.category)) {
    if (!CATEGORY_HINTS[parsed.category].some((hint) => hasWord(words, hint))) return false;
  }

  return parsed.terms.every((term) => hasWord(words, term));
}

// ---------------------------------------------------------------------------
// Copy

const ASK_MAX_WORDS = 9;

/** 'cycle' -> 'Any cycle available?'. Long searches are cut to fit 9 words. */
export function askText(q: string): string {
  const words = (typeof q === 'string' ? q : '')
    .replace(/[?!]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 0 && /^any$/i.test(words[0])) words.shift();
  while (words.length > 0 && /^available$/i.test(words[words.length - 1])) words.pop();
  if (words.length === 0) return 'Anything available?';
  const body = words.slice(0, ASK_MAX_WORDS - 2).join(' ');
  return `Any ${body} available?`;
}

const WANTED_PLACEHOLDERS = [
  'Any cycle under Rs 2k?',
  'Need a mattress for this sem',
  'Any gym pass for this month?',
  'Looking for a study table',
] as const;

/** Example line for the wanted box. Same index, same line (safe for SSR). */
export function wantedPlaceholder(index = 0): string {
  const safe = Number.isInteger(index) ? Math.abs(index) : 0;
  return WANTED_PLACEHOLDERS[safe % WANTED_PLACEHOLDERS.length];
}
