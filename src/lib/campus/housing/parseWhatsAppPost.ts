// Turns a pasted WhatsApp housing message into a draft for the create form.
// Rules only: no network, no LLM. Handles English and common Hinglish.
// Phone numbers are lifted out of the text and stripped; door numbers are flagged.
// Pure module: node tests import it, so '@/...' only as `import type`.
import type { GenderPref } from '@/types/campus';
import type { Landmark } from '@/types/college';
import type { Furnishing, HousingStayType } from '@/types/housing';
import { HOUSE_RULES, NO_RESTRICTIONS, PHONE_PATTERN_SOURCE, normalizePhone } from './model.ts';
import type { HouseRuleOption, HousingKind, PostedAs, RentTermsKind } from './model.ts';
import { istDateKey } from '../season.ts';

export interface HousingDraft {
  kind?: HousingKind;
  postedAs?: PostedAs;
  brokerage?: { charged: boolean; amount: number | null };
  stayType?: HousingStayType;
  whoCanStay?: GenderPref;
  houseRules?: HouseRuleOption[];
  /** 'now', 'next_sem' or an IST date 'YYYY-MM-DD'. */
  moveIn?: string;
  bedsLeft?: number;
  sharing?: number;
  rentPp?: number;
  deposit?: number;
  rentTerms?: RentTermsKind;
  furnishing?: Furnishing;
  /** A landmark from the campus list, or 'other' with the typed area. */
  place?: { landmarkId: string; area: string };
}

export type HousingDraftField = keyof HousingDraft;

/** Draft fields in form order; `filled` follows this order. */
export const DRAFT_FIELDS: readonly HousingDraftField[] = [
  'kind',
  'postedAs',
  'brokerage',
  'stayType',
  'whoCanStay',
  'houseRules',
  'moveIn',
  'bedsLeft',
  'sharing',
  'rentPp',
  'deposit',
  'rentTerms',
  'furnishing',
  'place',
];

export type ParseFlag = 'phone_removed' | 'door_number' | 'brokerage_unclear';

export interface ParsedWhatsAppPost {
  draft: HousingDraft;
  filled: HousingDraftField[];
  /** First phone number found, as 10 digits. */
  phone?: string;
  /** The message with phone numbers stripped. */
  cleanedDescription: string;
  flags: ParseFlag[];
}

export interface ParseOptions {
  /** Reference time for move-in dates. Defaults to now. */
  now?: Date | string | number;
}

// ---------------------------------------------------------------------------
// Text helpers

/** Lowercase, drop apostrophes and dots, other punctuation to spaces, single spaces. */
function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  ek: 1,
  single: 1,
  two: 2,
  do: 2,
  double: 2,
  twin: 2,
  three: 3,
  teen: 3,
  triple: 3,
  four: 4,
  char: 4,
  chaar: 4,
  quad: 4,
  five: 5,
  six: 6,
};

function countValue(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return WORD_NUMBERS[token] ?? null;
}

// ---------------------------------------------------------------------------
// Phones

const PHONE_LABEL = String.raw`(?:\b(?:contact|call|whats\s?app|wa|ph|phone|mob|mobile|cell|number|num|no|reach|ping|dm|msg|message|text)\b\.?(?:\s*(?:me|us|on|at|owner|number|no|nos|for details|karo|kro|kar do))*\s*[:\-–=]?\s*)?`;
const LABEL_ONLY_LINE = /^[\s\W]*(?:(?:contact|call|whats\s?app|wa|ph|phone|mob|mobile|cell|number|num|no|nos|reach|ping|dm|msg|message|text|me|us|on|at|owner|agent|broker|landlord|or|and|for|details|interested|people|karo|kar|do)\b[\s\W]*)*$/i;

/**
 * Lifts phone numbers out of the text. `cleaned` drops them (and a line left
 * holding only a contact label); `blanked` keeps every line for parsing.
 */
