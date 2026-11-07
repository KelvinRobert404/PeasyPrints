import type { CampusRef, GenderPref, StayType } from '@/types/campus';
import type { HouseRule, HousingPostedAs, HousingStatus, RentPeriod } from '@/types/housing';
import type { MarketCategory, MarketKind, MarketStatus, PriceTerms } from '@/types/market';
import type { BloodGroup, DealCategory, GameSport, LostFoundCategory, LostFoundKind } from '@/types/utilities';
import { getCampus, getCollege } from './catalog.ts';

export const AVAILABILITY_DAYS = 7;
export const CONTACT_REQUEST_HOURS = 72;
export const VERIFICATION_DAYS = 365;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}


/** Firestore collection names for the campus app. Use these, never string literals. */
export const CAMPUS_COLLECTIONS = {
  colleges: 'college_configs',
  memberships: 'campus_memberships',
  media: 'campus_media',
  serialReservations: 'campus_serial_reservations',
  serialMetrics: 'campus_serial_metrics',
  market: 'market_listings',
  housing: 'housing_listings',
  contactRequests: 'contact_requests',
  saves: 'campus_saves',
  reports: 'campus_reports',
  deals: 'campus_deals',
  lostFound: 'lost_found',
  bloodRequests: 'blood_requests',
  bloodDonors: 'blood_donors',
  games: 'campus_games',
  notifications: 'notifications',
  notificationPrefs: 'notification_prefs',
} as const;

export type CampusCollection = (typeof CAMPUS_COLLECTIONS)[keyof typeof CAMPUS_COLLECTIONS];

export const DEFAULT_CAMPUS_ID = 'kju-main';

/** The pilot campus, read from the static catalog. */
function defaultCampusRef(): CampusRef {
  const campus = getCampus(DEFAULT_CAMPUS_ID);
  const college = getCollege(campus?.collegeId);
  if (!campus || !college) throw new Error(`Default campus ${DEFAULT_CAMPUS_ID} is missing from the catalog`);
  return { id: campus.id, collegeId: college.id, code: college.code, label: campus.label };
}

export const DEFAULT_CAMPUS: CampusRef = defaultCampusRef();

export const TRUST_LINE = 'Only verified students';
export const PAY_ON_PICKUP = 'Pay on pickup';

/** A reserve holds a listing for this long. */
export const RESERVE_HOURS = 24;
/** Ask the seller 'Still available?' after this many quiet days. */
export const NUDGE_DAYS = 3;
/** Show the price-drop badge for this many days. */
export const PRICE_DROP_BADGE_DAYS = 7;

export const GENDER_PREF_LABELS: Record<GenderPref, string> = {
  girls: 'For girls',
  boys: 'For boys',
  anyone: 'Anyone',
};

export const STAY_TYPE_LABELS: Record<StayType, string> = {
  pg: 'PG',
  flat: 'Flat',
  hostel: 'Hostel',
  home: 'Home',
};

export const MARKET_KIND_LABELS: Record<MarketKind, string> = {
  item: 'Item',
  wanted: 'Wanted',
  bundle: 'Bundle',
  seat: 'Seat',
  cab_split: 'Cab split',
  ticket: 'Ticket',
  pass: 'Pass',
  vehicle: 'Vehicle',
};

export const MARKET_CATEGORY_LABELS: Record<MarketCategory, string> = {
  books_notes: 'Books and notes',
  electronics: 'Electronics',
  fashion: 'Fashion',
  hostel_essentials: 'Hostel essentials',
  stationery: 'Stationery',
  sports_fitness: 'Sports and fitness',
  music: 'Music',
  cycles: 'Cycles',
  travel: 'Travel',
  other: 'Other',
};

export const PRICE_TERMS_LABELS: Record<PriceTerms, string> = {
  fixed: 'Fixed price',
  negotiable: 'Open to offers',
  free: 'Free',
  swap: 'Swap',
  per_person: 'Per person',
};

export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = {
  active: 'Available',
  needs_confirmation: 'Still available?',
  reserved: 'Reserved',
  booked: 'Booked',
  sold: 'Sold',
  filled: 'Filled',
  expired: 'Expired',
  closed: 'Closed',
  removed: 'Removed',
};

export const HOUSING_POSTED_AS_LABELS: Record<HousingPostedAs, string> = {
  tenant: 'I live here',
  leaving: 'Moving out',
  owner_contact: 'Owner contact',
};

export const HOUSING_STATUS_LABELS: Record<HousingStatus, string> = {
  active: 'Available',
  needs_confirmation: 'Still available?',
  booked: 'Booked',
  filled: 'Filled',
  expired: 'Expired',
  closed: 'Closed',
  removed: 'Removed',
};

export const HOUSE_RULE_LABELS: Record<HouseRule, string> = {
  no_smoking: 'No smoking',
  no_drinking: 'No drinking',
  no_overnight_guests: 'No overnight guests',
  curfew: 'Curfew',
  quiet_hours: 'Quiet hours',
  veg_only: 'Veg only',
};

export const RENT_PERIOD_LABELS: Record<RentPeriod, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semester: 'Per semester',
  yearly: 'Yearly',
};

export const DEAL_CATEGORY_LABELS: Record<DealCategory, string> = {
  stationery: 'Stationery',
  printing: 'Printing',
  electronics: 'Electronics',
  fitness: 'Fitness',
  grooming: 'Grooming',
  travel: 'Travel',
  other: 'Other',
};

export const LOST_FOUND_KIND_LABELS: Record<LostFoundKind, string> = {
  lost: 'Lost',
  found: 'Found',
};

export const LOST_FOUND_CATEGORY_LABELS: Record<LostFoundCategory, string> = {
  id_card: 'ID card',
  keys: 'Keys',
  phone: 'Phone',
  wallet: 'Wallet',
  bag: 'Bag',
  bottle: 'Bottle',
  electronics: 'Electronics',
  books: 'Books',
  clothing: 'Clothing',
  other: 'Other',
};

export const BLOOD_GROUPS: readonly BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const GAME_SPORT_LABELS: Record<GameSport, string> = {
  cricket: 'Cricket',
  football: 'Football',
  badminton: 'Badminton',
  basketball: 'Basketball',
  volleyball: 'Volleyball',
  table_tennis: 'Table tennis',
  chess: 'Chess',
  carrom: 'Carrom',
  esports: 'Esports',
  other: 'Other',
};
