import { NextResponse, type NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, campusSessionFor, getCampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS, VERIFICATION_DAYS, addDays } from '@/lib/campus/constants';
import { isDemoMode } from '@/lib/demo/mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Demo only: plays the reviewer and approves the caller's own pending ID card.
// Student first, then the Girls' space card. 404 outside the demo.

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const FIELDS = [
  { field: 'studentVerification', kind: 'student' },
  { field: 'girlsSpaceVerification', kind: 'girls_space' },
] as const;

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function POST(_request: NextRequest) {
  if (!isDemoMode()) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  try {
    const principal = await getCampusPrincipal();
    const db = getAdminDb();
    const membershipRef = db.collection(CAMPUS_COLLECTIONS.memberships).doc(principal.userId);
    const snapshot = await membershipRef.get();
    const data = (snapshot.exists ? snapshot.data() : null) ?? {};

    const now = new Date();
    const approved: string[] = [];
    let studentActive = principal.membership?.student.status === 'approved';
    for (const { field, kind } of FIELDS) {
      const current = recordOf(data[field]);
      if (current?.status !== 'pending') continue;
      // Girls' space needs an active student approval, as in the real review.
      if (kind === 'girls_space' && !studentActive) continue;
      const requestId = typeof current.requestId === 'string' && current.requestId ? current.requestId : null;
      let idCardPath: string | null = typeof current.idCardPath === 'string' ? current.idCardPath : null;
      if (requestId) {
        const requestRef = db.collection('campus_verification_requests').doc(requestId);
        const request = await requestRef.get();
        if (request.exists && request.data()?.status === 'pending') {
          idCardPath = typeof request.data()?.idCardPath === 'string' ? request.data()?.idCardPath : idCardPath;
          await requestRef.set(
            { status: 'approved', decidedAt: Timestamp.fromDate(now), decidedBy: 'demo', updatedAt: Timestamp.fromDate(now) },
            { merge: true },
          );
        }
      }
      await membershipRef.set(
        {
          [field]: {
            status: 'approved',
            method: 'id_card',
            requestId,
            idCardPath,
            approvedAt: Timestamp.fromDate(now),
            expiresAt: Timestamp.fromDate(addDays(now, VERIFICATION_DAYS)),
            approvedBy: 'demo',
          },
          updatedAt: Timestamp.fromDate(now),
        },
        { merge: true },
      );
      await db.collection('campus_verification_locks').doc(`${principal.userId}_${kind}`).delete();
      approved.push(kind);
      if (kind === 'student') studentActive = true;
    }

    if (!approved.length) throw new CampusHttpError(409, 'No ID card is waiting for review');
    const session = await campusSessionFor(await getCampusPrincipal());
    return NextResponse.json({ approved, session }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
