// Market constants: kind and category labels, the furnish tiles, the extra
// chips, number-plate state codes and the feed sections. Pure data so node
// tests and client components can import it.

import type { RoomItemId } from '@/components/swoop/illustrations-room';
import type { MarketCategory, MarketKind } from '@/types/market';
import { MARKET_CATEGORY_LABELS, MARKET_KIND_LABELS } from './constants.ts';

export { MARKET_CATEGORY_LABELS, MARKET_KIND_LABELS };

/** Every market kind, in picker order. */
export const MARKET_KINDS: readonly MarketKind[] = [
  'item',
  'bundle',
  'wanted',
  'seat',
  'cab_split',
  'ticket',
  'pass',
  'vehicle',
];

/** Every market category, in picker order. */
export const MARKET_CATEGORIES: readonly MarketCategory[] = [
  'books_notes',
  'electronics',
  'hostel_essentials',
  'fashion',
  'stationery',
  'sports_fitness',
  'music',
  'cycles',
  'travel',
  'other',
];

/** What the post button says for each kind. */
export const MARKET_KIND_POST_LABELS: Record<MarketKind, string> = {
  item: 'Sell something',
  bundle: 'Clear out your room',
  wanted: 'Ask for something',
  seat: 'Pass on a seat',
  cab_split: 'Split a cab',
  ticket: 'Sell a ticket',
  pass: 'Sell a pass',
  vehicle: 'Sell or rent a ride',
};

export type FurnishTileId = Extract<
  RoomItemId,
  'mattress' | 'study_table' | 'chair' | 'fan' | 'cooler' | 'bucket_set' | 'kettle' | 'shelf'
>;

export interface FurnishTile {
  /** Matches a RoomItemId, so the tile can show ROOM_ART[id]. */
  id: FurnishTileId;
  label: string;
  /** Typical second-hand price on campus, in rupees. */
  typicalPrice: number;
  /** Words in a title that mean this thing. Most specific first. */
  keywords: readonly string[];
}

/** 'Furnish your room' tiles. Order is display order. */
export const FURNISH_TILES: readonly FurnishTile[] = [
  { id: 'mattress', label: 'Mattress', typicalPrice: 1500, keywords: ['mattress', 'gadda'] },
  { id: 'study_table', label: 'Study table', typicalPrice: 1200, keywords: ['study table', 'study desk', 'desk', 'table'] },
  { id: 'chair', label: 'Chair', typicalPrice: 600, keywords: ['chair', 'stool'] },
  { id: 'fan', label: 'Fan', typicalPrice: 800, keywords: ['table fan', 'pedestal fan', 'ceiling fan', 'fan'] },
  { id: 'cooler', label: 'Cooler', typicalPrice: 2500, keywords: ['air cooler', 'cooler'] },
  { id: 'bucket_set', label: 'Bucket set', typicalPrice: 250, keywords: ['bucket', 'mug'] },
  { id: 'kettle', label: 'Kettle', typicalPrice: 500, keywords: ['electric kettle', 'kettle'] },
  { id: 'shelf', label: 'Shelf', typicalPrice: 700, keywords: ['bookshelf', 'shelf', 'rack'] },
];

/**
 * Order titles are checked in, so a 'table fan' is a fan and an 'air cooler'
 * is a cooler before the broader 'table' and 'bed' words get a look.
 */
const FURNISH_MATCH_ORDER: readonly FurnishTileId[] = [
  'fan',
  'cooler',
  'kettle',
  'shelf',
  'bucket_set',
  'chair',
  'study_table',
  'mattress',
];

function normalizeWords(text: string): string {
  return ` ${text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

function hasKeyword(words: string, keyword: string): boolean {
  if (words.includes(` ${keyword} `)) return true;
  // Simple plurals: 'chairs', 'buckets', 'shelves'.
  if (words.includes(` ${keyword}s `)) return true;
  return keyword.endsWith('f') && words.includes(` ${keyword.slice(0, -1)}ves `);
}

/** The furnish tile a title belongs to, or null. 'Usha table fan' -> 'fan'. */
export function furnishTileFor(title: string): FurnishTileId | null {
  const words = normalizeWords(title);
  if (words.trim() === '') return null;
  for (const id of FURNISH_MATCH_ORDER) {
    const tile = FURNISH_TILES.find((t) => t.id === id);
    if (tile && tile.keywords.some((keyword) => hasKeyword(words, keyword))) return id;
  }
  return null;
}

export type AlsoChipId = 'vehicles' | 'tickets' | 'trips' | 'more';

export interface AlsoChip {
  id: AlsoChipId;
  label: string;
  /** Spoken label when the visible one is a symbol. */
  ariaLabel: string;
  /** Kinds the chip filters to. Empty means it opens the full list. */
  kinds: readonly MarketKind[];
}

/** Chips under the furnish tiles: Vehicles / Tickets / Trips / +. */
export const ALSO_CHIPS: readonly AlsoChip[] = [
  { id: 'vehicles', label: 'Vehicles', ariaLabel: 'Vehicles', kinds: ['vehicle'] },
  { id: 'tickets', label: 'Tickets', ariaLabel: 'Tickets and passes', kinds: ['ticket', 'pass'] },
  { id: 'trips', label: 'Trips', ariaLabel: 'Trips and seats', kinds: ['cab_split', 'seat'] },
  { id: 'more', label: '+', ariaLabel: 'More kinds', kinds: [] },
];

/** Vehicle types that carry a number plate. */
export const MOTOR_VEHICLE_TYPES = ['scooter', 'bike'] as const;

/** Number-plate state and UT codes. BH is the Bharat series. */
export const PLATE_STATES = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'AN', name: 'Andaman and Nicobar' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BH', name: 'Bharat series' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CG', name: 'Chhattisgarh' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'DD', name: 'Dadra, Daman and Diu' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'HR', name: 'Haryana' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'KL', name: 'Kerala' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MN', name: 'Manipur' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OD', name: 'Odisha' },
  { code: 'PB', name: 'Punjab' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TR', name: 'Tripura' },
  { code: 'TS', name: 'Telangana' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'WB', name: 'West Bengal' },
] as const;

export type PlateStateCode = (typeof PLATE_STATES)[number]['code'];

export const PLATE_STATE_CODES = PLATE_STATES.map((state) => state.code) as [PlateStateCode, ...PlateStateCode[]];

export const DEFAULT_PLATE_STATE: PlateStateCode = 'KA';

export type MarketSectionId = 'clearing-out' | 'seats' | 'near-you' | 'wanted';

export interface MarketSection {
  id: MarketSectionId;
  title: string;
}

/** Market home sections, in display order. */
export const MARKET_SECTIONS: readonly MarketSection[] = [
  { id: 'clearing-out', title: 'Rooms clearing out' },
  { id: 'seats', title: 'Seats, tickets and passes' },
  { id: 'near-you', title: 'Everything near you' },
  { id: 'wanted', title: 'Wanted' },
];

/** Photo limits: a room bundle can show more. */
export const MAX_BUNDLE_PHOTOS = 8;
export const MAX_LISTING_PHOTOS = 5;
/** A bundle holds 1 to 20 things. */
export const MAX_BUNDLE_ITEMS = 20;
