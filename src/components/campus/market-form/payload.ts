// New listing form v2: form state -> market create payload. Pure module, no
// React, so node tests can load it. Runtime imports are relative with the .ts
// extension; '@/...' only as `import type`.

import type { CampusAudience, GenderPref } from '@/types/campus';
import type { ItemCondition, MarketCategory, MarketKind, PassType, PriceTerms, VehicleOffer, VehicleType } from '@/types/market';
import type { DocumentValidity, Instant } from '@/lib/campus/listingRules';
import type { PlateStateCode } from '@/lib/campus/market';
import { marketCreateSchema, type MarketCreate } from '../../../lib/campus/marketSchema.ts';
import {
  DEFAULT_PLATE_STATE,
  MARKET_KINDS,
  MAX_BUNDLE_ITEMS,
  MAX_BUNDLE_PHOTOS,
  MAX_LISTING_PHOTOS,
  PLATE_STATE_CODES,
} from '../../../lib/campus/market.ts';
import { documentValidity } from '../../../lib/campus/listingRules.ts';
import { fairPassPrice, formatPrice, parsePriceInput } from '../../../lib/format/price.ts';
import { askText } from '../../../lib/search/campusSearch.ts';

/** Every kind the form builds, in the same order as MARKET_KINDS' picker. */
export const FORM_KINDS = [
  'item',
  'wanted',
  'bundle',
  'seat',
  'cab_split',
  'ticket',
  'pass',
  'vehicle',
] as const satisfies readonly MarketKind[];
export type FormKind = (typeof FORM_KINDS)[number];

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 1000;
export const HAND_OVER_MAX = 80;
export const BUNDLE_PART_TITLE_MAX = 60;
/** From and to on a seat. Two of them plus 'Train from … to …' fit seatFor's 80. */
export const PLACE_MAX = 32;
export const OPERATOR_MAX = 60;
export const VENUE_MAX = 80;
export const PROVIDER_MAX = 60;

/** Room left in the description box once the kind's own detail lines are added. */
export const BUNDLE_DESCRIPTION_MAX = DESCRIPTION_MAX - 120;

export const SEAT_COUNT_MAX = 4;
export const CAB_SIZE_MIN = 2;
export const CAB_SIZE_MAX = 6;
export const TICKET_COUNT_MAX = 6;

/** Campus times are India time. */
const IST_OFFSET = '+05:30';
const IST_OFFSET_MS = 330 * 60 * 1000;

export type TripMode = 'bus' | 'train';
export type CabDirection = 'to_airport' | 'from_airport';
export type FormPassType = 'mess' | 'gym';
export type FormVehicleType = 'cycle' | 'scooter' | 'bike' | 'car';

/** Vehicle types the form treats as motor: plate state, RC and insurance. */
export const FORM_MOTOR_TYPES: readonly FormVehicleType[] = ['scooter', 'bike', 'car'];

export function isMotorType(type: FormVehicleType): boolean {
  return FORM_MOTOR_TYPES.includes(type);
}

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
  // seat and cab split
  tripMode: TripMode;
  from: string;
  to: string;
  /** From a datetime-local box, 'YYYY-MM-DDTHH:mm', India time. */
  departure: string;
  /** Bus operator or train name/number. Folded into the description. */
  operator: string;
  /** Seats on offer (seat) or seats still free (cab split). */
  seatsLeft: number;
  cabDirection: CabDirection;
  /** People sharing the cab, the poster included. */
  cabSize: number;
  // ticket
  venue: string;
  /** From a datetime-local box, India time. */
  showtime: string;
  /** Printed price per ticket. */
  faceValue: number | null;
  quantity: number;
  // pass
  passType: FormPassType;
  /** Mess or gym name. Folded into the description. */
  provider: string;
  paid: number | null;
  /** 'YYYY-MM-DD' or empty. */
  validFrom: string;
  /** 'YYYY-MM-DD' or empty. */
  validUntil: string;
  /** Last fair price the form filled in, so it knows when the student typed their own. */
  passAutoPrice: number | null;
  // vehicle
  vehicleType: FormVehicleType;
  offer: VehicleOffer;
  plateState: PlateStateCode;
  /** RC with the seller. Null until answered. Motor types only. */
  rcWithSeller: boolean | null;
  /** 'YYYY-MM-DD' or empty. Motor types only. Folded into the description. */
  insuranceUntil: string;
}

export type BuildResult =
  | { ok: true; payload: MarketCreate }
  | { ok: false; error: string; field: string | null };

