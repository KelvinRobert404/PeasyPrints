// Every fixture document for offline fixture mode, built for one seed time.
// fakeSeed.ts writes these into the fake Admin DB; tests check them.
import type { CampusAudience, DocTime } from '@/types/campus';
import type { Shop } from '@/types/models';
import type { HousingListingDoc } from '@/types/housing';
import type { MarketListingDoc } from '@/types/market';
import type { NotificationDoc, NotificationPrefsDoc } from '@/types/notifications';
import type { BloodDonorDoc, BloodRequestDoc, DealDoc, GameDoc, LostFoundDoc } from '@/types/utilities';
import { CONTACT_REQUEST_HOURS } from '../constants.ts';
import {
  FIXTURE_SHOPS,
  KJU,
  KJU_MAIN,
  buildCollegeConfigs,
  buildMemberships,
  displayNameOf,
  fixtureTime,
  type CollegeConfigFixtureDoc,
  type FixtureDoc,
  type MembershipFixtureDoc,
} from './core.ts';
import { buildHousingListings } from './housing.ts';
import { buildMarketListings } from './market.ts';
import { buildBloodDonors, buildBloodRequests, buildDeals, buildGames, buildLostFound } from './utilities.ts';

export * from './core.ts';
export { buildMarketListings } from './market.ts';
export { buildHousingListings } from './housing.ts';
export * from './utilities.ts';

/* Activity docs. No shared type exists for these yet, so the stored shapes live here. */

export type ContentType = 'marketplace' | 'housing';

export interface ContactRequestFixtureDoc {
  contentType: ContentType;
  contentId: string;
  serial: string;
  audience: CampusAudience;
  collegeId: string;
  buyerId: string;
  buyerDisplayName: string;
  sellerId: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'expired';
  createdAt: DocTime;
  updatedAt: DocTime;
  expiresAt: DocTime;
}

export interface SaveFixtureDoc {
  userId: string;
  contentType: ContentType;
  contentId: string;
  createdAt: DocTime;
}

export interface ReportFixtureDoc {
  reporterId: string;
  contentType: ContentType;
  contentId: string;
  serial: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: DocTime;
}

/** Uploaded image record. Nothing in the fixtures points at these, since the fake bucket starts empty. */
export interface MediaFixtureDoc {
  ownerId: string;
  collegeId: string;
  audience: CampusAudience;
  path: string;
  contentType: string;
  createdAt: DocTime;
}

export type ShopFixtureDoc = Omit<Shop, 'id'>;

export interface CampusFixtures {
  memberships: FixtureDoc<MembershipFixtureDoc>[];
  collegeConfigs: FixtureDoc<CollegeConfigFixtureDoc>[];
  shops: FixtureDoc<ShopFixtureDoc>[];
  market: FixtureDoc<MarketListingDoc>[];
  housing: FixtureDoc<HousingListingDoc>[];
  deals: FixtureDoc<DealDoc>[];
  lostFound: FixtureDoc<LostFoundDoc>[];
  bloodRequests: FixtureDoc<BloodRequestDoc>[];
  bloodDonors: FixtureDoc<BloodDonorDoc>[];
  games: FixtureDoc<GameDoc>[];
  contactRequests: FixtureDoc<ContactRequestFixtureDoc>[];
  saves: FixtureDoc<SaveFixtureDoc>[];
  reports: FixtureDoc<ReportFixtureDoc>[];
  media: FixtureDoc<MediaFixtureDoc>[];
  notifications: FixtureDoc<NotificationDoc>[];
  notificationPrefs: FixtureDoc<NotificationPrefsDoc>[];
}

type Listing = FixtureDoc<MarketListingDoc> | FixtureDoc<HousingListingDoc>;

function find<T extends Listing>(listings: T[], id: string): T {
  const listing = listings.find((item) => item.id === id);
  if (!listing) throw new Error(`Unknown fixture listing: ${id}`);
  return listing;
}

function contactRequest(
  now: Date,
  id: string,
  contentType: ContentType,
  listing: Listing,
  buyerId: string,
  status: ContactRequestFixtureDoc['status'],
  hoursAgo: number,
): FixtureDoc<ContactRequestFixtureDoc> {
  const created = -hoursAgo / 24;
  return {
    id,
    data: {
      contentType,
      contentId: listing.id,
      serial: listing.data.serial,
      audience: listing.data.audience,
      collegeId: listing.data.collegeId,
      buyerId,
      buyerDisplayName: displayNameOf(buyerId),
      sellerId: listing.data.authorId,
      status,
      createdAt: fixtureTime(now, created),
      updatedAt: fixtureTime(now, status === 'pending' ? created : created / 2),
      expiresAt: fixtureTime(now, created + CONTACT_REQUEST_HOURS / 24),
    },
  };
}

