import type { DocTime, ListingPlace, SerializedDoc, VerifiedPoster } from './campus';

/* Deals: student discounts near campus. */

export type DealCategory = 'stationery' | 'printing' | 'electronics' | 'fitness' | 'grooming' | 'travel' | 'other';

export type DealStatus = 'active' | 'expired' | 'removed';

export interface DealDoc {
  campusId: string;
  category: DealCategory;
  status: DealStatus;
  merchantName: string;
  title: string;
  /** Short offer line, e.g. '10% off with student ID'. */
  offer: string;
  code: string | null;
  howToClaim: string | null;
  place: ListingPlace | null;
  images: string[];
  validUntil: DocTime | null;
  createdBy: string;
  createdAt: DocTime;
  updatedAt: DocTime;
}

export type Deal = Omit<SerializedDoc<DealDoc>, 'createdBy' | 'place'> & {
  id: string;
  place: Omit<ListingPlace, 'lat' | 'lng'> | null;
  isSaved?: boolean;
};

/* Lost and found. */

export type LostFoundKind = 'lost' | 'found';

export type LostFoundCategory =
  | 'id_card'
  | 'keys'
  | 'phone'
  | 'wallet'
  | 'bag'
  | 'bottle'
  | 'electronics'
  | 'books'
  | 'clothing'
  | 'other';

export type LostFoundStatus = 'open' | 'returned' | 'closed' | 'removed';

export interface LostFoundDoc {
  authorId: string;
  campusId: string;
  kind: LostFoundKind;
  category: LostFoundCategory;
  status: LostFoundStatus;
  title: string;
  description: string;
  images: string[];
  /** Where it was lost or found. */
  place: ListingPlace | null;
  /** When it was lost or found. */
  happenedAt: DocTime | null;
  /** Where a found item is kept now, e.g. 'Security desk'. */
  keptAt: string | null;
  posterDisplayName: string;
  createdAt: DocTime;
  updatedAt: DocTime;
}

export type LostFoundItem = Omit<SerializedDoc<LostFoundDoc>, 'authorId' | 'posterDisplayName' | 'place'> & {
  id: string;
  place: Omit<ListingPlace, 'lat' | 'lng'> | null;
  poster: VerifiedPoster;
  isOwner?: boolean;
};

/* Blood: urgent requests and willing donors. */

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type BloodUrgency = 'now' | 'today' | 'this_week';

export type BloodRequestStatus = 'open' | 'fulfilled' | 'closed' | 'removed';

export interface BloodRequestDoc {
  authorId: string;
  campusId: string;
  bloodGroup: BloodGroup;
  units: number;
  urgency: BloodUrgency;
  status: BloodRequestStatus;
  hospital: string;
  area: string;
  /** For whom, kept short, e.g. 'Friend's mother'. */
  forWhom: string | null;
  neededBy: DocTime | null;
  posterDisplayName: string;
  createdAt: DocTime;
  updatedAt: DocTime;
}

export type BloodRequest = Omit<SerializedDoc<BloodRequestDoc>, 'authorId' | 'posterDisplayName'> & {
  id: string;
  poster: VerifiedPoster;
  isOwner?: boolean;
};

export interface BloodDonorDoc {
  userId: string;
  campusId: string;
  bloodGroup: BloodGroup;
  available: boolean;
  lastDonatedAt: DocTime | null;
  updatedAt: DocTime;
}

export type BloodDonor = Omit<SerializedDoc<BloodDonorDoc>, 'userId'>;

/* Games: find players for a game on or near campus. */

export type GameSport =
  | 'cricket'
  | 'football'
  | 'badminton'
  | 'basketball'
  | 'volleyball'
  | 'table_tennis'
  | 'chess'
  | 'carrom'
  | 'esports'
  | 'other';

export type GameLevel = 'casual' | 'serious';

export type GameStatus = 'open' | 'full' | 'done' | 'cancelled' | 'removed';

export interface GameDoc {
  authorId: string;
  campusId: string;
  sport: GameSport;
  level: GameLevel;
  status: GameStatus;
  title: string;
  note: string | null;
  place: ListingPlace | null;
  startsAt: DocTime;
  playersNeeded: number;
  playerIds: string[];
  posterDisplayName: string;
  createdAt: DocTime;
  updatedAt: DocTime;
}

export type Game = Omit<SerializedDoc<GameDoc>, 'authorId' | 'playerIds' | 'posterDisplayName' | 'place'> & {
  id: string;
  place: Omit<ListingPlace, 'lat' | 'lng'> | null;
  playersJoined: number;
  poster: VerifiedPoster;
  joined?: boolean;
  isOwner?: boolean;
};