export interface BuildOptions {
  /** Defaults to the current time. */
  now?: Instant;
  /** Session campus label, e.g. 'KJU Main'. The cab's campus end when no place is picked. */
  campusLabel?: string | null;
  /** Label of the picked landmark. The cab's campus end. */
  placeLabel?: string | null;
}

const KIND_ALIASES: Record<string, FormKind> = {
  item: 'item',
  sell: 'item',
  wanted: 'wanted',
  ask: 'wanted',
  bundle: 'bundle',
  room: 'bundle',
  clear_out: 'bundle',
  seat: 'seat',
  cab_split: 'cab_split',
  cab: 'cab_split',
  ticket: 'ticket',
  pass: 'pass',
  vehicle: 'vehicle',
};

function firstValue(raw: string | string[] | undefined | null): string {
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : '';
  return typeof raw === 'string' ? raw : '';
}

/** ?kind=wanted -> 'wanted', ?kind=cab -> 'cab_split'. Unknown kinds -> null. */
export function parseKindParam(raw: string | string[] | undefined | null): FormKind | null {
  const value = firstValue(raw).trim().toLowerCase().replace(/-/g, '_');
  return KIND_ALIASES[value] ?? null;
}

/** True for any market kind id. */
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

/** Longest description the student may type. Kinds that add detail lines leave room for them. */
export function descriptionMaxFor(kind: FormKind): number {
  return kind === 'item' || kind === 'wanted' ? DESCRIPTION_MAX : BUNDLE_DESCRIPTION_MAX;
}

/** Price terms each kind offers. A cab split is always per person. */
export function priceTermsFor(kind: FormKind): readonly PriceTerms[] {
  switch (kind) {
    case 'wanted':
      return ['negotiable', 'fixed'];
    case 'bundle':
    case 'ticket':
      return ['fixed', 'negotiable', 'free'];
    case 'cab_split':
      return ['per_person'];
    case 'seat':
    case 'pass':
    case 'vehicle':
      return ['fixed', 'negotiable'];
    default:
      return ['fixed', 'negotiable', 'free', 'swap'];
  }
}

export function isFreeTerms(terms: PriceTerms): boolean {
  return terms === 'free' || terms === 'swap';
}

/** Kinds whose category the form sets itself, so the category chips stay hidden. */
export function autoCategory(state: Pick<MarketFormState, 'kind' | 'passType' | 'vehicleType'>): MarketCategory | null {
  switch (state.kind) {
    case 'seat':
    case 'cab_split':
      return 'travel';
    case 'ticket':
      return 'other';
    case 'pass':
      return state.passType === 'gym' ? 'sports_fitness' : 'other';
    case 'vehicle':
      return state.vehicleType === 'cycle' ? 'cycles' : 'other';
    default:
      return null;
  }
}

/** Seats a kind can offer: a seat 1 to 4, a cab one less than the people in it. */
export function seatsLeftMax(state: Pick<MarketFormState, 'kind' | 'cabSize'>): number {
  return state.kind === 'cab_split' ? Math.max(1, state.cabSize - 1) : SEAT_COUNT_MAX;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));
}

let rowCounter = 0;
export function newBundleRow(title = '', priceText = ''): BundleRow {
  rowCounter += 1;
  return { id: `row-${rowCounter}`, title, priceText };
}

export function initialFormState(kind: FormKind, audience: CampusAudience, title = ''): MarketFormState {
  const base: MarketFormState = {
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
    tripMode: 'bus',
    from: '',
    to: '',
    departure: '',
    operator: '',
    seatsLeft: 1,
    cabDirection: 'to_airport',
    cabSize: 4,
    venue: '',
    showtime: '',
    faceValue: null,
    quantity: 1,
    passType: 'mess',
    provider: '',
    paid: null,
    validFrom: '',
    validUntil: '',
    passAutoPrice: null,
    vehicleType: 'cycle',
    offer: 'sale',
    plateState: DEFAULT_PLATE_STATE,
    rcWithSeller: null,
    insuranceUntil: '',
  };
  return { ...base, category: autoCategory(base) ?? base.category };
}

/** Moves the shared fields to another kind and fixes what no longer fits. */
export function switchKind(state: MarketFormState, kind: FormKind): MarketFormState {
  if (state.kind === kind) return state;
  const terms = priceTermsFor(kind);
  const priceTerms = terms.includes(state.priceTerms) ? state.priceTerms : terms[0];
  const next: MarketFormState = {
    ...state,
    kind,
    priceTerms,
    price: isFreeTerms(priceTerms) ? null : state.price,
    images: state.images.slice(0, maxPhotosFor(kind)),
  };
  return {
    ...next,
    seatsLeft: clamp(next.seatsLeft, 1, seatsLeftMax(next)),
    category: autoCategory(next) ?? (autoCategory(state) ? 'other' : state.category),
  };
}