function stripPhones(text: string): { cleaned: string; blanked: string; phones: string[] } {
  const phones: string[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const pattern = new RegExp(PHONE_LABEL + PHONE_PATTERN_SOURCE, 'gi');
  for (const line of lines) {
    let touched = false;
    const next = line.replace(pattern, (match) => {
      const found = new RegExp(PHONE_PATTERN_SOURCE).exec(match);
      if (found) phones.push(normalizePhone(found[0]));
      touched = true;
      return '';
    });
    if (touched && LABEL_ONLY_LINE.test(next)) continue;
    if (!touched) {
      out.push(line.trimEnd());
      continue;
    }
    out.push(
      next
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        // Drop connectors the number left dangling: 'PG near Falcon, or'.
        .replace(/(?:[\s,:;/&-]|\b(?:or|and)\b)+$/i, ''),
    );
  }
  const cleaned = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const blanked = text.replace(new RegExp(PHONE_PATTERN_SOURCE, 'g'), ' ');
  return { cleaned, blanked, phones: [...new Set(phones)] };
}

// ---------------------------------------------------------------------------
// Money

interface MoneyToken {
  value: number;
  start: number;
  end: number;
  marked: boolean;
  label: 'rent' | 'deposit' | 'brokerage' | 'other' | null;
}

const MONEY_RE = /(\brs\.?|\binr|₹)?\s*(\d[\d,]*(?:\.\d+)?)(?:\s*(k|thousand|lakhs?|lacs?|l)(?![a-z]))?(?:\s*(\/-|\/=|rs\b\.?|rupees\b|inr\b))?(?![a-z\d])/g;
const UNIT: Record<string, number> = { k: 1_000, thousand: 1_000, l: 1_00_000, lac: 1_00_000, lacs: 1_00_000, lakh: 1_00_000, lakhs: 1_00_000 };

const BEFORE_KEYWORDS: { label: Exclude<MoneyToken['label'], null>; re: RegExp }[] = [
  { label: 'deposit', re: /\b(?:deposit|dep|advance|security|refundable)\b/g },
  { label: 'brokerage', re: /\b(?:brokerage|commission|broker fee|broker charges?)\b/g },
  { label: 'rent', re: /\b(?:rent|rental|kiraya|kiraaya|price|monthly|per month)\b/g },
  { label: 'other', re: /\b(?:maintenance|electricity|eb|wifi|food|mess|laundry|water|extra|cooking|gas)\b/g },
];

const RENT_AFTER = /^\s*(?:rs\.?|rupees|inr)?\s*(?:\/-)?\s*(?:(?:\/|per|a|p)\s*\.?\s*)?(?:month|mon|mo|pm|head|person|bed|pp|each|monthly|rent|kiraya)\b/;
const DEPOSIT_AFTER = /^\s*(?:rs\.?|rupees|inr)?\s*(?:\/-)?\s*(?:as\s+)?(?:deposit|dep|advance|security|refundable)\b/;
const BROKERAGE_AFTER = /^\s*(?:rs\.?|rupees|inr)?\s*(?:\/-)?\s*(?:as\s+)?(?:brokerage|commission)\b/;

/** Index of the clause start before `index`: a newline, ; | • ! or a comma not inside a number. */
function clauseStart(text: string, index: number): number {
  for (let i = index - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === '\n' || ch === ';' || ch === '|' || ch === '•' || ch === '!') return i + 1;
    if (ch === ',' && !(/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? ''))) return i + 1;
  }
  return 0;
}

