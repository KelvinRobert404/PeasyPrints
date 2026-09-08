export type CampusAudience = 'campus' | 'girls';
export type VerificationKind = 'student' | 'girls_space';
export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';

export interface VerificationState {
  status: VerificationStatus;
  method?: 'college_email' | 'id_card';
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
}

export interface CampusSession {
  signedIn: boolean;
  membership: CollegeMembership | null;
  verifiedStudent: boolean;
  girlsSpaceApproved: boolean;
  unreadContactRequests: number;
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

