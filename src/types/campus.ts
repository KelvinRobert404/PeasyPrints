export type CampusAudience = 'campus' | 'girls';
export type VerificationKind = 'student' | 'girls_space';
export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
/** How a student proved they belong. 'google' is a college Google account, 'email_code' a code sent to the college inbox. */
export type VerificationMethod = 'college_email' | 'google' | 'email_code' | 'id_card';

export interface VerificationState {
  status: VerificationStatus;
  method?: VerificationMethod;
  expiresAt?: string | null;
}

export interface CollegeMembership {
  userId: string;
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  displayName: string;
  student: VerificationState;
  girlsSpace: VerificationState;
  /** Campus inside the college, e.g. 'kju-main'. Set once, never asked again. */
  campusId?: string;
  /** Header label for the campus, e.g. 'KJU Main'. */
  campusLabel?: string;
  /** Where the student lives. Distance only, never coordinates. */
  stay?: MembershipStay;
  course?: MembershipCourse;
}

export type StayType = 'pg' | 'flat' | 'hostel' | 'home';

export interface MembershipStay {
  type: StayType;
  /** Rough metres from campus, from optional phone GPS. Null when not shared. */
  distanceM: number | null;
}

export interface MembershipCourse {
  programmeId: string;
  specialisation: string | null;
  semester: number;
}

/** The campus the session resolved to. Comes from the session, never asked. */
export interface CampusRef {
  id: string;
  collegeId: string;
  code: string;
  label: string;
}

export type OnboardingStep = 'college' | 'verify' | 'course';

export interface CampusOnboarding {
  /** Next step the student still needs, or null when done. */
  needs: OnboardingStep | null;
}

export interface CampusSession {
  signedIn: boolean;
  membership: CollegeMembership | null;
  verifiedStudent: boolean;
  girlsSpaceApproved: boolean;
  unreadContactRequests: number;
  campus?: CampusRef | null;
  onboarding?: CampusOnboarding;
}

/** Who a listing is for. Shown as 'For girls / For boys / Anyone'. */
export type GenderPref = 'girls' | 'boys' | 'anyone';

/**
 * Where a listing sits. Posters may pick a landmark; viewers only see the
 * label, area and a rough distance. lat/lng stay server side.
 */
export interface ListingPlace {
  landmarkId: string | null;
  label: string;
  area: string;
  lat: number | null;
  lng: number | null;
  campusId: string;
  roughDistanceM: number | null;
}

/** Structural Firestore timestamp, so fakes and fixtures need no SDK. */
export interface DocTime {
  toDate(): Date;
  toMillis(): number;
}

/** A stored doc shape with every DocTime turned into an ISO string. */
export type SerializedDoc<T> = T extends DocTime
  ? string
  : T extends Date
    ? string
    : T extends readonly (infer U)[]
      ? SerializedDoc<U>[]
      : T extends object
        ? { [K in keyof T]: SerializedDoc<T[K]> }
        : T;

/** The poster as viewers see them. Only verified students can post. */
export interface VerifiedPoster {
  displayName: string;
  verified: true;
}

export type MarketplacePostType = 'sell' | 'wanted' | 'free';
export type MarketplaceCategory =
  | 'books_notes'
  | 'fashion'
  | 'electronics'
  | 'hostel_essentials'
  | 'cycles_transport'
  | 'miscellaneous';

export type CampusContentStatus = 'active' | 'needs_confirmation' | 'sold' | 'filled' | 'closed' | 'removed';

export interface MarketplaceListing {
  id: string;
  serial: string;
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  audience: CampusAudience;
  postType: MarketplacePostType;
  category: MarketplaceCategory;
  status: CampusContentStatus;
  title: string;
  description: string;
  price: number | null;
  negotiable: boolean;
  condition?: string | null;
  images: string[];
  pickupPointId?: string | null;
  pickupLabel?: string | null;
  area?: string | null;
  seller: { displayName: string; verified: true };
  promotionEligible: boolean;
  isSaved?: boolean;
  isOwner?: boolean;
  createdAt: string;
  availabilityExpiresAt: string;
}

export type HousingPostType = 'room' | 'roommate' | 'replacement' | 'sublet';

export interface HousingPost {
  id: string;
  serial: string;
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  audience: CampusAudience;
  postType: HousingPostType;
  status: CampusContentStatus;
  title: string;
  description: string;
  rent: number | null;
  deposit: number | null;
  availableFrom?: string | null;
  area: string;
  commuteLabel?: string | null;
  occupancy?: string | null;
  furnishing?: string | null;
  amenities: string[];
  images: string[];
  compatibility?: {
    budget?: number | null;
    moveInDate?: string | null;
    sleepSchedule?: string | null;
    foodPreference?: string | null;
    cleanliness?: string | null;
    smokingPreference?: string | null;
  } | null;
  poster: { displayName: string; verified: true };
  promotionEligible: boolean;
  isSaved?: boolean;
  isOwner?: boolean;
  createdAt: string;
  availabilityExpiresAt: string;
}

export interface ContactRequest {
  id: string;
  contentType: 'marketplace' | 'housing';
  contentId: string;
  serial: string;
  buyerId: string;
  sellerId: string;
  buyerDisplayName: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
  whatsappUrl?: string;
}

export interface RenderPackSnapshot {
  id: string;
  serial: string;
  title: string;
  imageUrl: string;
  collegeCode: string;
  priceLabel: string;
  metadata: string[];
  deepLink: string;
}


export type * from './market';
export type * from './housing';
export type * from './utilities';
export type * from './notifications';
