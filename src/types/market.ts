import type { CampusAudience, DocTime, GenderPref, ListingPlace, SerializedDoc, VerifiedPoster } from './campus';

/** What a market post is. Each kind carries its own details. */
export type MarketKind = 'item' | 'wanted' | 'bundle' | 'seat' | 'cab_split' | 'ticket' | 'pass' | 'vehicle';

export type MarketCategory =
  | 'books_notes'
  | 'electronics'
  | 'fashion'
  | 'hostel_essentials'
  | 'stationery'
  | 'sports_fitness'
  | 'music'
  | 'cycles'
  | 'travel'
  | 'other';

/** How the price is meant. Feeds formatPrice ('Rs 1.5k', 'Rs 8.5k pp'). */
export type PriceTerms = 'fixed' | 'negotiable' | 'free' | 'swap' | 'per_person';

export type MarketStatus =
  | 'active'
  | 'needs_confirmation'
  | 'reserved'
  | 'booked'
  | 'sold'
  | 'filled'
  | 'expired'
  | 'closed'
  | 'removed';

export type ItemCondition = 'new' | 'like_new' | 'good' | 'used' | 'needs_repair';

export interface ItemDetails {
  kind: 'item';
  condition: ItemCondition | null;
  brand: string | null;
}

export interface WantedDetails {
  kind: 'wanted';
  /** Highest the student will pay. Null means open. */
  budgetMax: number | null;
  neededBy: DocTime | null;
}

export interface BundlePart {
  title: string;
  price: number | null;
}

export interface BundleDetails {
  kind: 'bundle';
  parts: BundlePart[];
  /** True when parts can be bought one by one. */
  splitOk: boolean;
}

/** A spare seat passed on: a ride, a class batch, a library slot. */
export interface SeatDetails {
  kind: 'seat';
  seatFor: string;
  startsAt: DocTime | null;
  endsAt: DocTime | null;
  seatsLeft: number;
}

export interface CabSplitDetails {
  kind: 'cab_split';
  from: string;
  to: string;
  leavesAt: DocTime;
  seatsLeft: number;
  /** Whole fare before splitting. Price on the listing is per person. */
  totalFare: number | null;
}

export interface TicketDetails {
  kind: 'ticket';
  happensAt: DocTime;
  venue: string | null;
  quantity: number;
}

export type PassType = 'bus' | 'metro' | 'gym' | 'library' | 'other';

export interface PassDetails {
  kind: 'pass';
  passType: PassType;
  validUntil: DocTime | null;
}

export type VehicleType = 'cycle' | 'scooter' | 'bike' | 'other';
export type VehicleOffer = 'sale' | 'rent';

export interface VehicleDetails {
  kind: 'vehicle';
  vehicleType: VehicleType;
  offer: VehicleOffer;
  year: number | null;
  kmDriven: number | null;
  papersOk: boolean | null;
}

export type MarketDetails =
  | ItemDetails
  | WantedDetails
  | BundleDetails
  | SeatDetails
  | CabSplitDetails
  | TicketDetails
  | PassDetails
  | VehicleDetails;

export type MarketDetailsFor<K extends MarketKind> = Extract<MarketDetails, { kind: K }>;

/** Stored market listing (Firestore). */
export interface MarketListingDoc {
  authorId: string;
  serial: string;
  collegeId: string;
  collegeCode: string;
  campusId: string;
  audience: CampusAudience;
  kind: MarketKind;
  category: MarketCategory;
  status: MarketStatus;
  title: string;
  description: string;
  /** Rupees. Null for free or open budget. */
  price: number | null;
  priceTerms: PriceTerms;
  /** Last price before a drop, for the price-drop badge. */
  previousPrice: number | null;
  priceDroppedAt: DocTime | null;
  images: string[];
  place: ListingPlace | null;
  genderPref: GenderPref;
  details: MarketDetails;
  sellerDisplayName: string;
  promotionEligible: boolean;
  reservedBy: string | null;
  reservedUntil: DocTime | null;
  /** Last time the seller confirmed it is still available. */
  confirmedAt: DocTime | null;
  createdAt: DocTime;
  updatedAt: DocTime;
  availabilityExpiresAt: DocTime;
}

/** Market listing as sent to the client. */
export type MarketListing = Omit<
  SerializedDoc<MarketListingDoc>,
  'authorId' | 'reservedBy' | 'sellerDisplayName' | 'place'
> & {
  id: string;
  /** Place without coordinates. */
  place: Omit<ListingPlace, 'lat' | 'lng'> | null;
  seller: VerifiedPoster;
  reservedByViewer?: boolean;
  isSaved?: boolean;
  isOwner?: boolean;
};
