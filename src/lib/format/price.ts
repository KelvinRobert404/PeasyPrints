// Price helpers. Pure leaf module: no imports, safe for node tests.
// Prices are whole rupees and always read 'Rs 1.5k', never with the rupee sign.

export type PriceSuffix = 'pp' | 'dep' | '/mo';

const THOUSAND = 1_000;
const LAKH = 1_00_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum fair price for a pass that is still valid. */
export const MIN_PASS_PRICE = 10;

/** One decimal, no trailing '.0' (1.5 -> '1.5', 12 -> '12'). */
function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * formatPrice(650) -> 'Rs 650', formatPrice(1500) -> 'Rs 1.5k',
 * formatPrice(120000) -> 'Rs 1.2L', formatPrice(8500, 'pp') -> 'Rs 8.5k pp',
 * formatPrice(0) -> 'Free'. Negative or non-numeric input reads as 0.
 */
export function formatPrice(n: number, suffix?: PriceSuffix): string {
  const rupees = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  if (rupees === 0) return 'Free';

  let body: string;
  if (rupees < THOUSAND) {
    body = String(rupees);
  } else {
    const inK = Math.round(rupees / 100) / 10;
    // 99,960 rounds to 100k: show it as 1L instead.
    body = inK < 100 ? `${oneDecimal(inK)}k` : `${oneDecimal(rupees / LAKH)}L`;
  }

  const price = `Rs ${body}`;
  return suffix ? `${price} ${suffix}` : price;
}

const UNIT_MULTIPLIER: Record<string, number> = {
  k: THOUSAND,
  thousand: THOUSAND,
  l: LAKH,
  lac: LAKH,
  lacs: LAKH,
  lakh: LAKH,
  lakhs: LAKH,
};

const NUMBER_PATTERN = String.raw`(\d[\d,]*(?:\.\d+)?|\.\d+)`;
const UNIT_PATTERN = String.raw`(k|thousand|lakhs?|lacs?|l)`;
const CURRENCY_PATTERN = String.raw`(?:rs\.?|inr|₹)`;

/** Turns a number string and an optional unit into whole rupees, or null. */
function toRupees(numberText: string, unit: string | undefined): number | null {
  const digits = numberText.replace(/,/g, '');
  if (digits === '' || digits === '.') return null;
  const value = Number(digits);
  if (!Number.isFinite(value) || value < 0) return null;
  const multiplier = unit ? UNIT_MULTIPLIER[unit.toLowerCase()] : 1;
  if (multiplier === undefined) return null;
  return Math.round(value * multiplier);
}

const PRICE_INPUT = new RegExp(
  String.raw`^${CURRENCY_PATTERN}?\s*${NUMBER_PATTERN}\s*${UNIT_PATTERN}?\s*(?:\/-)?$`,
  'i',
);

/**
 * Reads what a student types in a price box.
 * '1.5k' -> 1500, '1L' -> 100000, '1.2 lakh' -> 120000, '12,000' -> 12000,
 * 'Rs 8.5k' -> 8500, '₹900' -> 900. Anything else -> null.
 */
export function parsePriceInput(input: string): number | null {
  if (typeof input !== 'string') return null;
  const match = PRICE_INPUT.exec(input.trim());
  if (!match) return null;
  return toRupees(match[1], match[2]);
}

export type PriceQuery = {
  min?: number;
  max?: number;
  /** The search text with the price words taken out. */
  rest: string;
};

const PRICE_TOKEN = String.raw`${CURRENCY_PATTERN}?\s*${NUMBER_PATTERN}\s*${UNIT_PATTERN}?(?![\w.])`;
const MAX_WORDS = String.raw`(?:\b(?:under|below|upto|up\s+to|within|less\s+than|max)\b|<=?|≤)`;
const MIN_WORDS = String.raw`(?:\b(?:above|over|more\s+than|min)\b|>=?|≥)`;

/**
 * Pulls a price limit out of a search.
 * 'cycle under 12k' -> { max: 12000, rest: 'cycle' }
 * 'room above 5k' -> { min: 5000, rest: 'room' }
 * A limit word with no price after it stays in rest.
 */
export function parsePriceQuery(query: string): PriceQuery {
  let rest = typeof query === 'string' ? query : '';
  const result: PriceQuery = { rest: '' };

  const take = (words: string, key: 'min' | 'max') => {
    const pattern = new RegExp(`${words}\\s*${PRICE_TOKEN}`, 'gi');
    rest = rest.replace(pattern, (whole: string, numberText: string, unit: string | undefined) => {
      const rupees = toRupees(numberText, unit);
      if (rupees === null) return whole;
      result[key] = rupees;
      return ' ';
    });
  };

  take(MAX_WORDS, 'max');
  take(MIN_WORDS, 'min');

  result.rest = rest.replace(/\s+/g, ' ').trim();
  return result;
}

export type PassPriceInput = {
  paid: number;
  validFrom: Date | string | number;
  validUntil: Date | string | number;
  now: Date | string | number;
};

function toTime(value: Date | string | number): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Fair resale price for a pass: what was paid, pro-rata by days left.
 * 12 of 30 days left on Rs 3000 -> 1200. A pass that is still valid never
 * goes below Rs 10 (or what was paid, if less). An expired pass is worth 0.
 * A part day left counts as a whole day.
 */
export function fairPassPrice({ paid, validFrom, validUntil, now }: PassPriceInput): number {
  const from = toTime(validFrom);
  const until = toTime(validUntil);
  const at = toTime(now);
  if (![from, until, at, paid].every(Number.isFinite) || paid <= 0) return 0;

  const totalDays = Math.round((until - from) / DAY_MS);
  if (totalDays <= 0 || at >= until) return 0;

  const daysLeft = Math.min(totalDays, Math.ceil((until - at) / DAY_MS));
  const proRata = Math.floor((paid * daysLeft) / totalDays);
  return Math.min(Math.round(paid), Math.max(MIN_PASS_PRICE, proRata));
}

/** True only when the new price is strictly lower than the old one. */
export function isPriceDrop(prev: number | null | undefined, next: number | null | undefined): boolean {
  if (typeof prev !== 'number' || typeof next !== 'number') return false;
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return false;
  return next < prev;
}