function moneyTokens(lower: string): MoneyToken[] {
  const tokens: MoneyToken[] = [];
  for (const match of lower.matchAll(MONEY_RE)) {
    const digits = match[2].replace(/,/g, '');
    const base = Number(digits);
    if (!Number.isFinite(base)) continue;
    const unit = match[3];
    const value = Math.round(base * (unit ? UNIT[unit] : 1));
    const marked = Boolean(match[1] || unit || match[4]);
    // Plain small numbers are counts, times or distances, never money.
    if (!marked && value < 1_000) continue;
    const start = match.index + (match[0].length - match[0].trimStart().length);
    tokens.push({ value, start, end: match.index + match[0].length, marked, label: null });
  }

  tokens.forEach((token, index) => {
    const from = Math.max(clauseStart(lower, token.start), index > 0 ? tokens[index - 1].end : 0);
    const before = lower.slice(from, token.start);
    let best: { label: MoneyToken['label']; at: number } = { label: null, at: -1 };
    for (const { label, re } of BEFORE_KEYWORDS) {
      for (const hit of before.matchAll(re)) {
        if (hit.index >= best.at) best = { label, at: hit.index };
      }
    }
    if (best.label) {
      token.label = best.label;
      return;
    }
    const after = lower.slice(token.end, tokens[index + 1]?.start ?? lower.length);
    if (DEPOSIT_AFTER.test(after)) token.label = 'deposit';
    else if (BROKERAGE_AFTER.test(after)) token.label = 'brokerage';
    else if (RENT_AFTER.test(after)) token.label = 'rent';
  });
  return tokens;
}

const MONTHS_COUNT = String.raw`(\d+|one|two|three|four|six|ek|do|teen)`;

/** '2 months deposit', 'deposit: 2 months rent' -> 2. */
function monthsOf(lower: string, keyword: string): number | null {
  const after = new RegExp(String.raw`\b${MONTHS_COUNT}\s*months?(?:'s)?\s*(?:of\s*)?(?:rent\s*)?(?:as\s*)?(?:${keyword})\b`).exec(lower);
  const before = new RegExp(String.raw`\b(?:${keyword})\s*(?:is|of|:|-|=)?\s*${MONTHS_COUNT}\s*months?\b`).exec(lower);
  const hit = after ?? before;
  return hit ? countValue(hit[1]) : null;
}

// ---------------------------------------------------------------------------
// Move-in

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const ORDINAL_DAY = String.raw`(\d{1,2})(?:st|nd|rd|th)`;
const DAY = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
const FROM = String.raw`\b(?:from|starting(?:\s+from)?|start(?:ing)?|available(?:\s+from)?|availability|move[\s-]?in(?:\s+(?:from|on|date))?|moving\s+in|w\.?e\.?f\.?|by)\s*[:\-]?\s*`;
const ONWARDS = String.raw`\s*(?:onwards?|se)\b`;

