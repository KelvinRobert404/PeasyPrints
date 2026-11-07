import type { CampusAudience, DocTime, GenderPref, ListingPlace, SerializedDoc, StayType, VerifiedPoster } from './campus';

/** Who is posting. Every poster is a verified student. */
export type HousingPostedAs = 'tenant' | 'leaving' | 'owner_contact';

export type HousingStayType = Exclude<StayType, 'home'>;

export type HousingStatus = 'active' | 'needs_confirmation' | 'booked' | 'filled' | 'expired' | 'closed' | 'removed';

export type Furnishing = 'furnished' | 'semi_furnished' | 'unfurnished';

export type HouseRule =
  | 'no_smoking'
  | 'no_drinking'
  | 'no_overnight_guests'
  | 'curfew'
  | 'quiet_hours'
  | 'veg_only';

export type RentPeriod = 'monthly' | 'quarterly' | 'semester' | 'yearly';

export type RentInclusion = 'electricity' | 'water' | 'wifi' | 'cleaning' | 'laundry' | 'maintenance';

export interface RentTerms {
  period: RentPeriod;
  includes: RentInclusion[];
  /** Months of notice before leaving. */
  noticeMonths: number | null;
}

export interface Brokerage {
  charged: boolean;
  /** Rupees, when charged. */
  amount: number | null;
}

export type SleepPattern = 'early' | 'late' | 'flexible';
export type Tidiness = 'tidy' | 'relaxed';
export type SmokingPref = 'no' | 'outside' | 'ok';

export interface RoommatePrefs {
  sleep: SleepPattern | null;
  tidiness: Tidiness | null;
  smoking: SmokingPref | null;
  note: string | null;
}

/** Stored housing listing (Firestore). */
export interface HousingListingDoc {
  authorId: string;
  serial: string;
  collegeId: string;
  collegeCode: string;
  campusId: string;
  audience: CampusAudience;
  postedAs: HousingPostedAs;
  stayType: HousingStayType;
  status: HousingStatus;
  title: string;
  description: string;
  brokerage: Brokerage;
  whoCanStay: GenderPref;
  houseRules: HouseRule[];
  /** Move-in date. Null means right away. */
  moveIn: DocTime | null;
  bedsLeft: number;
  /** People sharing one room. */
  sharing: number | null;
  /** Rent per person per period, in rupees. */
  rentPp: number;
  deposit: number | null;
  rentTerms: RentTerms;
  furnishing: Furnishing | null;
  amenities: string[];
  images: string[];
  place: ListingPlace;
  roommate: RoommatePrefs | null;
  posterDisplayName: string;
  promotionEligible: boolean;
  confirmedAt: DocTime | null;
  createdAt: DocTime;
  updatedAt: DocTime;
  availabilityExpiresAt: DocTime;
}

/** Housing listing as sent to the client. */
export type HousingListing = Omit<SerializedDoc<HousingListingDoc>, 'authorId' | 'posterDisplayName' | 'place'> & {
  id: string;
  /** Place without coordinates. */
  place: Omit<ListingPlace, 'lat' | 'lng'>;
  poster: VerifiedPoster;
  isSaved?: boolean;
  isOwner?: boolean;
};
