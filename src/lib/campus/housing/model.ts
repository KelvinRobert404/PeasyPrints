// Housing model for the KADA-18 redesign: option ids, labels and small display
// helpers shared by the create form, cards, detail page and the WhatsApp parser.
// Pure module: node tests import it, so '@/...' only as `import type`.
import type { GenderPref } from '@/types/campus';
import type { Furnishing, HouseRule, HousingPostedAs, HousingStayType } from '@/types/housing';
import { formatPrice } from '../../format/price.ts';
import { GENDER_PREF_LABELS, HOUSE_RULE_LABELS, HOUSING_POSTED_AS_LABELS } from '../constants.ts';
import { istDateKey, moveInLabel } from '../season.ts';
import type { MoveInChoice } from '../season.ts';

/** What the post offers. */
export const HOUSING_KINDS = ['room', 'roommate', 'replacement', 'sublet'] as const;
export type HousingKind = (typeof HOUSING_KINDS)[number];

export const HOUSING_KIND_LABELS: Record<HousingKind, string> = {
  room: 'Room',
  roommate: 'Roommate',
  replacement: 'Replacement',
  sublet: 'Sublet',
};

/** Who is posting. Every poster is a verified student; 'agent' means a broker's listing. */
export const POSTED_AS = ['tenant', 'leaving', 'owner_contact', 'agent'] as const;
export type PostedAs = (typeof POSTED_AS)[number];

export const POSTED_AS_LABELS: Record<PostedAs, string> = {
  ...(HOUSING_POSTED_AS_LABELS satisfies Record<HousingPostedAs, string>),
  agent: 'Agent listing',
};

/** House rules. 'no_restrictions' cannot be combined with any other rule. */
export const HOUSE_RULES = [
  'no_restrictions',
  'no_smoking',
  'no_drinking',
  'no_overnight_guests',
  'curfew',
  'quiet_hours',
  'veg_only',
] as const;
export type HouseRuleOption = (typeof HOUSE_RULES)[number];
export const NO_RESTRICTIONS = 'no_restrictions' satisfies HouseRuleOption;

export const HOUSE_RULE_OPTION_LABELS: Record<HouseRuleOption, string> = {
  no_restrictions: 'No restrictions',
  ...(HOUSE_RULE_LABELS satisfies Record<HouseRule, string>),
};

export const RENT_TERMS = ['fixed', 'negotiable', 'slightly_negotiable'] as const;
export type RentTermsKind = (typeof RENT_TERMS)[number];

export const RENT_TERMS_LABELS: Record<RentTermsKind, string> = {
  fixed: 'Fixed rent',
  negotiable: 'Negotiable',
  slightly_negotiable: 'Slightly negotiable',
};

export const HOUSING_STAY_TYPES = ['pg', 'flat', 'hostel'] as const satisfies readonly HousingStayType[];

export const FURNISHINGS = ['furnished', 'semi_furnished', 'unfurnished'] as const satisfies readonly Furnishing[];

export const FURNISHING_LABELS: Record<Furnishing, string> = {
  furnished: 'Furnished',
  semi_furnished: 'Semi furnished',
  unfurnished: 'Unfurnished',
};

export const WHO_CAN_STAY = ['girls', 'boys', 'anyone'] as const satisfies readonly GenderPref[];

export const WHO_CAN_STAY_LABELS: Record<GenderPref, string> = { ...GENDER_PREF_LABELS };

/** Picking a real rule drops 'no_restrictions'; picking 'no_restrictions' clears the rest. */
export function toggleHouseRule(current: readonly HouseRuleOption[], rule: HouseRuleOption): HouseRuleOption[] {
  if (current.includes(rule)) return current.filter((entry) => entry !== rule);
  if (rule === NO_RESTRICTIONS) return [NO_RESTRICTIONS];
  return [...current.filter((entry) => entry !== NO_RESTRICTIONS), rule];
}

/** True when the rule list is non-empty, has no repeats and keeps 'no_restrictions' alone. */
export function validHouseRules(rules: readonly HouseRuleOption[]): boolean {
  if (rules.length === 0) return false;
  if (new Set(rules).size !== rules.length) return false;
  return !(rules.includes(NO_RESTRICTIONS) && rules.length > 1);
}

export interface HousingPriceInput {
  /** Rent per person, rupees. */
  rentPp: number;
  /** Deposit, rupees. Null when not stated. */
  deposit: number | null;
}

