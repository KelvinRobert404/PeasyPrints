import { NextResponse } from 'next/server';
import { CampusHttpError, campusErrorResponse, getCampusPrincipal } from '@/lib/campus/auth';
import { PICK_COLLEGE_FIRST_MESSAGE, campusConfigPayload } from '@/lib/campus/membership';

export const dynamic = 'force-dynamic';

// The member's campus: origin, landmarks, pickup points and product flags.
export async function GET() {
  try {
    const principal = await getCampusPrincipal({ requireVerified: true });
    const payload = principal.config ? campusConfigPayload(principal.config, principal.membership?.campusId) : null;
    if (!payload) throw new CampusHttpError(409, PICK_COLLEGE_FIRST_MESSAGE);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
