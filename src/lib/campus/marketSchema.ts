// Market request schemas: create (one shape per kind) and the PATCH actions.
// Runtime imports are relative with the .ts extension so node tests can load it.

import { z } from 'zod';
import type { GenderPref } from '@/types/campus';
import type { ItemCondition, MarketCategory, PassType, PriceTerms, VehicleOffer, VehicleType } from '@/types/market';
import {
  MARKET_CATEGORIES,
  MAX_BUNDLE_ITEMS,
  MAX_BUNDLE_PHOTOS,
  MAX_LISTING_PHOTOS,
  MOTOR_VEHICLE_TYPES,
  PLATE_STATE_CODES,
} from './market.ts';

const MAX_PRICE = 500_000;

const PRICE_TERMS = ['fixed', 'negotiable', 'free', 'swap', 'per_person'] as const satisfies readonly PriceTerms[];
const GENDER_PREFS = ['girls', 'boys', 'anyone'] as const satisfies readonly GenderPref[];
const CONDITIONS = ['new', 'like_new', 'good', 'used', 'needs_repair'] as const satisfies readonly ItemCondition[];
const PASS_TYPES = ['bus', 'metro', 'gym', 'library', 'other'] as const satisfies readonly PassType[];
const VEHICLE_TYPES = ['cycle', 'scooter', 'bike', 'other'] as const satisfies readonly VehicleType[];
const VEHICLE_OFFERS = ['sale', 'rent'] as const satisfies readonly VehicleOffer[];

const categorySchema = z.enum(MARKET_CATEGORIES as [MarketCategory, ...MarketCategory[]]);

const rupees = z.number().int().min(0).max(MAX_PRICE);
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

/** ISO date-time with an offset, e.g. 2026-11-20T18:30:00+05:30. */
const dateTime = z.string().datetime({ offset: true });
/** Date-time, or a date-only 'YYYY-MM-DD' (read as the end of that IST day). */
const dateOrDateTime = z.union([z.string().date(), dateTime]);

/** Uploaded campus media only. Ownership is checked on the server. */
const imageUrl = z.string().regex(/^\/api\/campus\/media\/[^/?]+$/, 'Upload photos first');
const images = (max: number) => z.array(imageUrl).max(max).default([]);

/** Indian mobile: 10 digits starting 6 to 9, optional +91, 91 or 0 in front. Stored as 10 digits. */
const whatsappNumber = z
  .string()
  .transform((value) => value.replace(/[\s\-().]/g, ''))
  .pipe(z.string().regex(/^(?:\+?91|0)?[6-9]\d{9}$/, 'Enter a 10 digit mobile number'))
  .transform((value) => value.slice(-10));

const landmarkId = shortText(80);

/** Fields every kind shares. Description is optional so a one-tap ask works. */
const baseFields = {
  title: shortText(80),
  description: optionalText(1000),
  category: categorySchema.default('other'),
  price: rupees.nullable().default(null),
  priceTerms: z.enum(PRICE_TERMS).default('fixed'),
  genderPref: z.enum(GENDER_PREFS).default('anyone'),
  images: images(MAX_LISTING_PHOTOS),
  landmarkId: landmarkId.optional(),
  whatsappNumber: whatsappNumber.optional(),
  /** Use the number already saved on the profile. */
  useSavedNumber: z.boolean().optional(),
};

const itemSchema = z.object({
  ...baseFields,
  kind: z.literal('item'),
  landmarkId,
  condition: z.enum(CONDITIONS).nullable().default(null),
  brand: shortText(60).nullable().default(null),
});

const wantedSchema = z.object({
  ...baseFields,
  kind: z.literal('wanted'),
  budgetMax: rupees.nullable().default(null),
  neededBy: dateOrDateTime.nullable().default(null),
});

const bundlePartSchema = z.object({
  title: shortText(60),
  price: rupees.nullable().default(null),
});

const bundleSchema = z.object({
  ...baseFields,
  kind: z.literal('bundle'),
  landmarkId,
  images: images(MAX_BUNDLE_PHOTOS),
  parts: z.array(bundlePartSchema).min(1, 'Add at least one thing').max(MAX_BUNDLE_ITEMS, `At most ${MAX_BUNDLE_ITEMS} things`),
  splitOk: z.boolean().default(false),
});

