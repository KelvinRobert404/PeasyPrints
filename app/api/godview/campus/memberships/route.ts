import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { VERIFICATION_DAYS, addDays } from '@/lib/campus/constants';
import { toIso } from '@/lib/campus/serialize';

export async function GET() {
  try {
    await requireAdminPrincipal();
    const snapshot = await getAdminDb().collection('campus_memberships').limit(300).get();
    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        displayName: data.displayName || 'Student',
        collegeCode: data.collegeCode || 'KJU',
        studentStatus: data.studentVerification?.status || 'unverified',
        studentExpiresAt: toIso(data.studentVerification?.expiresAt),
        girlsStatus: data.girlsSpaceVerification?.status || 'unverified',
        girlsExpiresAt: toIso(data.girlsSpaceVerification?.expiresAt),
      };
    });
    return NextResponse.json({ items });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminPrincipal();
    const body = await request.json();
    const id = String(body.id || '');
    const action = String(body.action || '');
    const kind = body.kind === 'girls_space' ? 'girls_space' : 'student';
    if (!id || !['renew', 'revoke'].includes(action)) return NextResponse.json({ error: 'Invalid membership action' }, { status: 400 });
    const ref = getAdminDb().collection('campus_memberships').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new CampusHttpError(404, 'Membership not found');
    const field = kind === 'student' ? 'studentVerification' : 'girlsSpaceVerification';
    const state = snapshot.data()?.[field] || {};
    if (action === 'renew') {
      if (state.status !== 'approved') throw new CampusHttpError(409, 'Only active verification can be renewed');
      await ref.set({
        [field]: { ...state, expiresAt: Timestamp.fromDate(addDays(new Date(), VERIFICATION_DAYS)), renewedAt: Timestamp.now(), renewedBy: admin.email },
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } else {
      const updates: Record<string, unknown> = {
        [field]: { ...state, status: 'revoked', idCardPath: null, revokedAt: Timestamp.now(), revokedBy: admin.email },
        updatedAt: Timestamp.now(),
      };
      const paths = [state.idCardPath].filter(Boolean);
      if (kind === 'student') {
        const girls = snapshot.data()?.girlsSpaceVerification || {};
        if (girls.idCardPath) paths.push(girls.idCardPath);
        updates.girlsSpaceVerification = { ...girls, status: 'revoked', idCardPath: null, revokedAt: Timestamp.now(), revokedBy: admin.email };
      }
      await ref.set(updates, { merge: true });
      await Promise.all(paths.map((path) => getAdminBucket().file(String(path)).delete({ ignoreNotFound: true })));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
