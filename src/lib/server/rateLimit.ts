import crypto from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';

export async function checkRateLimit(scope: string, principal: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const windowId = Math.floor(now / (windowSeconds * 1000));
  const id = crypto.createHash('sha256').update(`${scope}:${principal}:${windowId}`).digest('hex');
  const ref = getAdminDb().collection('_rate_limits').doc(id);
  const allowed = await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.count || 0);
    if (count >= limit) return false;
    if (snapshot.exists) transaction.update(ref, { count: FieldValue.increment(1), updatedAt: Timestamp.now() });
    else transaction.create(ref, { scope, count: 1, expiresAt: Timestamp.fromMillis((windowId + 2) * windowSeconds * 1000), createdAt: Timestamp.now() });
    return true;
  });
  return { allowed, retryAfter: Math.max(1, Math.ceil(((windowId + 1) * windowSeconds * 1000 - now) / 1000)) };
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } });
}