const seatSchema = z.object({
  ...baseFields,
  kind: z.literal('seat'),
  seatFor: shortText(80),
  departureAt: dateTime,
  endsAt: dateTime.nullable().default(null),
  seatsLeft: z.number().int().min(1).max(10),
});

const cabSplitSchema = z.object({
  ...baseFields,
  kind: z.literal('cab_split'),
  from: shortText(80),
  to: shortText(80),
  departureAt: dateTime,
  seatsLeft: z.number().int().min(1).max(6),
  totalFare: rupees.nullable().default(null),
});

const ticketSchema = z.object({
  ...baseFields,
  kind: z.literal('ticket'),
  happensAt: dateTime,
  venue: shortText(80).nullable().default(null),
  quantity: z.number().int().min(1).max(10).default(1),
  /** Printed price per ticket. Resale can never be above it. */
  faceValue: z.number().int().min(1).max(MAX_PRICE),
});

const passSchema = z.object({
  ...baseFields,
  kind: z.literal('pass'),
  passType: z.enum(PASS_TYPES),
  validUntil: dateOrDateTime.nullable().default(null),
});

const vehicleSchema = z.object({
  ...baseFields,
  kind: z.literal('vehicle'),
  landmarkId,
  vehicleType: z.enum(VEHICLE_TYPES),
  offer: z.enum(VEHICLE_OFFERS).default('sale'),
  year: z.number().int().min(1980).max(2100).nullable().default(null),
  kmDriven: z.number().int().min(0).max(1_000_000).nullable().default(null),
  papersOk: z.boolean().nullable().default(null),
  /** State code on the number plate. Needed for scooters and bikes. */
  plateState: z.enum(PLATE_STATE_CODES).optional(),
});

const MOTOR: ReadonlySet<string> = new Set(MOTOR_VEHICLE_TYPES);

export const marketCreateSchema = z
  .discriminatedUnion('kind', [
    itemSchema,
    wantedSchema,
    bundleSchema,
    seatSchema,
    cabSplitSchema,
    ticketSchema,
    passSchema,
    vehicleSchema,
  ])
  .superRefine((value, ctx) => {
    const free = value.priceTerms === 'free' || value.priceTerms === 'swap';
    if (free && value.price !== null && value.price !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Free or swap has no price' });
    }
    if (!free && value.kind !== 'wanted' && value.kind !== 'bundle' && (value.price === null || value.price <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Add a price' });
    }
    if (value.kind === 'bundle' && !free && value.price === null && value.parts.every((part) => part.price === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Add a price for the bundle or its things' });
    }
    if (value.kind === 'ticket' && value.price !== null && value.price > value.faceValue) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Price cannot be above face value' });
    }
    if (value.kind === 'seat' && value.endsAt !== null && Date.parse(value.endsAt) <= Date.parse(value.departureAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'End must be after the start' });
    }
    if (value.kind === 'vehicle' && MOTOR.has(value.vehicleType) && !value.plateState) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['plateState'], message: 'Pick the plate state' });
    }
    if (value.whatsappNumber && value.useSavedNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['whatsappNumber'], message: 'Use the saved number or a new one' });
    }
  });

export type MarketCreateInput = z.input<typeof marketCreateSchema>;
export type MarketCreate = z.output<typeof marketCreateSchema>;
export type MarketCreateFor<K extends MarketCreate['kind']> = Extract<MarketCreate, { kind: K }>;

const emptyAction = <A extends string>(action: A) => z.object({ action: z.literal(action) });

export const marketPatchSchema = z.discriminatedUnion('action', [
  emptyAction('still_available'),
  emptyAction('sold'),
  emptyAction('booked'),
  emptyAction('reserve'),
  emptyAction('unreserve'),
  z.object({ action: z.literal('lower_price'), price: z.number().int().min(1).max(MAX_PRICE) }),
  z.object({ action: z.literal('bundle_item_sold'), partIndex: z.number().int().min(0).max(MAX_BUNDLE_ITEMS - 1) }),
  z.object({ action: z.literal('seats_left'), seatsLeft: z.number().int().min(0).max(10) }),
  emptyAction('close'),
  z.object({ action: z.literal('promotion'), eligible: z.boolean() }),
]);

export type MarketPatch = z.output<typeof marketPatchSchema>;
export type MarketPatchAction = MarketPatch['action'];
