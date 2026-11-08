import { Timestamp } from 'firebase-admin/firestore';
import type { DocTime } from '@/types/campus';
import type { FakeFirestore } from './fakeAdmin.ts';
import { CAMPUS_COLLECTIONS } from '../campus/constants.ts';
import { buildCampusFixtures, type FixtureDoc } from '../campus/fixtures/index.ts';

/** Print shops live outside the campus collections. */
export const SHOPS_COLLECTION = 'shops';

/** Print orders and user profiles also live outside the campus collections. */
export const ORDERS_COLLECTION = 'orders';
export const USERS_COLLECTION = 'users';

/** Serial numbers have four digits per college and product. */
const SERIAL_CAPACITY = 10_000;

/** Firestore rejects undefined; optional fields are dropped instead. */
function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (!value || typeof value !== 'object' || value instanceof Timestamp) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, withoutUndefined(item)]),
  );
}

function seedAll(db: FakeFirestore, collection: string, docs: readonly FixtureDoc<object>[]): void {
  for (const doc of docs) db.seedDoc(`${collection}/${doc.id}`, withoutUndefined(doc.data) as Record<string, unknown>);
}

/** Reserves each listing's serial and records how many serials each product used. */
function seedSerials(db: FakeFirestore, now: Date, product: 'M' | 'H', docs: readonly FixtureDoc<{ serial: string; collegeCode: string; createdAt: DocTime }>[]): void {
  const used = new Map<string, number>();
  for (const doc of docs) {
    const { serial, collegeCode, createdAt } = doc.data;
    db.seedDoc(`${CAMPUS_COLLECTIONS.serialReservations}/${serial}`, { serial, collegeCode, product, contentId: doc.id, createdAt });
    used.set(collegeCode, (used.get(collegeCode) ?? 0) + 1);
  }
  for (const [collegeCode, reserved] of used) {
    db.seedDoc(`${CAMPUS_COLLECTIONS.serialMetrics}/${collegeCode}-${product}`, {
      collegeCode,
      product,
      reserved,
      capacity: SERIAL_CAPACITY,
      updatedAt: Timestamp.fromDate(now),
    });
  }
}

/**
 * Fills the fixture database once, when fixture mode first creates it.
 * Every campus collection gets documents, with dates relative to `now`,
 * plus the print shops, print orders and user profiles. Writes are synchronous (`db.seedDoc`).
 */
export function seedFakeDb(db: FakeFirestore, now: Date = new Date()): void {
  const fixtures = buildCampusFixtures(now);
  const c = CAMPUS_COLLECTIONS;
  seedAll(db, c.colleges, fixtures.collegeConfigs);
  seedAll(db, c.memberships, fixtures.memberships);
  seedAll(db, SHOPS_COLLECTION, fixtures.shops);
  seedAll(db, c.market, fixtures.market);
  seedAll(db, c.housing, fixtures.housing);
  seedSerials(db, now, 'M', fixtures.market);
  seedSerials(db, now, 'H', fixtures.housing);
  seedAll(db, c.deals, fixtures.deals);
  seedAll(db, c.lostFound, fixtures.lostFound);
  seedAll(db, c.bloodRequests, fixtures.bloodRequests);
  seedAll(db, c.bloodDonors, fixtures.bloodDonors);
  seedAll(db, c.games, fixtures.games);
  seedAll(db, c.contactRequests, fixtures.contactRequests);
  seedAll(db, c.saves, fixtures.saves);
  seedAll(db, c.reports, fixtures.reports);
  seedAll(db, c.media, fixtures.media);
  seedAll(db, c.notifications, fixtures.notifications);
  seedAll(db, c.notificationPrefs, fixtures.notificationPrefs);
  seedAll(db, ORDERS_COLLECTION, fixtures.orders);
  seedAll(db, USERS_COLLECTION, fixtures.users);
}
