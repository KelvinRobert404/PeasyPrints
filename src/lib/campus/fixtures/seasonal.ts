// Seasonal sample packs for the demo date (src/lib/demo/season.ts).
//   May:  move-out bundles, summer sublets, cheap furniture.
//   July: room-wanted posts, new-student deals, set-up-room items.
// Both KJU campuses. Every doc id starts with 'season-' (SEASON_DOC_PREFIX), so the demo world can
// swap packs without touching the visitor's own posts and saves.
// createdAt and availability follow the real clock (`now`), so the feeds show
// them; move-in, travel and deadline dates follow the demo instant.
// Node tests import it, so '@/...' is type-only and runtime imports are relative.
import type { CampusAudience, GenderPref, ListingPlace } from '@/types/campus';
import type { Brokerage, Furnishing, HouseRule, HousingListingDoc, HousingPostedAs, HousingStayType, RentTerms, RoommatePrefs } from '@/types/housing';
import type { MarketCategory, MarketDetails, MarketListingDoc, PriceTerms } from '@/types/market';
import type { DealCategory, DealDoc } from '@/types/utilities';
import type { HousingKind } from '../housing/model.ts';
import { AVAILABILITY_DAYS } from '../constants.ts';
import { formatCampusSerial } from '../policy.ts';
import { KJU, KJU_AIRPORT, KJU_MAIN, displayNameOf, fixtureTime, landmarkPlace, type FixtureCampusId, type FixtureDoc } from './core.ts';

export type SeasonPackId = 'may' | 'july';

export const SEASON_PACK_IDS: readonly SeasonPackId[] = ['may', 'july'];

/** Stored housing doc plus the v2 kind the create form stores. */
export type SeasonHousingDoc = HousingListingDoc & { kind: HousingKind };

export interface SeasonPack {
  market: FixtureDoc<MarketListingDoc>[];
  housing: FixtureDoc<SeasonHousingDoc>[];
  deals: FixtureDoc<DealDoc>[];
}

/** Pack serials sit high in the range, clear of the base fixtures (0001 up). */
const SERIAL_BASE: Record<SeasonPackId, number> = { may: 9000, july: 9500 };

const NO_BROKERAGE: Brokerage = { charged: false, amount: null };

const main = (slug: string) => landmarkPlace(KJU_MAIN, slug);
const airport = (slug: string) => landmarkPlace(KJU_AIRPORT, slug);

// ---------------------------------------------------------------------------
// Market

interface MarketSpec {
  id: string;
  author: string;
  campusId?: FixtureCampusId;
  audience?: CampusAudience;
  category: MarketCategory;
  title: string;
  description: string;
  price: number | null;
  priceTerms: PriceTerms;
  place: ListingPlace | null;
  details: MarketDetails;
  /** Days since it was posted, on the real clock. */
  ageDays: number;
}

function buildMarket(now: Date, pack: SeasonPackId, spec: MarketSpec, index: number): FixtureDoc<MarketListingDoc> {
  const audience = spec.audience ?? 'campus';
  const genderPref: GenderPref = audience === 'girls' ? 'girls' : 'anyone';
  return {
    id: spec.id,
    data: {
      authorId: spec.author,
      serial: formatCampusSerial(KJU.collegeCode, 'M', SERIAL_BASE[pack] + index + 1),
      collegeId: KJU.collegeId,
      collegeCode: KJU.collegeCode,
      campusId: spec.campusId ?? KJU_MAIN,
      audience,
      kind: spec.details.kind,
      category: spec.category,
      status: 'active',
      title: spec.title,
      description: spec.description,
      price: spec.price,
      priceTerms: spec.priceTerms,
      previousPrice: null,
      priceDroppedAt: null,
      images: [],
      place: spec.place,
      genderPref,
      details: spec.details,
      sellerDisplayName: displayNameOf(spec.author),
      promotionEligible: audience === 'campus',
      reservedBy: null,
      reservedUntil: null,
      confirmedAt: null,
      createdAt: fixtureTime(now, -spec.ageDays),
      updatedAt: fixtureTime(now, -spec.ageDays),
      availabilityExpiresAt: fixtureTime(now, AVAILABILITY_DAYS - spec.ageDays),
    },
  };
}

// ---------------------------------------------------------------------------
// Housing

/** Right away, or a number of days after the demo instant. */
type MoveIn = 'now' | { inDays: number };

