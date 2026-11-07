// Housing listing fixtures (housing_listings). Rooms, roommates, replacements and
// sublets from students, owners and an agent. Dates are relative to seed time.
import type { CampusAudience, GenderPref, ListingPlace } from '@/types/campus';
import type {
  Brokerage,
  Furnishing,
  HouseRule,
  HousingListingDoc,
  HousingPostedAs,
  HousingStatus,
  HousingStayType,
  RentTerms,
  RoommatePrefs,
} from '@/types/housing';
import { formatCampusSerial } from '../policy.ts';
import { AVAILABILITY_DAYS } from '../constants.ts';
import { nextSemStart } from '../season.ts';
import { KJU, KJU_AIRPORT, KJU_MAIN, areaPlace, displayNameOf, fixtureTime, istDay, landmarkPlace, type FixtureCampusId, type FixtureDoc } from './core.ts';

/** When the room is free: right away, a number of days out, or the next semester. */
type MoveIn = 'now' | 'next_sem' | { inDays: number };

interface HousingSpec {
  id: string;
  author: string;
  campusId?: FixtureCampusId;
  audience?: CampusAudience;
  postedAs: HousingPostedAs;
  stayType: HousingStayType;
  status?: HousingStatus;
  title: string;
  description: string;
  brokerage?: Brokerage;
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
  confirmedDaysAgo?: number;
}

const NO_BROKERAGE: Brokerage = { charged: false, amount: null };

function moveInTime(now: Date, moveIn: MoveIn) {
  if (moveIn === 'now') return null;
  if (moveIn === 'next_sem') return istDay(nextSemStart(now));
  return fixtureTime(now, moveIn.inDays);
}

function build(now: Date, spec: HousingSpec, index: number): FixtureDoc<HousingListingDoc> {
  const audience = spec.audience ?? 'campus';
  const sinceDays = spec.confirmedDaysAgo ?? spec.ageDays;
  return {
    id: spec.id,
    data: {
      authorId: spec.author,
      serial: formatCampusSerial(KJU.collegeCode, 'H', index + 1),
      collegeId: KJU.collegeId,
      collegeCode: KJU.collegeCode,
      campusId: spec.campusId ?? KJU_MAIN,
      audience,
      postedAs: spec.postedAs,
      stayType: spec.stayType,
      status: spec.status ?? 'active',
      title: spec.title,
      description: spec.description,
      brokerage: spec.brokerage ?? NO_BROKERAGE,
      whoCanStay: spec.whoCanStay,
      houseRules: spec.houseRules ?? [],
      moveIn: moveInTime(now, spec.moveIn),
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
      confirmedAt: spec.confirmedDaysAgo === undefined ? null : fixtureTime(now, -spec.confirmedDaysAgo),
      createdAt: fixtureTime(now, -spec.ageDays),
      updatedAt: fixtureTime(now, -sinceDays),
      availabilityExpiresAt: fixtureTime(now, AVAILABILITY_DAYS - sinceDays),
    },
  };
}

const main = (slug: string) => landmarkPlace(KJU_MAIN, slug);
const airport = (slug: string) => landmarkPlace(KJU_AIRPORT, slug);

