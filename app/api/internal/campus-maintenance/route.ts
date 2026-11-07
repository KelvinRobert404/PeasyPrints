import { NextRequest, NextResponse } from 'next/server';
import { DocumentReference, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { contactOpen, planMaintenance, type MaintenanceDoc } from '@/lib/campus/maintenance';
import { enqueue } from '@/lib/campus/notify';
import { toDate } from '@/lib/campus/serialize';
import { bearerToken, safeTokenEqual } from '@/lib/server/secrets';

/** Delivered inbox items older than this are loaded for deletion, at most NOTIFICATION_SCAN per run. */
const NOTIFICATION_KEEP_DAYS = 30;
const NOTIFICATION_SCAN = 500;

function authorized(request: NextRequest) {
  const token = bearerToken(request.headers.get('authorization'));
  return safeTokenEqual(token, process.env.CRON_SECRET) || safeTokenEqual(token, process.env.CAMPUS_MAINTENANCE_TOKEN);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getAdminDb();
  const now = Date.now();
  const nowTimestamp = Timestamp.now();
  const c = CAMPUS_COLLECTIONS;
  const notificationCutoff = Timestamp.fromMillis(now - NOTIFICATION_KEEP_DAYS * 24 * 60 * 60 * 1000);
  const [memberships, marketplace, housing, contacts, runningRenders, rateLimits, printTickets, fileOrders, payments, games, lostFound, bloodRequests, notifications] = await Promise.all([
    db.collection('campus_memberships').get(),
    db.collection(c.market).get(),
    db.collection(c.housing).get(),
    db.collection('campus_contact_requests').get(),
    db.collection('campus_render_packs').where('status', '==', 'running').get(),
    db.collection('_rate_limits').where('expiresAt', '<=', nowTimestamp).limit(500).get(),
    db.collection('print_tickets').where('expiresAt', '<=', nowTimestamp).limit(500).get(),
    db.collection('orders').where('fileDeleteAfter', '<=', nowTimestamp).limit(200).get(),
    db.collection('payments').where('status', '==', 'paid').limit(500).get(),
    db.collection(c.games).where('status', 'in', ['open', 'full']).get(),
    db.collection(c.lostFound).where('status', '==', 'open').get(),
    db.collection(c.bloodRequests).where('status', '==', 'open').get(),
    db.collection(c.notifications).where('deliverAfter', '<=', notificationCutoff).limit(NOTIFICATION_SCAN).get(),
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

  // Listing and utility lifecycles: the pure planner decides, this route writes.
  const toDocs = (snapshot: { docs: Array<{ id: string; data(): Record<string, unknown> }> }): MaintenanceDoc[] =>
    snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const plan = planMaintenance({
    market: toDocs(marketplace),
    housing: toDocs(housing),
    games: toDocs(games),
    lostFound: toDocs(lostFound),
    bloodRequests: toDocs(bloodRequests),
    notifications: toDocs(notifications),
  }, now);
  const planned = new Map(plan.updates.map((update) => [`${update.collection}/${update.id}`, update.data]));
  plan.updates.forEach((update) => updates.push({ ref: db.collection(c[update.collection]).doc(update.id), data: update.data }));
  plan.deletes.forEach((item) => deletes.push(db.collection(c[item.collection]).doc(item.id)));

  // Contact requests follow each listing's status after this run's changes.
  for (const [type, collection, snapshot] of [['marketplace', 'market', marketplace], ['housing', 'housing', housing]] as const) snapshot.docs.forEach((doc) => {
    const data = { ...doc.data(), ...planned.get(`${collection}/${doc.id}`) };
    if (contactOpen(collection, data, now)) availableContent.add(`${type}_${doc.id}`);
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
    // Already-processed orders still matching the query are dequeued; otherwise 200
    // of them would fill every slot and newer orders' files would never be deleted.
    if (data.fileDeletedAt) {
      updates.push({ ref: doc.ref, data: { fileDeleteAfter: FieldValue.delete() } });
      return;
    }
    if (!['completed', 'cancelled'].includes(data.status)) return;
    const paths = [data.filePath, ...Object.values(data.splitFilePaths || {})].filter((path): path is string => typeof path === 'string');
    paths.forEach((path) => files.add(path));
    retainedPrintFilesDeleted += new Set(paths).size;
    updates.push({ ref: doc.ref, data: { filePath: null, splitFilePaths: null, fileDeletedAt: nowTimestamp, fileDeleteAfter: FieldValue.delete(), updatedAt: nowTimestamp } });
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

  // Inbox items go out after the writes: a failed send loses one notice, a failed write never repeats one.
  let notificationsQueued = 0;
  let notificationsFailed = 0;
  for (const item of plan.notifications) {
    try {
      const result = await enqueue([item.userId], {
        kind: item.kind,
        title: item.title,
        body: item.body,
        href: item.href,
        ref: item.ref,
        campusId: item.campusId,
      }, { now: new Date(now), db });
      notificationsQueued += result.queued;
    } catch (error) {
      notificationsFailed += 1;
      console.error('campus-maintenance: enqueue failed', item.kind, error);
    }
  }

  return NextResponse.json({
    ok: true,
    updatedRecords: updates.length,
    deletedStorageObjects: files.size,
    retainedPrintFilesDeleted,
    expiredEphemeralRecords: deletes.length,
    reconciliationFlags,
    lifecycle: plan.counts,
    notificationsQueued,
    notificationsFailed,
  });
}