interface HousingSpec {
  id: string;
  author: string;
  campusId?: FixtureCampusId;
  audience?: CampusAudience;
  kind: HousingKind;
  postedAs: HousingPostedAs;
  stayType: HousingStayType;
  title: string;
  description: string;
  whoCanStay: GenderPref;
  houseRules?: HouseRule[];
  moveIn: MoveIn;
  bedsLeft: number;
  sharing: number | null;
  rentPp: number;
  deposit: number | null;
  rentTerms?: Partial<RentTerms>;
  furnishing: Furnishing | null;
  amenities: string[];
  place: ListingPlace;
  roommate?: RoommatePrefs;
  ageDays: number;
}

function moveInTime(instant: Date, moveIn: MoveIn) {
  if (moveIn === 'now') return null;
  return fixtureTime(instant, moveIn.inDays);
}

function buildHousing(now: Date, instant: Date, pack: SeasonPackId, spec: HousingSpec, index: number): FixtureDoc<SeasonHousingDoc> {
  const audience = spec.audience ?? 'campus';
  return {
    id: spec.id,
    data: {
      authorId: spec.author,
      serial: formatCampusSerial(KJU.collegeCode, 'H', SERIAL_BASE[pack] + index + 1),
      collegeId: KJU.collegeId,
      collegeCode: KJU.collegeCode,
      campusId: spec.campusId ?? KJU_MAIN,
      audience,
      kind: spec.kind,
      postedAs: spec.postedAs,
      stayType: spec.stayType,
      status: 'active',
      title: spec.title,
      description: spec.description,
      brokerage: NO_BROKERAGE,
      whoCanStay: audience === 'girls' ? 'girls' : spec.whoCanStay,
      houseRules: spec.houseRules ?? [],
      moveIn: moveInTime(instant, spec.moveIn),
      bedsLeft: spec.bedsLeft,
      sharing: spec.sharing,
      rentPp: spec.rentPp,
      deposit: spec.deposit,
      rentTerms: { period: 'monthly', includes: [], noticeMonths: 1, ...spec.rentTerms },
      furnishing: spec.furnishing,
      amenities: spec.amenities,
      images: [],
      place: spec.place,
      roommate: spec.roommate ?? null,
      posterDisplayName: displayNameOf(spec.author),
      promotionEligible: audience === 'campus',
      confirmedAt: null,
      createdAt: fixtureTime(now, -spec.ageDays),
      updatedAt: fixtureTime(now, -spec.ageDays),
      availabilityExpiresAt: fixtureTime(now, AVAILABILITY_DAYS - spec.ageDays),
    },
  };
}

// ---------------------------------------------------------------------------
// Deals

interface DealSpec {
  id: string;
  campusId: FixtureCampusId;
  category: DealCategory;
  merchantName: string;
  title: string;
  offer: string;
  code: string | null;
  howToClaim: string | null;
  place: ListingPlace | null;
  /** Days after the demo instant the deal ends. */
  validDays: number;
  ageDays: number;
}

function buildDeal(now: Date, instant: Date, spec: DealSpec): FixtureDoc<DealDoc> {
  return {
    id: spec.id,
    data: {
      campusId: spec.campusId,
      category: spec.category,
      status: 'active',
      merchantName: spec.merchantName,
      title: spec.title,
      offer: spec.offer,
      code: spec.code,
      howToClaim: spec.howToClaim,
      place: spec.place,
      images: [],
      validUntil: fixtureTime(instant, spec.validDays),
      createdBy: 'admin',
      createdAt: fixtureTime(now, -spec.ageDays),
      updatedAt: fixtureTime(now, -spec.ageDays),
    },
  };
}

// ---------------------------------------------------------------------------
// May: moving out