function save(now: Date, userId: string, contentType: ContentType, contentId: string, daysAgo: number): FixtureDoc<SaveFixtureDoc> {
  return { id: `${userId}_${contentType}_${contentId}`, data: { userId, contentType, contentId, createdAt: fixtureTime(now, -daysAgo) } };
}

function notification(
  now: Date,
  id: string,
  fields: Omit<NotificationDoc, 'campusId' | 'readAt' | 'createdAt' | 'actorDisplayName'> & {
    actor?: string;
    hoursAgo: number;
    campusId?: string | null;
  },
): FixtureDoc<NotificationDoc> {
  const createdAt = fixtureTime(now, -fields.hoursAgo / 24);
  return {
    id,
    data: {
      userId: fields.userId,
      campusId: fields.campusId === undefined ? KJU_MAIN : fields.campusId,
      kind: fields.kind,
      title: fields.title,
      body: fields.body,
      href: fields.href,
      ref: fields.ref,
      actorDisplayName: fields.actor ? displayNameOf(fields.actor) : null,
      read: fields.read,
      readAt: fields.read ? createdAt : null,
      createdAt,
    },
  };
}

function buildActivity(now: Date, market: FixtureDoc<MarketListingDoc>[], housing: FixtureDoc<HousingListingDoc>[]) {
  const calculator = find(market, 'mkt-calculator');
  const mattress = find(market, 'mkt-mattress');
  const headphones = find(market, 'mkt-headphones');
  const cab = find(market, 'mkt-cab-airport');
  const kurta = find(market, 'mkt-girls-kurta');
  const nudgeFlat = find(housing, 'hsg-flat-nudge');
  const roommate = find(housing, 'hsg-roommate-kerala');

  const contactRequests = [
    contactRequest(now, 'cr-calculator-kabir', 'marketplace', calculator, 'verified-kju-airport', 'pending', 3),
    contactRequest(now, 'cr-mattress-kabir', 'marketplace', mattress, 'verified-kju-airport', 'approved', 10),
    contactRequest(now, 'cr-cab-farhan', 'marketplace', cab, 'student-farhan', 'pending', 5),
    contactRequest(now, 'cr-flat-joel', 'housing', nudgeFlat, 'student-joel', 'declined', 30),
    contactRequest(now, 'cr-roommate-sana', 'housing', roommate, 'verified-kju-main', 'pending', 6),
  ];

  const saves = [
    save(now, 'verified-kju-main', 'marketplace', headphones.id, 1),
    save(now, 'verified-kju-main', 'marketplace', 'mkt-bundle-bcom-books', 2),
    save(now, 'verified-kju-main', 'housing', roommate.id, 0.5),
    save(now, 'girls-approved', 'marketplace', 'mkt-girls-straightener', 1),
    save(now, 'verified-kju-airport', 'housing', 'hsg-pg-cmr', 3),
  ];

  const reports: FixtureDoc<ReportFixtureDoc>[] = [
    {
      id: 'verified-kju-main_marketplace_mkt-scooter',
      data: {
        reporterId: 'verified-kju-main',
        contentType: 'marketplace',
        contentId: 'mkt-scooter',
        serial: find(market, 'mkt-scooter').data.serial,
        reason: 'Price looks too low, may be a scam.',
        status: 'open',
        createdAt: fixtureTime(now, -0.5),
      },
    },
  ];

  const media: FixtureDoc<MediaFixtureDoc>[] = [
    {
      id: 'media-sana-draft',
      data: {
        ownerId: 'verified-kju-main',
        collegeId: KJU.collegeId,
        audience: 'campus',
        path: 'campus_media/verified-kju-main/media-sana-draft.jpg',
        contentType: 'image/jpeg',
        createdAt: fixtureTime(now, -0.1),
      },
    },
    {
      id: 'media-ananya-draft',
      data: {
        ownerId: 'girls-approved',
        collegeId: KJU.collegeId,
        audience: 'girls',
        path: 'campus_media/girls-approved/media-ananya-draft.jpg',
        contentType: 'image/jpeg',
        createdAt: fixtureTime(now, -0.2),
      },
    },
  ];

  const notifications = [
    notification(now, 'note-sana-contact', {
      userId: 'verified-kju-main',
      kind: 'contact_request',
      title: 'Kabir wants your calculator',
      body: 'Approve to share your number.',
      href: '/market/mkt-calculator',
      ref: { type: 'contact_request', id: 'cr-calculator-kabir' },
      actor: 'verified-kju-airport',
      read: false,
      hoursAgo: 3,
    }),
    notification(now, 'note-sana-nudge', {
      userId: 'verified-kju-main',
      kind: 'listing_nudge',
      title: 'Is your flat room still free?',
      body: 'Tap to keep it live for 7 more days.',
      href: '/housing/hsg-flat-nudge',
      ref: { type: 'housing_listing', id: 'hsg-flat-nudge' },
      read: false,
      hoursAgo: 2,
    }),
    notification(now, 'note-sana-price-drop', {
      userId: 'verified-kju-main',
      kind: 'price_drop',
      title: 'Headphones you saved got cheaper',
      body: 'Now Rs 1.8k.',
      href: '/market/mkt-headphones',
      ref: { type: 'market_listing', id: 'mkt-headphones' },
      read: true,
      hoursAgo: 20,
    }),
    notification(now, 'note-sana-game', {
      userId: 'verified-kju-main',
      kind: 'game_update',
      title: 'Football tomorrow needs 4 more',
      body: null,
      href: '/games/game-football-open',
      ref: { type: 'game', id: 'game-football-open' },
      actor: 'student-aditya',
      read: false,
      hoursAgo: 7,
    }),
    notification(now, 'note-sana-blood', {
      userId: 'verified-kju-main',
      kind: 'blood_request',
      title: 'B+ blood needed today',
      body: 'Falcon Hospital, Gulabi Road.',
      href: '/blood/blood-open',
      ref: { type: 'blood_request', id: 'blood-open' },
      read: false,
      hoursAgo: 2,
    }),
    notification(now, 'note-kabir-approved', {
      userId: 'verified-kju-airport',
      campusId: 'kju-airport-road',
      kind: 'contact_approved',
      title: 'Joel shared his number',
      body: 'Say hey on WhatsApp.',
      href: '/market/mkt-mattress',
      ref: { type: 'contact_request', id: 'cr-mattress-kabir' },
      actor: 'student-joel',
      read: false,
      hoursAgo: 8,
    }),
    notification(now, 'note-ananya-verified', {
      userId: 'girls-approved',
      kind: 'verification_approved',
      title: "You are in Girls' Space",
      body: null,
      href: '/girls-space',
      ref: { type: 'membership', id: 'girls-approved' },
      read: true,
      hoursAgo: 40 * 24,
    }),
    notification(now, 'note-ananya-deal', {
      userId: 'girls-approved',
      kind: 'new_deal',
      title: 'New deal on prints near you',
      body: '10% off with student ID.',
      href: '/deals/deal-prints',
      ref: { type: 'deal', id: 'deal-prints' },
      read: false,
      hoursAgo: 30,
    }),
    notification(now, 'note-ananya-kurta', {
      userId: 'girls-approved',
      kind: 'reserve_request',
      title: 'Someone asked about your kurta',
      body: null,
      href: '/market/mkt-girls-kurta',
      ref: { type: 'market_listing', id: kurta.id },
      read: false,
      hoursAgo: 4,
    }),
  ];

  const prefUsers = ['unverified-kju', 'pending-id-card', 'verified-kju-main', 'verified-kju-airport', 'girls-approved', 'admin'];
  const notificationPrefs: FixtureDoc<NotificationPrefsDoc>[] = prefUsers.map((userId) => ({
    id: userId,
    data: {
      userId,
      push: userId !== 'admin',
      kinds: userId === 'verified-kju-main' ? { new_deal: false } : {},
      updatedAt: fixtureTime(now, -1),
    },
  }));

  return { contactRequests, saves, reports, media, notifications, notificationPrefs };
}

/** Every fixture document, with dates relative to `now`. */
export function buildCampusFixtures(now: Date = new Date()): CampusFixtures {
  const market = buildMarketListings(now);
  const housing = buildHousingListings(now);
  return {
    memberships: buildMemberships(now),
    collegeConfigs: buildCollegeConfigs(now),
    shops: FIXTURE_SHOPS.map(({ id, ...shop }) => ({ id, data: shop })),
    market,
    housing,
    deals: buildDeals(now),
    lostFound: buildLostFound(now),
    bloodRequests: buildBloodRequests(now),
    bloodDonors: buildBloodDonors(now),
    games: buildGames(now),
    ...buildActivity(now, market, housing),
  };
}