// ---------------------------------------------------------------- dates

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' that names a real calendar day. */
function realDay(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** '2026-11-20' -> '20 Nov'. Null when it is not a real date. */
export function formatDay(value: string): string | null {
  const day = realDay(value);
  return day ? `${day.day} ${MONTHS[day.month - 1]}` : null;
}

/** '2027-03-05' -> '5 Mar 2027'. Null when it is not a real date. */
export function formatDayYear(value: string): string | null {
  const day = realDay(value);
  return day ? `${day.day} ${MONTHS[day.month - 1]} ${day.year}` : null;
}

/**
 * A datetime-local value, read as India time:
 * '2026-11-20T18:30' -> '2026-11-20T18:30:00+05:30'. Null when it is not a real time.
 */
export function istDateTime(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value.trim());
  if (!match || !realDay(match[1])) return null;
  const [, day, hour, minute, second = '00'] = match;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  const iso = `${day}T${hour}:${minute}:${second}${IST_OFFSET}`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

/** Start and end of an India day, in ms. */
function dayStartMs(value: string): number {
  return Date.parse(`${value.trim()}T00:00:00.000${IST_OFFSET}`);
}
function dayEndMs(value: string): number {
  return Date.parse(`${value.trim()}T23:59:59.999${IST_OFFSET}`);
}

function toMs(value: Instant | undefined): number {
  if (value === undefined) return Date.now();
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' ? value : Date.parse(value);
}

/** Today in India as 'YYYY-MM-DD', for date box minimums. */
export function istToday(now: Instant): string {
  return new Date(toMs(now) + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Now in India as 'YYYY-MM-DDTHH:mm', for datetime-local minimums. */
export function istNowLocal(now: Instant): string {
  return new Date(toMs(now) + IST_OFFSET_MS).toISOString().slice(0, 16);
}

// ---------------------------------------------------------------- pass price

type PassPriceFields = Pick<MarketFormState, 'paid' | 'validFrom' | 'validUntil'>;

/**
 * Fair price for the pass right now: what was paid, pro-rata by the days left.
 * Null until paid and both dates are filled; 0 once the pass has ended.
 */
export function passFairPrice(state: PassPriceFields, now: Instant): number | null {
  if (state.paid === null || state.paid <= 0) return null;
  if (!realDay(state.validFrom) || !realDay(state.validUntil)) return null;
  return fairPassPrice({
    paid: state.paid,
    validFrom: dayStartMs(state.validFrom),
    validUntil: dayEndMs(state.validUntil),
    now: toMs(now),
  });
}

/**
 * The patch for a change to what was paid or the pass dates. The price follows
 * the fair price until the student types a price of their own.
 */
export function passChange(
  state: MarketFormState,
  patch: Partial<PassPriceFields>,
  now: Instant,
): Partial<MarketFormState> {
  const fair = passFairPrice({ ...state, ...patch }, now);
  const auto = fair !== null && fair > 0 ? fair : null;
  const following = state.price === null || state.price === state.passAutoPrice;
  return { ...patch, passAutoPrice: auto, ...(following ? { price: auto } : {}) };
}

/** True when the asking price is over the fair price. A warning, never a block. */
export function aboveFairPrice(state: MarketFormState, now: Instant): boolean {
  const fair = passFairPrice(state, now);
  return fair !== null && fair > 0 && state.price !== null && state.price > fair;
}

/** True when a ticket is priced over its face value. Posting is blocked. */
export function aboveFaceValue(state: Pick<MarketFormState, 'price' | 'faceValue'>): boolean {
  return state.faceValue !== null && state.price !== null && state.price > state.faceValue;
}

/** Insurance validity for a motor vehicle, or null when no real date is given. */
export function insuranceValidity(insuranceUntil: string, now: Instant): DocumentValidity | null {
  if (!realDay(insuranceUntil)) return null;
  return documentValidity(insuranceUntil.trim(), toMs(now));
}

// ---------------------------------------------------------------- description

/** The student's text, then the kind's own detail lines. */
export function composeDescription(description: string, lines: readonly string[]): string {
  return [description.trim(), ...lines].filter(Boolean).join('\n');
}

function oneLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** The description sent for a bundle: the student's text, then the hand-over and date lines. */
export function bundleDescription(description: string, handOver: string, availableUntil: string): string {
  const lines: string[] = [];
  const where = oneLine(handOver);
  if (where) lines.push(`Hand over: ${where}`);
  const day = formatDay(availableUntil);
  if (day) lines.push(`Available till ${day}`);
  return composeDescription(description, lines);
}

/** Detail lines the schema has no field for yet, so buyers still see them. */
export function detailLines(state: MarketFormState, now: Instant): string[] {
  const lines: string[] = [];
  switch (state.kind) {
    case 'seat': {
      const operator = oneLine(state.operator);
      if (operator) lines.push(`${state.tripMode === 'train' ? 'Train' : 'Operator'}: ${operator}`);
      if (state.tripMode === 'train') lines.push('Name change rules apply');
      break;
    }
    case 'cab_split':
      lines.push(`Fare split ${state.cabSize} ways`);
      break;
    case 'pass': {
      const provider = oneLine(state.provider);
      const label = state.passType === 'gym' ? 'Gym pass' : 'Mess pass';
      lines.push(provider ? `${label} from ${provider}` : label);
      const from = formatDay(state.validFrom);
      const until = formatDay(state.validUntil);
      if (state.paid !== null && state.paid > 0 && from && until) {
        lines.push(`Paid ${formatPrice(state.paid)} for ${from} to ${until}`);
      }
      break;
    }
    case 'vehicle': {
      if (!isMotorType(state.vehicleType)) break;
      if (state.vehicleType === 'car') lines.push('Car');
      if (state.rcWithSeller !== null) lines.push(state.rcWithSeller ? 'RC with seller' : 'RC not with seller');
      const validity = insuranceValidity(state.insuranceUntil, now);
      if (validity === 'expired') lines.push('Insurance lapsed');
      else if (validity) lines.push(`Insurance till ${formatDayYear(state.insuranceUntil)}`);
      break;
    }
    default:
      break;
  }
  return lines;
}

// ---------------------------------------------------------------- build

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
  seatFor: 'Check where the seat goes',
  departureAt: 'Pick when it leaves',
  seatsLeft: 'Check the seat count',
  from: 'Check where it starts',
  to: 'Check where it goes',
  totalFare: 'Check the fare',
  happensAt: 'Pick the showtime',
  venue: 'Keep the venue short',
  quantity: 'Check how many tickets',
  faceValue: 'Check the face value',
  passType: 'Pick mess or gym',
  validUntil: 'Pick a real date',
  vehicleType: 'Pick a vehicle type',
  offer: 'Pick sell or rent',
  plateState: 'Pick the plate state',
};

function fail(error: string, field: string | null): BuildResult {
  return { ok: false, error, field };
}

const PASS_TYPE: Record<FormPassType, PassType> = { mess: 'other', gym: 'gym' };
const VEHICLE_TYPE: Record<FormVehicleType, VehicleType> = { cycle: 'cycle', scooter: 'scooter', bike: 'bike', car: 'other' };

/**
 * Builds the POST body for /api/marketplace/listings and checks it with
 * marketCreateSchema, so the form shows the same errors the server would.
 */
export function buildMarketPayload(state: MarketFormState, options: BuildOptions = {}): BuildResult {
  const now = toMs(options.now);
  const free = isFreeTerms(state.priceTerms);
  const price = free ? null : state.price;
  const girls = state.audience === 'girls';
  const savedNumber = state.useSavedNumber;
  const number = state.whatsappNumber.trim();
  if (!savedNumber && !number) return fail('Add your WhatsApp number', 'whatsappNumber');

  const base = {
    title: state.title.trim(),
    category: autoCategory(state) ?? state.category,
    price,
    priceTerms: state.priceTerms,
    // Girls' space posts are always for girls.
    genderPref: girls ? ('girls' as const) : state.genderPref,
    images: state.images,
    ...(state.landmarkId ? { landmarkId: state.landmarkId } : {}),
    ...(savedNumber ? { useSavedNumber: true } : { whatsappNumber: number }),
  };
  const described = (lines: readonly string[]) => composeDescription(state.description, lines) || undefined;

  /** A future India time from a datetime-local box, or a failure. */
  const futureTime = (value: string, field: string, missing: string, passed: string): string | BuildResult => {
    const iso = istDateTime(value);
    if (!iso) return fail(missing, field);
    if (Date.parse(iso) <= now) return fail(passed, field);
    return iso;
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
    case 'seat': {
      const from = oneLine(state.from);
      const to = oneLine(state.to);
      if (!from) return fail('Add where it leaves from', 'from');
      if (!to) return fail('Add where it goes', 'to');
      if (from.length > PLACE_MAX || to.length > PLACE_MAX) return fail('Keep place names short', from.length > PLACE_MAX ? 'from' : 'to');
      if (oneLine(state.operator).length > OPERATOR_MAX) return fail('Keep the operator name short', 'operator');
      const departureAt = futureTime(state.departure, 'departure', 'Pick when it leaves', 'That time has passed');
      if (typeof departureAt !== 'string') return departureAt;
      const mode = state.tripMode === 'train' ? 'Train' : 'Bus';
      input = {
        ...base,
        kind: 'seat',
        description: described(detailLines(state, now)),
        seatFor: `${mode} from ${from} to ${to}`,
        departureAt,
        endsAt: null,
        seatsLeft: state.seatsLeft,
      };
      break;
    }
    case 'cab_split': {
      const departureAt = futureTime(state.departure, 'departure', 'Pick when the cab leaves', 'That time has passed');
      if (typeof departureAt !== 'string') return departureAt;
      if (state.cabSize < CAB_SIZE_MIN || state.cabSize > CAB_SIZE_MAX) return fail('Check how many share the cab', 'cabSize');
      if (state.seatsLeft >= state.cabSize) return fail('More seats left than in the cab', 'seatsLeft');
      // The campus end is the picked place, else the session campus. Never asked.
      const here = oneLine(options.placeLabel ?? '') || oneLine(options.campusLabel ?? '') || 'Campus';
      const campusEnd = here.slice(0, 80);
      const toAirport = state.cabDirection === 'to_airport';
      input = {
        ...base,
        kind: 'cab_split',
        priceTerms: 'per_person',
        description: described(detailLines(state, now)),
        from: toAirport ? campusEnd : 'Airport',
        to: toAirport ? 'Airport' : campusEnd,
        departureAt,
        seatsLeft: state.seatsLeft,
        totalFare: price === null ? null : price * state.cabSize,
      };
      break;
    }
    case 'ticket': {
      const venue = oneLine(state.venue);
      if (venue.length > VENUE_MAX) return fail('Keep the venue short', 'venue');
      const happensAt = futureTime(state.showtime, 'showtime', 'Pick the showtime', 'The show has already started');
      if (typeof happensAt !== 'string') return happensAt;
      if (state.faceValue === null || state.faceValue < 1) return fail('Add the face value', 'faceValue');
      if (aboveFaceValue({ price, faceValue: state.faceValue })) return fail('Price cannot be above face value', 'price');
      input = {
        ...base,
        kind: 'ticket',
        description: described([]),
        happensAt,
        venue: venue || null,
        quantity: state.quantity,
        faceValue: state.faceValue,
      };
      break;
    }
    case 'pass': {
      if (oneLine(state.provider).length > PROVIDER_MAX) return fail('Keep the name short', 'provider');
      if (!realDay(state.validFrom)) return fail('Add when the pass started', 'validFrom');
      if (!realDay(state.validUntil)) return fail('Add when the pass ends', 'validUntil');
      if (dayEndMs(state.validUntil) < dayStartMs(state.validFrom)) return fail('End must be after the start', 'validUntil');
      if (dayEndMs(state.validUntil) <= now) return fail('This pass has ended', 'validUntil');
      input = {
        ...base,
        kind: 'pass',
        description: described(detailLines(state, now)),
        passType: PASS_TYPE[state.passType],
        validUntil: state.validUntil.trim(),
      };
      break;
    }
    case 'vehicle': {
      if (!state.landmarkId) return fail('Pick a place from the list', 'landmarkId');
      const motor = isMotorType(state.vehicleType);
      if (motor && !PLATE_STATE_CODES.includes(state.plateState)) return fail('Pick the plate state', 'plateState');
      if (motor && state.insuranceUntil.trim() && !realDay(state.insuranceUntil)) return fail('Pick a real date', 'insuranceUntil');
      input = {
        ...base,
        kind: 'vehicle',
        description: described(detailLines(state, now)),
        vehicleType: VEHICLE_TYPE[state.vehicleType],
        offer: state.offer,
        year: null,
        kmDriven: null,
        papersOk: motor ? state.rcWithSeller : null,
        ...(motor ? { plateState: state.plateState } : {}),
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