function mayMarket(instant: Date): MarketSpec[] {
  const at = (days: number) => fixtureTime(instant, days);
  return [
    {
      id: 'season-may-bundle-full-room',
      author: 'student-farhan',
      category: 'hostel_essentials',
      title: 'Moving out: whole room in one go',
      description: 'Final year. All of it must go by month end.',
      price: 2800,
      priceTerms: 'negotiable',
      place: main('falcon-hospital'),
      details: {
        kind: 'bundle',
        parts: [
          { title: 'Single mattress', price: 1100 },
          { title: 'Study table', price: 900 },
          { title: 'Plastic chair', price: 250 },
          { title: 'Table fan', price: 550 },
        ],
        splitOk: true,
      },
      ageDays: 1,
    },
    {
      id: 'season-may-bundle-kitchen',
      author: 'student-vivek',
      category: 'hostel_essentials',
      title: 'Leaving PG: kettle, buckets and rack',
      description: 'Pick up from Kothanur before the 30th.',
      price: 700,
      priceTerms: 'fixed',
      place: main('area-kothanur'),
      details: {
        kind: 'bundle',
        parts: [
          { title: 'Electric kettle', price: 350 },
          { title: 'Bucket and mug', price: 150 },
          { title: 'Shoe rack', price: 250 },
        ],
        splitOk: false,
      },
      ageDays: 2,
    },
    {
      id: 'season-may-bundle-airport',
      author: 'student-rahul',
      campusId: KJU_AIRPORT,
      category: 'hostel_essentials',
      title: 'Graduating, room clear-out near CMR',
      description: 'Cooler, shelf and chair. Buy one or all.',
      price: 3200,
      priceTerms: 'negotiable',
      place: airport('cmr-university'),
      details: {
        kind: 'bundle',
        parts: [
          { title: 'Air cooler', price: 2200 },
          { title: 'Bookshelf', price: 600 },
          { title: 'Folding chair', price: 400 },
        ],
        splitOk: true,
      },
      ageDays: 1,
    },
    {
      id: 'season-may-bundle-girls',
      author: 'student-tanvi',
      audience: 'girls',
      category: 'hostel_essentials',
      title: 'Hostel move-out set, near Livesta',
      description: 'Mattress, mirror and a study lamp.',
      price: 1500,
      priceTerms: 'negotiable',
      place: main('livesta'),
      details: {
        kind: 'bundle',
        parts: [
          { title: 'Mattress', price: 1000 },
          { title: 'Wall mirror', price: 250 },
          { title: 'Study lamp', price: 250 },
        ],
        splitOk: true,
      },
      ageDays: 2,
    },
    {
      id: 'season-may-cooler',
      author: 'student-joel',
      category: 'hostel_essentials',
      title: 'Air cooler, cools the room well',
      description: 'Used two summers. Leaving for home.',
      price: 1800,
      priceTerms: 'negotiable',
      place: main('navajyothi'),
      details: { kind: 'item', condition: 'good', brand: 'Symphony' },
      ageDays: 1,
    },
    {
      id: 'season-may-shelf',
      author: 'student-aditya',
      category: 'hostel_essentials',
      title: 'Bookshelf, three racks',
      description: 'Light and easy to carry.',
      price: 350,
      priceTerms: 'fixed',
      place: main('area-byrathi'),
      details: { kind: 'item', condition: 'used', brand: null },
      ageDays: 3,
    },
    {
      id: 'season-may-chairs-airport',
      author: 'student-isha',
      campusId: KJU_AIRPORT,
      category: 'hostel_essentials',
      title: 'Two plastic chairs, cheap',
      description: 'Both for one price. Moving out Friday.',
      price: 300,
      priceTerms: 'fixed',
      place: airport('area-bagalur'),
      details: { kind: 'item', condition: 'used', brand: null },
      ageDays: 2,
    },
    {
      id: 'season-may-table-airport',
      author: 'verified-kju-airport',
      campusId: KJU_AIRPORT,
      category: 'hostel_essentials',
      title: 'Foldable study table',
      description: 'Fits a small room. Selling before summer.',
      price: 500,
      priceTerms: 'negotiable',
      place: airport('area-gubbi-cross'),
      details: { kind: 'item', condition: 'good', brand: null },
      ageDays: 4,
    },
    {
      id: 'season-may-cab-home',
      author: 'student-farhan',
      category: 'travel',
      title: 'Cab to the airport after finals',
      description: 'Two seats left. Leaving early morning.',
      price: 450,
      priceTerms: 'per_person',
      place: main('falcon-hospital'),
      details: { kind: 'cab_split', from: 'KJU Main gate', to: 'Bengaluru airport', leavesAt: at(5), seatsLeft: 2, totalFare: 1800 },
      ageDays: 1,
    },
  ];
}

