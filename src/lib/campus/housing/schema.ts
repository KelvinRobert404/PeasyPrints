// Zod schemas for creating and updating housing posts (KADA-18).
// Pure module: node tests import it, so '@/...' only as `import type`.
import { z } from 'zod';
import type { CampusAudience } from '@/types/campus';
import {
  FURNISHINGS,
  HOUSE_RULES,
  HOUSING_KINDS,
  HOUSING_STAY_TYPES,
  NO_RESTRICTIONS,
  POSTED_AS,
  RENT_TERMS,
  WHO_CAN_STAY,
  containsPhoneNumber,
} from './model.ts';

/** Highest rupee amount we accept for rent, deposit or brokerage. */
export const MAX_RUPEES = 10_00_000;
export const MAX_BEDS = 20;
export const MAX_SHARING = 10;
/** Longest rough distance a poster can type for an 'other' place. */
export const MAX_ROUGH_DISTANCE_M = 20_000;
/** Place id meaning 'not in the landmark list'. */
export const OTHER_PLACE = 'other';

const NO_PHONE = 'Remove phone numbers. Students reach you in chat.';

function enumOf<T extends readonly [string, ...string[]]>(values: T, message: string) {
  return z.enum(values, { errorMap: () => ({ message }) });
}

const rupees = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number`, required_error: `Add the ${label.toLowerCase()}` })
    .int(`${label} must be whole rupees`)
    .min(0, `${label} cannot be negative`)
    .max(MAX_RUPEES, `${label} looks too high`);

function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

/** 'now', 'next_sem' or an IST date 'YYYY-MM-DD'. */
export const MoveInSchema = z
  .string({ required_error: 'Pick a move-in date', invalid_type_error: 'Pick a move-in date' })
  .trim()
  .refine((value) => value === 'now' || value === 'next_sem' || isDateKey(value), 'Pick a move-in date');

export const HouseRulesSchema = z
  .array(enumOf(HOUSE_RULES, 'Pick a house rule from the list'), {
    required_error: 'Pick at least one house rule',
    invalid_type_error: 'Pick at least one house rule',
  })
  .min(1, 'Pick at least one house rule')
  .superRefine((rules, ctx) => {
    if (new Set(rules).size !== rules.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each rule only once' });
    }
    if (rules.includes(NO_RESTRICTIONS) && rules.length > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No restrictions cannot go with other rules' });
    }
  });

export const BrokerageSchema = z
  .object({
    charged: z.boolean({ required_error: 'Say if there is brokerage', invalid_type_error: 'Say if there is brokerage' }),
    amount: rupees('Brokerage').nullable().optional(),
  })
  .superRefine((brokerage, ctx) => {
    if (brokerage.charged && (brokerage.amount === null || brokerage.amount === undefined || brokerage.amount <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Add the brokerage amount' });
    }
  })
  .transform((brokerage) => ({ charged: brokerage.charged, amount: brokerage.charged ? brokerage.amount ?? null : null }));

const RoommateSchema = z.object({
  /** People looking together, poster included. */
  groupSize: z.number().int().min(1).max(6).nullable().optional(),
  languages: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
  homeState: z.string().trim().max(40).nullable().optional(),
  sleep: z.enum(['early', 'late', 'flexible']).nullable().optional(),
  tidiness: z.enum(['tidy', 'relaxed']).nullable().optional(),
  smoking: z.enum(['no', 'outside', 'ok']).nullable().optional(),
  note: z
    .string()
    .trim()
    .max(200)
    .refine((value) => !containsPhoneNumber(value), NO_PHONE)
    .nullable()
    .optional(),
});

export interface HousingSchemaOptions {
  /** 'girls' is the girls' space route: who can stay is always girls. */
  audience?: CampusAudience;
  /** Landmark ids of the poster's campus. When given, other ids are rejected. */
  landmarkIds?: readonly string[];
}

function placeSchema(landmarkIds: readonly string[] | undefined) {
  return z
    .object(
      {
        landmarkId: z.string({ required_error: 'Pick a place' }).trim().min(1, 'Pick a place').max(64),
        area: z.string().trim().max(60).optional(),
        roughDistanceM: z.number().int().min(0).max(MAX_ROUGH_DISTANCE_M, 'That looks too far').nullable().optional(),
      },
      { required_error: 'Pick a place', invalid_type_error: 'Pick a place' },
    )
    .superRefine((place, ctx) => {
      if (place.landmarkId === OTHER_PLACE) {
        if (!place.area || place.area.length < 2) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['area'], message: 'Type the area' });
        }
        if (place.roughDistanceM === null || place.roughDistanceM === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['roughDistanceM'], message: 'Add a rough distance' });
        }
        return;
      }
      if (landmarkIds && !landmarkIds.includes(place.landmarkId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['landmarkId'], message: 'Pick a place from the list' });
      }
    })
    .transform((place) =>
      place.landmarkId === OTHER_PLACE
        ? { landmarkId: OTHER_PLACE, area: place.area ?? '', roughDistanceM: place.roughDistanceM ?? null }
        : { landmarkId: place.landmarkId, area: null, roughDistanceM: null },
    );
}

function whoCanStaySchema(audience: CampusAudience) {
  const pick = enumOf(WHO_CAN_STAY, 'Pick who can stay');
  if (audience !== 'girls') return pick;
  return pick
    .optional()
    .refine((value) => value === undefined || value === 'girls', 'Girls’ space posts are for girls only')
    .transform(() => 'girls' as const);
}

/** Create schema. Use housingCreateSchema({ audience: 'girls' }) on the girls' space route. */
export function housingCreateSchema(options: HousingSchemaOptions = {}) {
  const audience = options.audience ?? 'campus';
  return z
    .object({
      kind: enumOf(HOUSING_KINDS, 'Pick room, roommate, replacement or sublet'),
      postedAs: enumOf(POSTED_AS, 'Say who is posting'),
      brokerage: BrokerageSchema.nullable().optional(),
      stayType: enumOf(HOUSING_STAY_TYPES, 'Pick PG, flat or hostel'),
      title: z
        .string({ required_error: 'Add a title' })
        .trim()
        .min(4, 'Add a short title')
        .max(80, 'Keep the title under 80 characters')
        .refine((value) => !containsPhoneNumber(value), NO_PHONE),
      description: z
        .string()
        .trim()
        .max(1000, 'Keep it under 1000 characters')
        .refine((value) => !containsPhoneNumber(value), NO_PHONE)
        .default(''),
      whoCanStay: whoCanStaySchema(audience),
      houseRules: HouseRulesSchema,
      moveIn: MoveInSchema,
      bedsLeft: z
        .number({ required_error: 'Add beds left', invalid_type_error: 'Add beds left' })
        .int()
        .min(1, 'At least one bed must be free')
        .max(MAX_BEDS),
      sharing: z.number().int().min(1).max(MAX_SHARING).nullable().optional(),
      rentPp: rupees('Rent'),
      deposit: rupees('Deposit').nullable().optional(),
      rentTerms: enumOf(RENT_TERMS, 'Say if the rent is negotiable'),
      furnishing: z.enum(FURNISHINGS).nullable().optional(),
      amenities: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
      images: z.array(z.string().trim().min(1).max(1024)).max(8).default([]),
      place: placeSchema(options.landmarkIds),
      roommate: RoommateSchema.nullable().optional(),
    })
    .superRefine((input, ctx) => {
      if (input.postedAs === 'agent' && !input.brokerage) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['brokerage'], message: 'Say if the agent charges brokerage' });
      }
    })
    .transform((input) => ({
      ...input,
      brokerage: input.brokerage ?? null,
      sharing: input.sharing ?? null,
      deposit: input.deposit ?? null,
      furnishing: input.furnishing ?? null,
      roommate: input.roommate ?? null,
    }));
}

export const HousingCreateSchema = housingCreateSchema();
export type HousingCreateInput = z.input<typeof HousingCreateSchema>;
export type HousingCreate = z.output<typeof HousingCreateSchema>;

export const HousingPatchSchema = z.discriminatedUnion(
  'action',
  [
    z.object({ action: z.literal('confirm') }),
    z.object({ action: z.literal('reserve') }),
    z.object({ action: z.literal('unreserve') }),
    z.object({ action: z.literal('booked') }),
    z.object({ action: z.literal('close') }),
    z.object({ action: z.literal('lower_price'), rentPp: rupees('Rent') }),
    z.object({
      action: z.literal('beds'),
      bedsLeft: z.number({ required_error: 'Add beds left' }).int().min(0).max(MAX_BEDS),
    }),
    z.object({ action: z.literal('promotion'), eligible: z.boolean() }),
  ],
  { errorMap: () => ({ message: 'Unknown action' }) },
);

export type HousingPatch = z.output<typeof HousingPatchSchema>;
export type HousingPatchAction = HousingPatch['action'];

/** First issue message for a form error line. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the form';
}