const SPECS: readonly HousingSpec[] = [
  // Rooms from owners.
  {
    id: 'hsg-pg-falcon',
    author: 'student-farhan',
    postedAs: 'owner_contact',
    stayType: 'pg',
    title: 'Twin sharing PG near Falcon Hospital',
    description: 'Owner runs it well. Meals not included.',
    whoCanStay: 'boys',
    houseRules: ['no_smoking', 'curfew'],
    moveIn: 'now',
    bedsLeft: 1,
    sharing: 2,
    rentPp: 9500,
    deposit: 15000,
    rentTerms: { includes: ['electricity', 'wifi', 'cleaning'] },
    furnishing: 'furnished',
    amenities: ['Wifi', 'Washing machine', 'Power backup'],
    place: main('falcon-hospital'),
    ageDays: 2,
  },
  {
    id: 'hsg-house-hennur',
    author: 'student-vivek',
    postedAs: 'owner_contact',
    stayType: 'flat',
    title: 'Single room in a quiet house',
    description: 'Independent entry. Owner lives upstairs.',
    whoCanStay: 'anyone',
    houseRules: ['quiet_hours'],
    moveIn: { inDays: 20 },
    bedsLeft: 1,
    sharing: 1,
    rentPp: 12000,
    deposit: 30000,
    rentTerms: { includes: ['water'], noticeMonths: 2 },
    furnishing: 'semi_furnished',
    amenities: ['Balcony', 'Two wheeler parking'],
    place: areaPlace(KJU_MAIN, 'Near Hennur Cross', 'Hennur', 1800),
    ageDays: 3,
  },
  {
    id: 'hsg-agent-byrathi',
    author: 'student-aditya',
    postedAs: 'owner_contact',
    stayType: 'flat',
    title: '2BHK flat via an agent, Byrathi',
    description: 'Agent listing. One month rent as brokerage.',
    brokerage: { charged: true, amount: 18000 },
    whoCanStay: 'anyone',
    moveIn: { inDays: 1 },
    bedsLeft: 3,
    sharing: 2,
    rentPp: 6000,
    deposit: 50000,
    rentTerms: { includes: ['maintenance'], noticeMonths: 2 },
    furnishing: 'unfurnished',
    amenities: ['Lift', 'Security'],
    place: main('area-byrathi'),
    ageDays: 4,
  },
  // Roommates.
  {
    id: 'hsg-roommate-kerala',
    author: 'student-joel',
    postedAs: 'tenant',
    stayType: 'flat',
    title: 'We are 2, looking for a third',
    description: 'Big flat, own room for you. We cook on weekends.',
    whoCanStay: 'boys',
    houseRules: ['no_smoking'],
    moveIn: 'next_sem',
    bedsLeft: 1,
    sharing: 1,
    rentPp: 8000,
    deposit: 16000,
    rentTerms: { includes: ['wifi'] },
    furnishing: 'semi_furnished',
    amenities: ['Wifi', 'Fridge', 'Kitchen'],
    place: main('shelter-apartments'),
    roommate: { sleep: 'late', tidiness: 'tidy', smoking: 'no', note: 'We speak Malayalam and English. Both from Kerala.' },
    ageDays: 1,
  },
  {
    id: 'hsg-roommate-airport',
    author: 'verified-kju-airport',
    campusId: KJU_AIRPORT,
    postedAs: 'tenant',
    stayType: 'flat',
    title: 'Roommate wanted near Airport Road campus',
    description: 'Shared room in a 1BHK. Ten minutes to class.',
    whoCanStay: 'boys',
    moveIn: 'now',
    bedsLeft: 1,
    sharing: 2,
    rentPp: 7000,
    deposit: 14000,
    rentTerms: { includes: ['electricity', 'water'] },
    furnishing: 'furnished',
    amenities: ['Wifi', 'Geyser'],
    place: airport('area-dasanayakanahalli'),
    roommate: { sleep: 'early', tidiness: 'relaxed', smoking: 'outside', note: 'I speak Hindi and English. From Bihar.' },
    ageDays: 2,
  },
  // Replacements and sublets.
  {
    id: 'hsg-replacement-girls',
    author: 'girls-approved',
    audience: 'girls',
    postedAs: 'leaving',
    stayType: 'pg',
    title: 'Replacement needed for my PG bed',
    description: 'Moving to the hostel. Deposit moves to you.',
    whoCanStay: 'girls',
    houseRules: ['curfew', 'no_overnight_guests'],
    moveIn: { inDays: 12 },
    bedsLeft: 1,
    sharing: 3,
    rentPp: 8500,
    deposit: 10000,
    rentTerms: { includes: ['electricity', 'wifi', 'laundry'] },
    furnishing: 'furnished',
    amenities: ['Wifi', 'Laundry', 'CCTV'],
    place: main('livesta'),
    ageDays: 2,
  },
  {
    id: 'hsg-sublet-winter',
    author: 'student-rahul',
    postedAs: 'leaving',
    stayType: 'flat',
    title: 'Sublet my room for two months',
    description: 'Away for an internship. Back in January.',
    whoCanStay: 'anyone',
    moveIn: { inDays: 1 },
    bedsLeft: 1,
    sharing: 1,
    rentPp: 9000,
    deposit: 5000,
    rentTerms: { includes: ['wifi', 'electricity'], noticeMonths: 0 },
    furnishing: 'furnished',
    amenities: ['Wifi', 'Study table'],
    place: main('area-kothanur'),
    ageDays: 1,
  },
  // Lifecycle states.
  {
    id: 'hsg-hostel-booked',
    author: 'student-aditya',
    postedAs: 'tenant',
    stayType: 'hostel',
    status: 'booked',
    title: 'Hostel bed near Navajyothi',
    description: 'Someone is visiting tomorrow. Ask to be next.',
    whoCanStay: 'boys',
    houseRules: ['curfew', 'no_drinking'],
    moveIn: 'now',
    bedsLeft: 1,
    sharing: 4,
    rentPp: 6500,
    deposit: 6500,
    rentTerms: { period: 'semester', includes: ['electricity', 'water', 'wifi'] },
    furnishing: 'furnished',
    amenities: ['Wifi', 'Study room'],
    place: main('navajyothi'),
    ageDays: 3,
  },
  {
    id: 'hsg-triple-price-drop',
    author: 'student-farhan',
    postedAs: 'owner_contact',
    stayType: 'pg',
    title: 'Triple sharing PG, rent lowered',
    description: 'Rent cut from Rs 8.5k to Rs 7.5k this week.',
    whoCanStay: 'boys',
    moveIn: 'now',
    bedsLeft: 2,
    sharing: 3,
    rentPp: 7500,
    deposit: 10000,
    rentTerms: { includes: ['electricity', 'wifi'] },
    furnishing: 'furnished',
    amenities: ['Wifi', 'Gym'],
    place: main('hanuman-arch'),
    ageDays: 6,
    confirmedDaysAgo: 2,
  },
  {
    id: 'hsg-flat-nudge',
    author: 'verified-kju-main',
    postedAs: 'tenant',
    stayType: 'flat',
    title: 'Room in a 3BHK near Bhartiya City',
    description: 'Two working seniors live here. Calm flat.',
    whoCanStay: 'anyone',
    moveIn: { inDays: 5 },
    bedsLeft: 1,
    sharing: 1,
    rentPp: 11000,
    deposit: 33000,
    rentTerms: { includes: ['maintenance', 'cleaning'] },
    furnishing: 'semi_furnished',
    amenities: ['Lift', 'Gym', 'Pool'],
    place: main('bhartiya-city'),
    ageDays: 9,
    confirmedDaysAgo: 4,
  },
  {
    id: 'hsg-girls-pg',
    author: 'student-tanvi',
    audience: 'girls',
    postedAs: 'owner_contact',
    stayType: 'pg',
    title: "Girls PG near St Mary's Church",
    description: 'Warden on site. Two minute walk to campus.',
    whoCanStay: 'girls',
    houseRules: ['curfew', 'veg_only', 'no_overnight_guests'],
    moveIn: 'next_sem',
    bedsLeft: 2,
    sharing: 2,
    rentPp: 10000,
    deposit: 20000,
    rentTerms: { period: 'quarterly', includes: ['electricity', 'wifi', 'cleaning', 'laundry'] },
    furnishing: 'furnished',
    amenities: ['Wifi', 'CCTV', 'Laundry'],
    place: main('st-marys-church'),
    ageDays: 1,
  },
  {
    id: 'hsg-pg-cmr',
    author: 'student-isha',
    campusId: KJU_AIRPORT,
    postedAs: 'owner_contact',
    stayType: 'pg',
    title: 'PG rooms near CMR University',
    description: 'New building. Single and double rooms.',
    whoCanStay: 'anyone',
    moveIn: 'now',
    bedsLeft: 4,
    sharing: 2,
    rentPp: 8000,
    deposit: 16000,
    rentTerms: { includes: ['electricity', 'wifi'] },
    furnishing: 'furnished',
    amenities: ['Wifi', 'Power backup'],
    place: airport('cmr-university'),
    ageDays: 5,
  },
  {
    id: 'hsg-filled-bds',
    author: 'student-vivek',
    postedAs: 'tenant',
    stayType: 'flat',
    status: 'filled',
    title: 'Flatmate found, thanks all',
    description: 'Room in BDS Nagar is taken now.',
    whoCanStay: 'boys',
    moveIn: 'now',
    bedsLeft: 0,
    sharing: 1,
    rentPp: 7000,
    deposit: 14000,
    furnishing: 'semi_furnished',
    amenities: ['Wifi'],
    place: main('area-bds-nagar'),
    ageDays: 12,
  },
  {
    id: 'hsg-needs-confirmation',
    author: 'student-joel',
    postedAs: 'leaving',
    stayType: 'pg',
    status: 'needs_confirmation',
    title: 'PG bed free near Royal Mart',
    description: 'Leaving after exams. Owner is easy going.',
    whoCanStay: 'boys',
    moveIn: { inDays: 25 },
    bedsLeft: 1,
    sharing: 2,
    rentPp: 8000,
    deposit: 12000,
    rentTerms: { includes: ['wifi'] },
    furnishing: 'furnished',
    amenities: ['Wifi', 'Geyser'],
    place: main('royal-mart'),
    ageDays: 10,
  },
];

/** 12+ housing listings with serials KJU-H0001 upward. */
export function buildHousingListings(now: Date): FixtureDoc<HousingListingDoc>[] {
  return SPECS.map((spec, index) => build(now, spec, index));
}
