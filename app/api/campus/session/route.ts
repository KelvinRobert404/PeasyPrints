import { NextResponse } from 'next/server';
import { campusSessionFor, getCampusPrincipal, getSignedInUserId } from '@/lib/campus/auth';
import { SIGNED_OUT_SESSION } from '@/lib/campus/membership';
import type { CampusSession } from '@/types/campus';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const userId = await getSignedInUserId();
  if (!userId) return NextResponse.json(SIGNED_OUT_SESSION, { headers: NO_STORE });

  try {
    const principal = await getCampusPrincipal();
    return NextResponse.json(await campusSessionFor(principal), { headers: NO_STORE });
  } catch (error) {
    console.error('[campus] session', error);
    // A failed lookup must not send the student back through onboarding.
    const fallback: CampusSession = { ...SIGNED_OUT_SESSION, signedIn: true };
    return NextResponse.json(fallback, { headers: NO_STORE });
  }
}