interface YMD {
  year: number;
  month: number;
  day: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function key(date: YMD): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function compare(a: YMD, b: YMD): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function monthIndex(name: string): number {
  return MONTH_NAMES.indexOf(name.slice(0, 3)) + 1;
}

/** Next occurrence of month/day on or after today; past or today means 'now'. */
function upcoming(today: YMD, month: number, day: number): string | null {
  for (const year of [today.year, today.year + 1]) {
    if (day < 1 || day > daysInMonth(year, month)) continue;
    const candidate = { year, month, day };
    const order = compare(candidate, today);
    if (order === 0) return 'now';
    if (order > 0) return key(candidate);
  }
  return null;
}

function parseMoveIn(lower: string, now: Date | string | number): string | null {
  if (/\b(?:immediate(?:ly)?|available now|vacant now|asap|ready to (?:move|occupy)|right away|turant|abhi se|move in now)\b/.test(lower)) return 'now';
  if (/\bnext\s*sem(?:ester)?\b|\bagle\s*sem\b/.test(lower)) return 'next_sem';

  const [y, m, d] = istDateKey(now).split('-').map(Number);
  const today: YMD = { year: y, month: m, day: d };

  if (/\bnext month\b|\bagle mahine\b/.test(lower)) {
    const month = today.month === 12 ? 1 : today.month + 1;
    return key({ year: today.month === 12 ? today.year + 1 : today.year, month, day: 1 });
  }

  const dayMonth = new RegExp(String.raw`(?:${FROM}${DAY}\s*(?:of\s*)?${MONTH_RE}\b|\b${DAY}\s*(?:of\s*)?${MONTH_RE}\b${ONWARDS})`).exec(lower);
  if (dayMonth) {
    const day = Number(dayMonth[1] ?? dayMonth[3]);
    const month = monthIndex(dayMonth[2] ?? dayMonth[4]);
    return upcoming(today, month, day);
  }
  const monthDay = new RegExp(String.raw`(?:${FROM}${MONTH_RE}\s*${DAY}\b|\b${MONTH_RE}\s*${DAY}\b${ONWARDS})`).exec(lower);
  if (monthDay) {
    const month = monthIndex(monthDay[1] ?? monthDay[3]);
    const day = Number(monthDay[2] ?? monthDay[4]);
    return upcoming(today, month, day);
  }
  const monthOnly = new RegExp(String.raw`(?:${FROM}(?:end of\s*)?${MONTH_RE}\b|\b${MONTH_RE}${ONWARDS})`).exec(lower);
  if (monthOnly) {
    const month = monthIndex(monthOnly[1] ?? monthOnly[2]);
    if (month === today.month) return 'now';
    return upcoming(today, month, 1);
  }
  const dayOnly = new RegExp(String.raw`(?:${FROM}${ORDINAL_DAY}\b|\b${ORDINAL_DAY}${ONWARDS})`).exec(lower);
  if (dayOnly) {
    const day = Number(dayOnly[1] ?? dayOnly[2]);
    if (day === today.day) return 'now';
    if (day > today.day && day <= daysInMonth(today.year, today.month)) return key({ ...today, day });
    const month = today.month === 12 ? 1 : today.month + 1;
    const year = today.month === 12 ? today.year + 1 : today.year;
    if (day > daysInMonth(year, month)) return null;
    return key({ year, month, day });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Place

interface PlaceHit {
  landmark: Landmark;
  start: number;
  end: number;
  spot: boolean;
}

function findPlace(norm: string, landmarks: readonly Landmark[]): PlaceHit | null {
  const padded = ` ${norm} `;
  let best: PlaceHit | null = null;
  for (const landmark of landmarks) {
    const terms = new Set([landmark.label, ...landmark.aliases].map(normalize).filter(Boolean));
    for (const term of terms) {
      const at = padded.indexOf(` ${term} `);
      if (at < 0) continue;
      const hit: PlaceHit = { landmark, start: at, end: at + term.length, spot: normalize(landmark.label) !== normalize(landmark.area) };
      if (
        !best ||
        (hit.spot && !best.spot) ||
        (hit.spot === best.spot && (hit.end - hit.start > best.end - best.start || (hit.end - hit.start === best.end - best.start && hit.start < best.start)))
      ) {
        best = hit;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Field detectors (on normalized text unless noted)

const NEGATED_BROKER = /\b(?:no|zero|without|nil|not via|not through)\s+(?:brokerage|broker(?:s|age)?|agents?|commission|dalal)\b|\b(?:brokerage|commission)\s+(?:free|nil|none|not applicable|na)\b/g;

function detectBrokerage(norm: string, lower: string, tokens: MoneyToken[], rentPp: number | undefined): HousingDraft['brokerage'] | undefined {
  const amount = tokens.find((token) => token.label === 'brokerage')?.value;
  if (amount !== undefined && amount > 0) return { charged: true, amount };
  const months = monthsOf(lower, 'brokerage|commission');
  if (months !== null) return { charged: true, amount: rentPp !== undefined ? months * rentPp : null };
  if (new RegExp(NEGATED_BROKER.source).test(norm)) return { charged: false, amount: null };
  if (amount === 0) return { charged: false, amount: null };
  return undefined;
}

function detectPostedAs(norm: string, brokerage: HousingDraft['brokerage'] | undefined): PostedAs | undefined {
  const plain = norm.replace(NEGATED_BROKER, ' ');
  if (brokerage?.charged || /\b(?:agent|agents|broker|brokers|brokerage|realtor|realty|dalal|commission)\b/.test(plain)) return 'agent';
  if (/\b(?:replacement|moving out|leaving|vacating|shifting out|graduating)\b/.test(norm)) return 'leaving';
  if (/\b(?:owner|landlord|landlady|malik|maalik)\b/.test(norm)) return 'owner_contact';
  return undefined;
}

function detectKind(norm: string): HousingKind | undefined {
  if (/\breplacement\b/.test(norm)) return 'replacement';
  if (/\bsub ?(?:let|lease)\b|\bshort term\b/.test(norm)) return 'sublet';
  if (/\b(?:room ?mates?|flat ?mates?|roomie|roomies)\b/.test(norm)) return 'roommate';
  // Joining people who already live there: 'our flat', 'hamare flat mein'.
  if (/\b(?:our|my|hamare|hamara|humare|humara|apne)\s+(?:shared\s+)?(?:flat|room|apartment|house|pg|\d ?bhk)\b/.test(norm)) return 'roommate';
  if (/\b(?:pg|room|rooms|bhk|\d ?rk|flat|vacancy|vacant|khali|accommodation|hostel|bed|beds)\b/.test(norm)) return 'room';
  return undefined;
}

function detectStayType(norm: string): HousingStayType | undefined {
  const candidates: { type: HousingStayType; re: RegExp }[] = [
    { type: 'pg', re: /\b(?:pg|paying guest|co ?living)\b/ },
    { type: 'hostel', re: /\bhostels?\b/ },
    { type: 'flat', re: /\b(?:flat|flats|apartment|apartments|\d ?bhk|bhk|\d ?rk|independent house|house|villa)\b/ },
  ];
  let best: { type: HousingStayType; at: number } | null = null;
  for (const { type, re } of candidates) {
    const hit = re.exec(norm);
    if (hit && (!best || hit.index < best.at)) best = { type, at: hit.index };
  }
  return best?.type;
}

const GIRLS = /\b(?:girls?|ladies|lady|females?|women|ladki|ladkiyan|ladkiyon|ladkiyo|gals?)\b/g;
const BOYS = /\b(?:boys?|gents|gent|males?|men|ladka|ladke|ladkon|ladko)\b/g;
const NEGATION_BEFORE = /(?:\bno|\bnot for|\bnot allowed for|\bexcept|\bwithout)\s+$/;

function positiveMentions(norm: string, re: RegExp): number {
  let count = 0;
  for (const hit of norm.matchAll(re)) {
    const before = norm.slice(Math.max(0, hit.index - 20), hit.index);
    const after = norm.slice(hit.index + hit[0].length, hit.index + hit[0].length + 16);
    if (NEGATION_BEFORE.test(before) || /^\s+not allowed\b/.test(after)) continue;
    count += 1;
  }
  return count;
}

function detectGender(norm: string): GenderPref | undefined {
  if (/\b(?:co ?living|unisex|any gender|both genders?|boys (?:and|or|n) girls|girls (?:and|or|n) boys|male (?:or|and) female|female (?:or|and) male|anyone can (?:stay|apply|join))\b/.test(norm)) return 'anyone';
  const girls = positiveMentions(norm, GIRLS);
  const boys = positiveMentions(norm, BOYS);
  if (girls > 0 && boys > 0) return 'anyone';
  if (girls > 0) return 'girls';
  if (boys > 0) return 'boys';
  return undefined;
}

function detectRules(lower: string, norm: string): HouseRuleOption[] | undefined {
  const found = new Set<HouseRuleOption>();
  if (/\bno smok(?:ing|e)\b|\bsmoking (?:is )?(?:not allowed|prohibited|strictly not allowed)\b|\bnon smok(?:ers?|ing)\b|\bsmoking (?:allowed )?nahi\b|\bsmoking mana\b/.test(norm)) found.add('no_smoking');
  if (/\bno (?:drinking|alcohol|drinks|liquor|boozing|daaru|daru)\b|\b(?:drinking|alcohol|drinks) (?:is |are )?(?:not allowed|prohibited)\b/.test(norm)) found.add('no_drinking');
  if (/\bno (?:overnight )?(?:guests?|visitors?|outsiders)\b|\b(?:guests?|visitors?) (?:are |is )?not allowed\b/.test(norm)) found.add('no_overnight_guests');
  const noCurfew = /\bno (?:curfew|in ?time|timings?|time restrictions?)\b/.test(norm);
  if (!noCurfew && /\b(?:curfew|gate (?:closes?|closing)|in ?time|entry (?:before|till|until)|back by)\b/.test(norm)) found.add('curfew');
  if (/\bquiet hours\b|\bsilence after\b/.test(norm)) found.add('quiet_hours');
  const vegOnly =
    /\b(?:pure|strictly|strict|only|sirf|purely)\s*veg(?:etarian)?\b(?!\s*(?:and|&|\/|or|n)\s*non)/.test(lower) ||
    /\bveg(?:etarian)?\s*only\b/.test(lower) ||
    /\bno\s*non[\s-]?veg\b/.test(lower) ||
    /\bnon[\s-]?veg\s*(?:is\s*)?(?:not allowed|nahi|not permitted|prohibited|allowed nahi)\b/.test(lower);
  if (vegOnly) found.add('veg_only');
  if (found.size === 0 && (noCurfew || /\bno (?:restrictions?|rules)\b|\bfull freedom\b/.test(norm))) found.add(NO_RESTRICTIONS);
  if (found.size === 0) return undefined;
  return HOUSE_RULES.filter((rule) => found.has(rule));
}

const SHARING_RE = /\b(\d|single|double|twin|triple|four|quad|ek|do|teen)\s*(?:sharing|share|occupancy|seater)\b/g;

/** People per room. With several options listed, the one on the rent line wins. */
function detectSharing(norm: string, rentLine: string | null): number | undefined {
  const valueOf = (text: string): number | undefined => {
    for (const hit of text.matchAll(SHARING_RE)) {
      const value = countValue(hit[1]);
      if (value !== null && value >= 1 && value <= 10) return value;
    }
    return undefined;
  };
  const onRentLine = rentLine ? valueOf(normalize(rentLine)) : undefined;
  if (onRentLine !== undefined) return onRentLine;
  const first = valueOf(norm);
  if (first !== undefined) return first;
  if (/\b(?:private|single) room\b/.test(norm)) return 1;
  return undefined;
}

function detectBeds(norm: string): number | undefined {
  const count = String.raw`(\d|a|an|one|two|three|four|ek|do|teen)`;
  const direct = new RegExp(String.raw`\b${count}\s*(?:beds?|spots?|vacanc(?:y|ies)|seats?|slots?)\b(?!\s*(?:room|flat|house|apartment))`).exec(norm);
  const wanted = new RegExp(String.raw`\b(?:need|needed|looking for|require|required|want|wanted|searching for)\s*${count}\s*(?:more\s*)?(?:room ?mates?|flat ?mates?|girls?|boys?|people|persons?|members?|person|guys?|students?|ladies)\b`).exec(norm);
  const hinglish = new RegExp(String.raw`\b${count}\s*(?:room ?mates?|flat ?mates?|girls?|boys?|ladki|ladka|log|people|person)\s*(?:chahiye|chaiye|needed|required|wanted)\b`).exec(norm);
  const hit = direct ?? wanted ?? hinglish;
  if (!hit) return undefined;
  const value = countValue(hit[1]);
  return value !== null && value >= 1 && value <= 20 ? value : undefined;
}

function detectRentTerms(lower: string): RentTermsKind | undefined {
  if (/\bnon[\s-]?negotiable\b|\bnot negotiable\b|\bfixed (?:rent|price)\b|\brent (?:is )?fixed\b/.test(lower)) return 'fixed';
  if (/\b(?:slightly|little|a little|bit|a bit|thoda|thoda sa|somewhat)\s+(?:negotiable|nego)\b/.test(lower)) return 'slightly_negotiable';
  if (/\bnegotiable\b|\bnego\b/.test(lower)) return 'negotiable';
  return undefined;
}

function detectFurnishing(norm: string): Furnishing | undefined {
  if (/\bsemi ?furnished\b/.test(norm)) return 'semi_furnished';
  if (/\b(?:unfurnished|un furnished|non furnished|not furnished)\b/.test(norm)) return 'unfurnished';
  if (/\bfurnished\b/.test(norm)) return 'furnished';
  return undefined;
}

const DOOR_NUMBER = /\b(?:door|house|flat|plot|site|room|apartment|apt)\s*(?:no\.?|number|num|#)\s*[:\-]?\s*\d+|\bh\.?\s*no\.?\s*[:\-]?\s*\d+|#\s*\d+|\bno\.\s*\d+/;

function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end < 0 ? text.length : end);
}

// ---------------------------------------------------------------------------

/**
 * Parses a pasted WhatsApp housing post. `landmarks` are the poster's campus
 * landmarks (catalog). Only fields the text states are filled.
 */
export function parseWhatsAppPost(text: string, landmarks: readonly Landmark[], options: ParseOptions = {}): ParsedWhatsAppPost {
  const now = options.now ?? new Date();
  const { cleaned, blanked, phones } = stripPhones(text ?? '');
  const lower = blanked.toLowerCase().replace(/[‘’]/g, "'");
  const norm = normalize(blanked);
  const flags: ParseFlag[] = [];
  const draft: HousingDraft = {};

  // Money first: brokerage and month-based deposits depend on the rent.
  const tokens = moneyTokens(lower);
  const rentToken = tokens.find((token) => token.label === 'rent') ?? tokens.find((token) => token.label === null && token.marked);
  if (rentToken) draft.rentPp = rentToken.value;
  const depositToken = tokens.find((token) => token.label === 'deposit');
  if (depositToken) draft.deposit = depositToken.value;
  else if (/\b(?:no|zero|without|nil)\s+(?:security\s+)?deposit\b|\bdeposit\s*(?:-|:)?\s*(?:nil|none|zero)\b/.test(lower)) draft.deposit = 0;
  else {
    const months = monthsOf(lower, 'deposit|advance|security');
    if (months !== null && draft.rentPp !== undefined) draft.deposit = months * draft.rentPp;
  }

  const brokerage = detectBrokerage(norm, lower, tokens, draft.rentPp);
  const place = findPlace(norm, landmarks);
  // Mask the place name so 'Navajyothi hostel' does not read as a hostel stay.
  const normNoPlace = place ? `${` ${norm} `.slice(0, place.start)}${' '.repeat(place.end - place.start + 1)}${` ${norm} `.slice(place.end + 1)}`.trim() : norm;

  draft.kind = detectKind(normNoPlace);
  draft.postedAs = detectPostedAs(norm, brokerage);
  draft.brokerage = brokerage;
  draft.stayType = detectStayType(normNoPlace);
  draft.whoCanStay = detectGender(norm);
  draft.houseRules = detectRules(lower, norm);
  draft.moveIn = parseMoveIn(lower, now) ?? undefined;
  draft.bedsLeft = detectBeds(norm);
  draft.sharing = detectSharing(norm, rentToken ? lineAt(lower, rentToken.start) : null);
  draft.rentTerms = detectRentTerms(lower);
  draft.furnishing = detectFurnishing(norm);

  if (place) {
    draft.place = { landmarkId: place.landmark.id, area: place.landmark.area };
  } else {
    const typed = /(?:^|\n)\s*(?:location|area|loc|locality)\s*[:\-–]\s*([^\n,]{2,60})/i.exec(cleaned);
    if (typed) draft.place = { landmarkId: 'other', area: typed[1].trim() };
  }

  // Keep only the stated fields, in form order.
  const out: HousingDraft = {};
  const filled: HousingDraftField[] = [];
  for (const field of DRAFT_FIELDS) {
    const value = draft[field];
    if (value === undefined) continue;
    (out as Record<string, unknown>)[field] = value;
    filled.push(field);
  }

  if (phones.length > 0) flags.push('phone_removed');
  if (DOOR_NUMBER.test(lower)) flags.push('door_number');
  if (out.postedAs === 'agent' && !out.brokerage) flags.push('brokerage_unclear');

  const result: ParsedWhatsAppPost = { draft: out, filled, cleanedDescription: cleaned, flags };
  if (phones.length > 0) result.phone = phones[0];
  return result;
}
