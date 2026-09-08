import { NextRequest, NextResponse } from 'next/server';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { bearerToken, safeTokenEqual } from '@/lib/server/secrets';

function authorized(request: NextRequest) {
  return safeTokenEqual(bearerToken(request.headers.get('authorization')), process.env.CAMPUS_ACCOUNT_HOOK_TOKEN);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;
  const db = getAdminDb();
  const [membership, requests] = await Promise.all([
    db.collection('campus_memberships').doc(id).get(),
    db.collection('campus_verification_requests').where('userId', '==', id).get(),
  ]);
  const paths = new Set<string>();
  const data = membership.data();
  if (data?.studentVerification?.idCardPath) paths.add(data.studentVerification.idCardPath);
  if (data?.girlsSpaceVerification?.idCardPath) paths.add(data.girlsSpaceVerification.idCardPath);
  requests.docs.forEach((doc) => { if (doc.data().idCardPath) paths.add(doc.data().idCardPath); });
  await Promise.all([...paths].map((path) => getAdminBucket().file(path).delete({ ignoreNotFound: true })));
  const batch = db.batch();
  batch.delete(db.collection('campus_memberships').doc(id));
  batch.delete(db.collection('campus_private_profiles').doc(id));
  batch.delete(db.collection('campus_verification_locks').doc(`${id}_student`));
  batch.delete(db.collection('campus_verification_locks').doc(`${id}_girls_space`));
  requests.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return NextResponse.json({ ok: true, deletedCards: paths.size });
}
