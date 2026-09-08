import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { formatCampusSerial } from './policy';

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
  collection: 'marketplace_listings' | 'housing_posts';
  collegeCode: string;
  product: 'M' | 'H';
  payload: T;
}) {
  const db = getAdminDb();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const digits = crypto.randomInt(0, 10_000).toString().padStart(4, '0');
    const serial = formatCampusSerial(options.collegeCode, options.product, Number(digits));
    const reservationRef = db.collection('campus_serial_reservations').doc(serial);
    const metricRef = db.collection('campus_serial_metrics').doc(`${options.collegeCode}-${options.product}`);
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
