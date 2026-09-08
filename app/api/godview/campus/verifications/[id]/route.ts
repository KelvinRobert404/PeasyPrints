import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { VERIFICATION_DAYS, addDays } from '@/lib/campus/constants';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminPrincipal();
    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action || '');
    if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    const db = getAdminDb();
    const ref = db.collection('campus_verification_requests').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Verification request not found');
    const data = snapshot.data()!;
    if (data.status !== 'pending') throw new CampusHttpError(409, 'Verification has already been decided');
    const membershipRef = db.collection('campus_memberships').doc(data.userId);
    const lockRef = db.collection('campus_verification_locks').doc(`${data.userId}_${data.kind}`);
    const now = new Date();
    if (action === 'approve') {
      if (data.kind === 'girls_space') {
        const membership = await membershipRef.get();
        const expires = membership.data()?.studentVerification?.expiresAt?.toDate?.();
        if (membership.data()?.studentVerification?.status !== 'approved' || !expires || expires.getTime() <= Date.now()) {
          throw new CampusHttpError(409, 'Student verification must be active first');
        }
      }
      const field = data.kind === 'student' ? 'studentVerification' : 'girlsSpaceVerification';
      await db.runTransaction(async (transaction) => {
        transaction.set(membershipRef, {
          collegeId: data.collegeId,
          collegeCode: data.collegeCode,
          collegeName: data.collegeName,
          displayName: data.displayName,
          [field]: {
            status: 'approved',
            method: 'id_card',
            requestId: id,
            idCardPath: data.idCardPath,
            approvedAt: Timestamp.fromDate(now),
            expiresAt: Timestamp.fromDate(addDays(now, VERIFICATION_DAYS)),
            approvedBy: admin.email,
          },
          updatedAt: Timestamp.fromDate(now),
        }, { merge: true });
        transaction.update(ref, { status: 'approved', decidedAt: Timestamp.fromDate(now), decidedBy: admin.email, updatedAt: Timestamp.fromDate(now) });
        transaction.delete(lockRef);
      });
    } else {
      const field = data.kind === 'student' ? 'studentVerification' : 'girlsSpaceVerification';
      await db.runTransaction(async (transaction) => {
        transaction.set(membershipRef, { [field]: { status: 'rejected', method: 'id_card', requestId: id }, updatedAt: Timestamp.fromDate(now) }, { merge: true });
        transaction.update(ref, { status: 'rejected', rejectionReason: String(body.reason || 'Verification could not be confirmed').slice(0, 300), decidedAt: Timestamp.fromDate(now), decidedBy: admin.email, idCardPath: null, updatedAt: Timestamp.fromDate(now) });
        transaction.delete(lockRef);
      });
      if (data.idCardPath) await getAdminBucket().file(data.idCardPath).delete({ ignoreNotFound: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
