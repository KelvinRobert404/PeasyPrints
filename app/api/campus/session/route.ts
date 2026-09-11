import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getCampusPrincipal } from '@/lib/campus/auth';
import { toDate } from '@/lib/campus/serialize';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({
      signedIn: false,
      membership: null,
      verifiedStudent: false,
      girlsSpaceApproved: false,
      unreadContactRequests: 0,
    });
  }

  try {
    const principal = await getCampusPrincipal();
    const pending = await getAdminDb()
      .collection('campus_contact_requests')
      .where('sellerId', '==', userId)
      .where('status', '==', 'pending')
      .limit(100)
      .get();
    return NextResponse.json({
      signedIn: true,
      membership: principal.membership,
      verifiedStudent: principal.membership?.student.status === 'approved',
      girlsSpaceApproved: principal.membership?.girlsSpace.status === 'approved',
      unreadContactRequests: pending.docs.filter((item) => (toDate(item.data().expiresAt)?.getTime() || 0) > Date.now()).length,
    });
  } catch {
    return NextResponse.json({
      signedIn: true,
      membership: null,
      verifiedStudent: false,
      girlsSpaceApproved: false,
      unreadContactRequests: 0,
    });
  }
}