export interface HousingPriceLabels {
  /** 'Rs 8.5k pp'. */
  rent: string;
  /** 'Rs 1.2L dep', 'No deposit', or null when not stated. */
  deposit: string | null;
}

export function housingPriceLabels(item: HousingPriceInput): HousingPriceLabels {
  const rent = formatPrice(item.rentPp, 'pp');
  if (item.deposit === null || !Number.isFinite(item.deposit)) return { rent, deposit: null };
  if (item.deposit <= 0) return { rent, deposit: 'No deposit' };
  return { rent, deposit: formatPrice(item.deposit, 'dep') };
}

// Indian mobile numbers: optional +91 / 91 / 0, then 10 digits starting 6-9,
// either in one run or in the usual groups (5-5, 3-3-4, 4-3-3, 4-6, 2-4-4) split
// by a space, dot or dash ('98450 12345', '+91-98450-12345'). Rigid groups keep
// prices such as 'Rs 8500 9845012345' from swallowing the rent.
const SEP = String.raw`(?:\s?[.-]\s?|\s)`;
const PHONE_BODY = [
  String.raw`\d{9}`,
  String.raw`\d{4}${SEP}\d{5}`,
  String.raw`\d{2}${SEP}\d{3}${SEP}\d{4}`,
  String.raw`\d{3}${SEP}\d{3}${SEP}\d{3}`,
  String.raw`\d{3}${SEP}\d{6}`,
  String.raw`\d${SEP}\d{4}${SEP}\d{4}`,
  // Spaced out digit by digit: '9 8 4 5 0 1 2 3 4 5'.
  String.raw`(?:${SEP}\d){9}`,
].join('|');
export const PHONE_PATTERN_SOURCE = String.raw`(?<![\d+])(?:(?:\+|00)?91${SEP}?|0${SEP}?)?[6-9](?:${PHONE_BODY})(?!\d)`;

/** A fresh global regex for Indian mobile numbers. */
export function phonePattern(): RegExp {
  return new RegExp(PHONE_PATTERN_SOURCE, 'g');
}

export function containsPhoneNumber(text: string): boolean {
  return new RegExp(PHONE_PATTERN_SOURCE).test(text);
}

/** The bare 10-digit number from a phone match ('+91 98450-12345' -> '9845012345'). */
export function normalizePhone(match: string): string {
  return match.replace(/\D/g, '').slice(-10);
}

export interface RoommateChipInput {
  /** 'now', 'next_sem', an IST date 'YYYY-MM-DD', or a Date. Null means right away. */
  moveIn: MoveInChoice | Date | null;
  houseRules: readonly HouseRuleOption[];
  whoCanStay: GenderPref;
  roommate?: {
    /** People already in the group looking together, poster included. */
    groupSize?: number | null;
    languages?: readonly string[] | null;
    homeState?: string | null;
  } | null;
}

export type RoommateChipId = 'move_in' | 'rule' | 'gender' | 'group' | 'languages' | 'home_state';

export interface RoommateChip {
  id: RoommateChipId;
  label: string;
}

/**
 * Chips for the roommate card, in H2 order: move-in, rules, gender,
 * 'We are N looking', languages, home state. Empty parts are skipped.
 */
export function roommateChips(item: RoommateChipInput, now: Date | string | number = new Date()): RoommateChip[] {
  const chips: RoommateChip[] = [];
  const choice: MoveInChoice | null = item.moveIn instanceof Date ? istDateKey(item.moveIn) : item.moveIn;
  chips.push({ id: 'move_in', label: moveInLabel(choice, now) });

  for (const rule of item.houseRules) {
    const label = HOUSE_RULE_OPTION_LABELS[rule];
    if (label) chips.push({ id: 'rule', label });
  }

  chips.push({ id: 'gender', label: WHO_CAN_STAY_LABELS[item.whoCanStay] });

  const roommate = item.roommate ?? null;
  const groupSize = roommate?.groupSize ?? null;
  if (groupSize !== null && Number.isInteger(groupSize) && groupSize >= 2) {
    chips.push({ id: 'group', label: `We are ${groupSize} looking` });
  }

  const languages = (roommate?.languages ?? []).map((entry) => entry.trim()).filter(Boolean);
  if (languages.length > 0) chips.push({ id: 'languages', label: `Speaks ${languages.join(', ')}` });

  const homeState = roommate?.homeState?.trim();
  if (homeState) chips.push({ id: 'home_state', label: `From ${homeState}` });

  return chips;
}