function mayHousing(): HousingSpec[] {
  return [
    {
      id: 'season-may-sublet-main',
      author: 'student-joel',
      kind: 'sublet',
      postedAs: 'leaving',
      stayType: 'flat',
      title: 'Summer sublet, June and July',
      description: 'Home for the break. Room is yours till August.',
      whoCanStay: 'anyone',
      moveIn: { inDays: 12 },
      bedsLeft: 1,
      sharing: 1,
      rentPp: 7000,
      deposit: 5000,
      rentTerms: { includes: ['wifi', 'electricity'], noticeMonths: 0 },
      furnishing: 'furnished',
      amenities: ['Wifi', 'Study table'],
      place: main('shelter-apartments'),
      ageDays: 1,
    },
    {
      id: 'season-may-sublet-hennur',
      author: 'student-aditya',
      kind: 'sublet',
      postedAs: 'leaving',
      stayType: 'pg',
      title: 'PG bed free for the summer',
      description: 'Internship in Pune. Back in August.',
      whoCanStay: 'boys',
      houseRules: ['no_smoking'],
      moveIn: { inDays: 8 },
      bedsLeft: 1,
      sharing: 2,
      rentPp: 6500,
      deposit: 4000,
      rentTerms: { includes: ['electricity', 'wifi', 'cleaning'], noticeMonths: 0 },
      furnishing: 'furnished',
      amenities: ['Wifi', 'Meals'],
      place: main('area-hennur'),
      ageDays: 2,
    },
    {
      id: 'season-may-sublet-airport',
      author: 'student-rahul',
      campusId: KJU_AIRPORT,
      kind: 'sublet',
      postedAs: 'leaving',
      stayType: 'flat',
      title: 'Sublet near Airport Rd for two months',
      description: 'Own room in a 2BHK. Flatmate stays.',
      whoCanStay: 'anyone',
      moveIn: { inDays: 10 },
      bedsLeft: 1,
      sharing: 1,
      rentPp: 8000,
      deposit: 6000,
      rentTerms: { includes: ['wifi'], noticeMonths: 0 },
      furnishing: 'semi_furnished',
      amenities: ['Wifi', 'Kitchen'],
      place: airport('area-dasanayakanahalli'),
      ageDays: 1,
    },
    {
      id: 'season-may-replacement-girls',
      author: 'student-priya',
      audience: 'girls',
      kind: 'replacement',
      postedAs: 'leaving',
      stayType: 'pg',
      title: 'Take my PG bed from June',
      description: 'Graduating. Deposit moves to you.',
      whoCanStay: 'girls',
      houseRules: ['curfew'],
      moveIn: { inDays: 12 },
      bedsLeft: 1,
      sharing: 2,
      rentPp: 8500,
      deposit: 10000,
      rentTerms: { includes: ['electricity', 'wifi', 'laundry'] },
      furnishing: 'furnished',
      amenities: ['Wifi', 'Laundry'],
      place: main('livesta'),
      ageDays: 2,
    },
  ];
}

// ---------------------------------------------------------------------------
// July: arriving

