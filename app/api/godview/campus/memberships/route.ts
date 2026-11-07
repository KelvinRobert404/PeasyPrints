import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { getCampus } from '@/lib/campus/catalog';
import { VERIFICATION_DAYS, addDays } from '@/lib/campus/constants';
import { courseLabel, getProgramme } from '@/lib/campus/courses';
import { toIso } from '@/lib/campus/serialize';

/** 'BBA Finance, sem 3' from a stored { programmeId, specialisation, semester }. */
function courseText(course: unknown): string | null {
  if (!course || typeof course !== 'object') return null;
  const value = course as { programmeId?: unknown; specialisation?: unknown; semester?: unknown };
  const programme = getProgramme(typeof value.programmeId === 'string' ? value.programmeId : null);
  if (!programme || typeof value.semester !== 'number' || !Number.isInteger(value.semester)) return null;
  const specialisation = typeof value.specialisation === 'string' && value.specialisation ? value.specialisation : null;
  return courseLabel({ programmeName: programme.name, semester: value.semester, specialisation });
}

function campusLabelOf(data: { campusId?: unknown; campusLabel?: unknown }): string | null {
  if (typeof data.campusLabel === 'string' && data.campusLabel) return data.campusLabel;
  return typeof data.campusId === 'string' ? getCampus(data.campusId)?.label ?? null : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminPrincipal();
    // Filtered in memory so no new composite index is needed.
    const collegeId = request.nextUrl.searchParams.get('collegeId') || null;
    const snapshot = await getAdminDb().collection('campus_memberships').limit(300).get();
    const items = snapshot.docs
      .filter((doc) => !collegeId || doc.data().collegeId === collegeId)
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || 'Student',
          collegeId: data.collegeId || null,
          collegeCode: data.collegeCode || null,
          campusId: typeof data.campusId === 'string' ? data.campusId : null,
          campusLabel: campusLabelOf(data),
          method: data.studentVerification?.method || null,
          course: courseText(data.course),
          studentStatus: data.studentVerification?.status || 'unverified',
          studentExpiresAt: data.studentVerification?.expiresAt ? toIso(data.studentVerification.expiresAt) : null,
          girlsStatus: data.girlsSpaceVerification?.status || 'unverified',
          girlsExpiresAt: data.girlsSpaceVerification?.expiresAt ? toIso(data.girlsSpaceVerification.expiresAt) : null,
        };
      });
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
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
