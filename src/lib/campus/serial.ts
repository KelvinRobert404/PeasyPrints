// Runtime imports are relative with the .ts extension, and Firebase loads lazily,
// so node tests can import the pure helpers below.
import crypto from 'crypto';
import { CAMPUS_COLLECTIONS } from './constants.ts';
import { formatCampusSerial } from './policy.ts';

/** The listing products that carry a campus serial. */
export type CampusContentType = 'marketplace' | 'housing';

/** The v2 collections that hold serial-numbered listings. */
export type CampusListingCollection = typeof CAMPUS_COLLECTIONS.market | typeof CAMPUS_COLLECTIONS.housing;

/** Maps a contentType to its v2 listing collection. */
export function collectionForContentType(type: CampusContentType): CampusListingCollection {
  return type === 'marketplace' ? CAMPUS_COLLECTIONS.market : CAMPUS_COLLECTIONS.housing;
}

/** 'offer' answers a wanted post; 'ask' is about a listing. */
export type ContactIntent = 'ask' | 'offer';

/** The intent of a new contact request, from the listing it is about. */
export function intentFor(type: CampusContentType, listing: { kind?: unknown }): ContactIntent {
  return type === 'marketplace' && listing.kind === 'wanted' ? 'offer' : 'ask';
}

/** The intent of a stored contact request; one saved without it derives it from listingKind. */
export function contactRequestIntent(request: { intent?: unknown; contentType?: unknown; listingKind?: unknown }): ContactIntent {
  if (request.intent === 'offer' || request.intent === 'ask') return request.intent;
  const type: CampusContentType = request.contentType === 'marketplace' ? 'marketplace' : 'housing';
  return intentFor(type, { kind: request.listingKind });
}

function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (!value || typeof value !== 'object' || typeof (value as { toDate?: unknown }).toDate === 'function') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, withoutUndefined(item)])
  );
}

export async function createCampusContentWithSerial<T extends Record<string, unknown>>(options: {
  collection: CampusListingCollection;
  collegeCode: string;
  product: 'M' | 'H';
  payload: T;
}) {
  const [{ Timestamp }, { getAdminDb }] = await Promise.all([
    import('firebase-admin/firestore'),
    import('../firebase/admin.ts'),
  ]);
  const db = getAdminDb();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const digits = crypto.randomInt(0, 10_000).toString().padStart(4, '0');
    const serial = formatCampusSerial(options.collegeCode, options.product, Number(digits));
    const reservationRef = db.collection(CAMPUS_COLLECTIONS.serialReservations).doc(serial);
    const metricRef = db.collection(CAMPUS_COLLECTIONS.serialMetrics).doc(`${options.collegeCode}-${options.product}`);
    const contentRef = db.collection(options.collection).doc();

    const created = await db.runTransaction(async (transaction) => {
      const [existing, metric] = await Promise.all([
        transaction.get(reservationRef),
        transaction.get(metricRef),
      ]);
      if (existing.exists) return false;
      transaction.create(reservationRef, {
        serial,
        collegeCode: options.collegeCode,
        product: options.product,
        contentId: contentRef.id,
        createdAt: Timestamp.now(),
      });
      transaction.create(contentRef, withoutUndefined({ ...options.payload, serial }) as Record<string, unknown>);
      transaction.set(metricRef, {
        collegeCode: options.collegeCode,
        product: options.product,
        reserved: Number(metric.data()?.reserved || 0) + 1,
        capacity: 10_000,
        updatedAt: Timestamp.now(),
      }, { merge: true });
      return true;
    });

    if (created) return { id: contentRef.id, serial };
  }
  throw new Error('Unable to reserve a campus serial number');
}