function julyMarket(instant: Date): MarketSpec[] {
  const at = (days: number) => fixtureTime(instant, days);
  return [
    {
      id: 'season-july-mattress',
      author: 'student-vivek',
      category: 'hostel_essentials',
      title: 'Single mattress, one year old',
      description: 'Clean, with a cover. Good for a new room.',
      price: 800,
      priceTerms: 'negotiable',
      place: main('area-kothanur'),
      details: { kind: 'item', condition: 'good', brand: null },
      ageDays: 1,
    },
    {
      id: 'season-july-fan',
      author: 'student-farhan',
      category: 'hostel_essentials',
      title: 'Table fan, quiet',
      description: 'Three speeds. Works fine.',
      price: 450,
      priceTerms: 'fixed',
      place: main('falcon-hospital'),
      details: { kind: 'item', condition: 'good', brand: 'Usha' },
      ageDays: 2,
    },
    {
      id: 'season-july-kettle',
      author: 'student-joel',
      category: 'hostel_essentials',
      title: 'Electric kettle for instant noodles',
      description: 'One litre. Hardly used.',
      price: 350,
      priceTerms: 'fixed',
      place: main('navajyothi'),
      details: { kind: 'item', condition: 'like_new', brand: null },
      ageDays: 1,
    },
    {
      id: 'season-july-starter-kit',
      author: 'student-aditya',
      category: 'hostel_essentials',
      title: 'New room starter kit',
      description: 'Bucket, mug, pillow and hangers together.',
      price: 400,
      priceTerms: 'fixed',
      place: main('hanuman-arch'),
      details: {
        kind: 'bundle',
        parts: [
          { title: 'Bucket and mug', price: 150 },
          { title: 'Pillow', price: 150 },
          { title: 'Hangers, set of 12', price: 100 },
        ],
        splitOk: false,
      },
      ageDays: 1,
    },
    {
      id: 'season-july-table-airport',
      author: 'student-isha',
      campusId: KJU_AIRPORT,
      category: 'hostel_essentials',
      title: 'Study table and chair',
      description: 'Both for one price. Near Bagalur.',
      price: 1200,
      priceTerms: 'negotiable',
      place: airport('area-bagalur'),
      details: { kind: 'item', condition: 'good', brand: null },
      ageDays: 2,
    },
    {
      id: 'season-july-shelf-airport',
      author: 'student-rahul',
      campusId: KJU_AIRPORT,
      category: 'hostel_essentials',
      title: 'Shoe rack, four shelves',
      description: 'Fits behind the door.',
      price: 250,
      priceTerms: 'fixed',
      place: airport('area-gubbi-cross'),
      details: { kind: 'item', condition: 'used', brand: null },
      ageDays: 3,
    },
    {
      id: 'season-july-girls-lamp',
      author: 'student-sneha',
      audience: 'girls',
      category: 'hostel_essentials',
      title: 'Study lamp and extension board',
      description: 'For a new hostel room.',
      price: 300,
      priceTerms: 'fixed',
      place: main('livesta'),
      details: { kind: 'item', condition: 'good', brand: null },
      ageDays: 1,
    },
    {
      id: 'season-july-wanted-cooler',
      author: 'student-tanvi',
      category: 'hostel_essentials',
      title: 'Need a cooler for my new room',
      description: 'Moving in next week. Any working one.',
      price: 1500,
      priceTerms: 'negotiable',
      place: main('area-gulabi-road'),
      details: { kind: 'wanted', budgetMax: 1500, neededBy: at(7) },
      ageDays: 1,
    },
    {
      id: 'season-july-cab-arrival',
      author: 'student-isha',
      campusId: KJU_AIRPORT,
      category: 'travel',
      title: 'Share a cab from the airport',
      description: 'Landing on arrival day. Two seats free.',
      price: 300,
      priceTerms: 'per_person',
      place: airport('a1-auditorium'),
      details: { kind: 'cab_split', from: 'Bengaluru airport', to: 'KJU Airport Rd', leavesAt: at(3), seatsLeft: 2, totalFare: 900 },
      ageDays: 1,
    },
  ];
}

