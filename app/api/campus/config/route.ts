import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getCampusPrincipal, campusErrorResponse } from '@/lib/campus/auth';
import { DEFAULT_PICKUP_POINTS, PILOT_COLLEGE } from '@/lib/campus/constants';

export async function GET() {
  try {
    await getCampusPrincipal({ requireVerified: true });
    const snapshot = await getAdminDb().collection('college_configs').doc(PILOT_COLLEGE.id).get();
    const data = snapshot.data() || {};
    return NextResponse.json({
      college: PILOT_COLLEGE,
      pickupPoints: Array.isArray(data.pickupPoints) && data.pickupPoints.length ? data.pickupPoints : DEFAULT_PICKUP_POINTS,
      marketplaceEnabled: data.marketplaceEnabled !== false,
      housingEnabled: data.housingEnabled !== false,
    });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

