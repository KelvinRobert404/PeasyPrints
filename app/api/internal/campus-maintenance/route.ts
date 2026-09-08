import { NextRequest, NextResponse } from 'next/server';
import { DocumentReference, Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { isAvailable, toDate } from '@/lib/campus/serialize';
import { bearerToken, safeTokenEqual } from '@/lib/server/secrets';

function authorized(request: NextRequest) {
  const token = bearerToken(request.headers.get('authorization'));
  return safeTokenEqual(token, process.env.CRON_SECRET) || safeTokenEqual(token, process.env.CAMPUS_MAINTENANCE_TOKEN);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getAdminDb();
  const now = Date.now();
  const nowTimestamp = Timestamp.now();
  const [memberships, marketplace, housing, contacts, runningRenders, rateLimits, printTickets, fileOrders, payments] = await Promise.all([
    db.collection('campus_memberships').get(),
    db.collection('marketplace_listings').get(),
    db.collection('housing_posts').get(),
    db.collection('campus_contact_requests').get(),
    db.collection('campus_render_packs').where('status', '==', 'running').get(),
    db.collection('_rate_limits').where('expiresAt', '<=', nowTimestamp).limit(500).get(),
    db.collection('print_tickets').where('expiresAt', '<=', nowTimestamp).limit(500).get(),
    db.collection('orders').where('fileDeleteAfter', '<=', nowTimestamp).limit(200).get(),
    db.collection('payments').limit(500).get(),
  ]);
  const files = new Set<string>();
  const updates: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
  const availableContent = new Set<string>();
  const deletes: DocumentReference[] = [...rateLimits.docs, ...printTickets.docs].map((doc) => doc.ref);
  let retainedPrintFilesDeleted = 0;
  let reconciliationFlags = 0;

  memberships.docs.forEach((doc) => {
    const data = doc.data();
    const patch: Record<string, unknown> = {};
    const studentExpired = data.studentVerification?.status === 'approved' && (toDate(data.studentVerification.expiresAt)?.getTime() || 0) <= now;
    for (const [field, state] of [['studentVerification', data.studentVerification], ['girlsSpaceVerification', data.girlsSpaceVerification]] as const) {
      const expired = state?.status === 'approved' && ((toDate(state.expiresAt)?.getTime() || 0) <= now || (field === 'girlsSpaceVerification' && studentExpired));
      if (!expired) continue;
      if (state.idCardPath) files.add(state.idCardPath);
      patch[field] = { ...state, status: 'expired', idCardPath: null, expiredAt: Timestamp.now() };
    }
    if (Object.keys(patch).length) updates.push({ ref: doc.ref, data: { ...patch, updatedAt: Timestamp.now() } });
  });

  for (const [type, snapshot] of [['marketplace', marketplace], ['housing', housing]] as const) snapshot.docs.forEach((doc) => {
    if (isAvailable(doc.data())) availableContent.add(`${type}_${doc.id}`);
    if (doc.data().status === 'active' && (toDate(doc.data().availabilityExpiresAt)?.getTime() || 0) <= now) {
      updates.push({ ref: doc.ref, data: { status: 'needs_confirmation', updatedAt: Timestamp.now() } });
    }
  });

  contacts.docs.forEach((doc) => {
    const data = doc.data();
    const contentKey = `${data.contentType}_${data.contentId}`;
    if ((data.status === 'pending' && (toDate(data.expiresAt)?.getTime() || 0) <= now) || (data.status === 'approved' && !availableContent.has(contentKey))) {
      updates.push({ ref: doc.ref, data: { status: 'expired', updatedAt: Timestamp.now() } });
    }
  });

  runningRenders.docs.forEach((doc) => {
    const lockedAt = toDate(doc.data().lockedAt)?.getTime() || now;
    if (now - lockedAt > 2 * 60 * 60 * 1000) {
      updates.push({ ref: doc.ref, data: {
        status: 'failed',
        errorMessage: 'Worker lease expired after two hours',
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } });
    }
  });

  fileOrders.docs.forEach((doc) => {
    const data = doc.data();
    if (!['completed', 'cancelled'].includes(data.status) || data.fileDeletedAt) return;
    const paths = [data.filePath, ...Object.values(data.splitFilePaths || {})].filter((path): path is string => typeof path === 'string');
    paths.forEach((path) => files.add(path));
    retainedPrintFilesDeleted += new Set(paths).size;
    updates.push({ ref: doc.ref, data: { filePath: null, splitFilePaths: null, fileDeletedAt: nowTimestamp, updatedAt: nowTimestamp } });
  });

  const stalePaidPayments = payments.docs.filter((doc) => {
    const data = doc.data();
    const updated = toDate(data.updatedAt)?.getTime() || toDate(data.createdAt)?.getTime() || now;
    return data.status === 'paid' && !data.reconciliationRequired && updated <= now - 15 * 60 * 1000;
  });
  if (stalePaidPayments.length) {
    const orders = await db.getAll(...stalePaidPayments.map((payment) => db.collection('orders').doc(payment.id)));
    orders.forEach((order, index) => {
      if (!order.exists) {
        reconciliationFlags += 1;
        updates.push({ ref: stalePaidPayments[index].ref, data: { reconciliationRequired: true, reconciliationReason: 'paid_without_order', updatedAt: nowTimestamp } });
      }
    });
  }

  await Promise.all([...files].map((path) => getAdminBucket().file(path).delete({ ignoreNotFound: true })));
  for (let index = 0; index < updates.length; index += 450) {
    const batch = db.batch();
    updates.slice(index, index + 450).forEach((update) => batch.update(update.ref, update.data));
    await batch.commit();
  }
  for (let index = 0; index < deletes.length; index += 450) {
    const batch = db.batch();
    deletes.slice(index, index + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return NextResponse.json({ ok: true, updatedRecords: updates.length, deletedStorageObjects: files.size, retainedPrintFilesDeleted, expiredEphemeralRecords: deletes.length, reconciliationFlags });
}