function julyHousing(): HousingSpec[] {
  return [
    {
      id: 'season-july-wanted-main',
      author: 'student-rahul',
      kind: 'roommate',
      postedAs: 'tenant',
      stayType: 'flat',
      title: 'New student, need a room share',
      description: 'Joining BCom this sem. Want a calm flatmate.',
      whoCanStay: 'boys',
      houseRules: ['no_smoking'],
      moveIn: { inDays: 14 },
      bedsLeft: 1,
      sharing: 2,
      rentPp: 8000,
      deposit: null,
      furnishing: null,
      amenities: [],
      place: main('area-k-narayanapura'),
      roommate: { sleep: 'early', tidiness: 'tidy', smoking: 'no', note: 'From Kolkata. First time in Bengaluru.' },
      ageDays: 1,
    },
    {
      id: 'season-july-wanted-pg',
      author: 'student-vivek',
      kind: 'roommate',
      postedAs: 'tenant',
      stayType: 'pg',
      title: 'Looking for a PG near Hennur',
      description: 'Two of us want twin sharing before classes.',
      whoCanStay: 'boys',
      moveIn: { inDays: 21 },
      bedsLeft: 2,
      sharing: 2,
      rentPp: 9000,
      deposit: null,
      furnishing: 'furnished',
      amenities: [],
      place: main('area-hennur'),
      roommate: { sleep: 'flexible', tidiness: 'relaxed', smoking: 'no', note: 'We speak Hindi and English.' },
      ageDays: 2,
    },
    {
      id: 'season-july-wanted-airport',
      author: 'student-joel',
      campusId: KJU_AIRPORT,
      kind: 'roommate',
      postedAs: 'tenant',
      stayType: 'flat',
      title: 'Room wanted near Airport Rd campus',
      description: 'First year BCA. Happy to share a flat.',
      whoCanStay: 'anyone',
      moveIn: { inDays: 10 },
      bedsLeft: 1,
      sharing: 2,
      rentPp: 7000,
      deposit: null,
      furnishing: null,
      amenities: [],
      place: airport('area-dasanayakanahalli'),
      roommate: { sleep: 'late', tidiness: 'tidy', smoking: 'no', note: 'From Kerala. Cooks on weekends.' },
      ageDays: 1,
    },
    {
      id: 'season-july-wanted-girls',
      author: 'student-sneha',
      audience: 'girls',
      kind: 'roommate',
      postedAs: 'tenant',
      stayType: 'pg',
      title: 'Need a girls PG room near Livesta',
      description: 'Joining in August. Twin sharing is fine.',
      whoCanStay: 'girls',
      moveIn: { inDays: 20 },
      bedsLeft: 1,
      sharing: 2,
      rentPp: 9000,
      deposit: null,
      furnishing: 'furnished',
      amenities: [],
      place: main('livesta'),
      roommate: { sleep: 'early', tidiness: 'tidy', smoking: 'no', note: 'From Pune. Vegetarian.' },
      ageDays: 1,
    },
    {
      id: 'season-july-room-main',
      author: 'student-farhan',
      kind: 'room',
      postedAs: 'owner_contact',
      stayType: 'pg',
      title: 'New PG beds open for freshers',
      description: 'Owner just finished a new floor.',
      whoCanStay: 'boys',
      houseRules: ['no_smoking', 'curfew'],
      moveIn: { inDays: 5 },
      bedsLeft: 3,
      sharing: 3,
      rentPp: 8500,
      deposit: 12000,
      rentTerms: { includes: ['electricity', 'wifi', 'cleaning'] },
      furnishing: 'furnished',
      amenities: ['Wifi', 'Meals', 'Laundry'],
      place: main('falcon-hospital'),
      ageDays: 2,
    },
  ];
}

function julyDeals(): DealSpec[] {
  return [
    {
      id: 'season-july-deal-bedding',
      campusId: KJU_MAIN,
      category: 'other',
      merchantName: 'Kothanur Home Store',
      title: 'Bedding kit for new students',
      offer: '15% off with student ID',
      code: null,
      howToClaim: 'Show your Swoop card at the counter.',
      place: main('area-kothanur'),
      validDays: 30,
      ageDays: 1,
    },
    {
      id: 'season-july-deal-stationery',
      campusId: KJU_MAIN,
      category: 'stationery',
      merchantName: 'Campus Corner Stationery',
      title: 'First sem stationery pack',
      offer: 'Record books at half price',
      code: 'KJUNEW',
      howToClaim: 'Use the code at the counter.',
      place: main('st-marys-church'),
      validDays: 21,
      ageDays: 2,
    },
    {
      id: 'season-july-deal-sim',
      campusId: KJU_AIRPORT,
      category: 'electronics',
      merchantName: 'Gubbi Cross Mobiles',
      title: 'New SIM and data for freshers',
      offer: 'First month data free',
      code: null,
      howToClaim: 'Bring your college ID.',
      place: airport('area-gubbi-cross'),
      validDays: 30,
      ageDays: 1,
    },
    {
      id: 'season-july-deal-airport-prints',
      campusId: KJU_AIRPORT,
      category: 'printing',
      merchantName: 'Gate Two Prints',
      title: 'Free prints of your admission forms',
      offer: 'First 20 pages free',
      code: null,
      howToClaim: 'Show your admission letter.',
      place: airport('cmr-university'),
      validDays: 14,
      ageDays: 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Packs

/**
 * The docs for one seasonal pack. `now` is the real clock (posting times,
 * availability); `instant` is the demo date (move-in, travel, deal end).
 */
export function buildSeasonPack(pack: SeasonPackId, now: Date, instant: Date): SeasonPack {
  if (pack === 'may') {
    return {
      market: mayMarket(instant).map((spec, index) => buildMarket(now, pack, spec, index)),
      housing: mayHousing().map((spec, index) => buildHousing(now, instant, pack, spec, index)),
      deals: [],
    };
  }
  return {
    market: julyMarket(instant).map((spec, index) => buildMarket(now, pack, spec, index)),
    housing: julyHousing().map((spec, index) => buildHousing(now, instant, pack, spec, index)),
    deals: julyDeals().map((spec) => buildDeal(now, instant, spec)),
  };
}
