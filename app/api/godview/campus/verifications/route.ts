import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';
import { getCampus } from '@/lib/campus/catalog';
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
    const status = request.nextUrl.searchParams.get('status') || 'pending';
    // Filtered in memory so no new composite index is needed.
    const collegeId = request.nextUrl.searchParams.get('collegeId') || null;
    const snapshot = await getAdminDb().collection('campus_verification_requests').where('status', '==', status).limit(200).get();
    const items = snapshot.docs
      .filter((doc) => !collegeId || doc.data().collegeId === collegeId)
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          kind: data.kind,
          status: data.status,
          collegeId: data.collegeId || null,
          collegeCode: data.collegeCode || null,
          campusId: typeof data.campusId === 'string' ? data.campusId : null,
          campusLabel: campusLabelOf(data),
          method: data.method || 'id_card',
          course: courseText(data.course),
          displayName: data.displayName,
          email: data.email || null,
          createdAt: toIso(data.createdAt),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
