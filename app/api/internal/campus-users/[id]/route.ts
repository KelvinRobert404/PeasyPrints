import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { bearerToken, safeTokenEqual } from '@/lib/server/secrets';

/** Firestore allows 500 writes per batch. */
const BATCH_SIZE = 450;
const OPEN_GAME = new Set(['open', 'full']);

type Write = { kind: 'delete'; ref: DocumentReference } | { kind: 'update'; ref: DocumentReference; data: Record<string, unknown> };

function authorized(request: NextRequest) {
  return safeTokenEqual(bearerToken(request.headers.get('authorization')), process.env.CAMPUS_ACCOUNT_HOOK_TOKEN);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!id || id.includes('/')) return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
  const db = getAdminDb();
  const c = CAMPUS_COLLECTIONS;
  const [membership, requests, contacts, notifications, saves, lostFound, games] = await Promise.all([
    db.collection('campus_memberships').doc(id).get(),
    db.collection('campus_verification_requests').where('userId', '==', id).get(),
    db.collection('campus_private_contacts').where('authorId', '==', id).get(),
    db.collection(c.notifications).where('userId', '==', id).get(),
    db.collection(c.saves).where('userId', '==', id).get(),
    db.collection(c.lostFound).where('authorId', '==', id).get(),
    db.collection(c.games).where('playerIds', 'array-contains', id).get(),
  ]);
  const paths = new Set<string>();
  const data = membership.data();
  if (data?.studentVerification?.idCardPath) paths.add(data.studentVerification.idCardPath);
  if (data?.girlsSpaceVerification?.idCardPath) paths.add(data.girlsSpaceVerification.idCardPath);
  requests.docs.forEach((doc) => { if (doc.data().idCardPath) paths.add(doc.data().idCardPath); });
  await Promise.all([...paths].map((path) => getAdminBucket().file(path).delete({ ignoreNotFound: true })));

  const writes: Write[] = [
    db.collection('campus_memberships').doc(id),
    db.collection('campus_private_profiles').doc(id),
    db.collection('campus_verification_locks').doc(`${id}_student`),
    db.collection('campus_verification_locks').doc(`${id}_girls_space`),
    db.collection(c.bloodDonors).doc(id),
    db.collection(c.notificationPrefs).doc(id),
    ...[requests, contacts, notifications, saves, lostFound].flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref)),
  ].map((ref): Write => ({ kind: 'delete', ref }));

  // Leaves every game. A game the user hosts and that has not ended is cancelled;
  // a full game the user only joined opens a slot again.
  let gamesCancelled = 0;
  games.docs.forEach((doc) => {
    const game = doc.data();
    const open = OPEN_GAME.has(String(game.status));
    const patch: Record<string, unknown> = { playerIds: FieldValue.arrayRemove(id), updatedAt: new Date() };
    if (open && game.authorId === id) {
      patch.status = 'cancelled';
      gamesCancelled += 1;
    } else if (game.status === 'full') {
      patch.status = 'open';
    }
    writes.push({ kind: 'update', ref: doc.ref, data: patch });
  });

  for (let index = 0; index < writes.length; index += BATCH_SIZE) {
    const batch = db.batch();
    writes.slice(index, index + BATCH_SIZE).forEach((write) => {
      if (write.kind === 'delete') batch.delete(write.ref);
      else batch.update(write.ref, write.data);
    });
    await batch.commit();
  }
  return NextResponse.json({
    ok: true,
    deletedCards: paths.size,
    deletedNotifications: notifications.size,
    deletedSaves: saves.size,
    deletedLostFound: lostFound.size,
    leftGames: games.size,
    gamesCancelled,
  });
}
