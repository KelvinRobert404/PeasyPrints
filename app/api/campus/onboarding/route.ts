import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { campusErrorResponse, campusSessionFor, getCampusPrincipal } from '@/lib/campus/auth';
import { CAMPUS_COLLECTIONS } from '@/lib/campus/constants';
import { applyOnboardingInput, parseOnboardingBody } from '@/lib/campus/membership';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

// Saves an onboarding step (college and campus, stay, course), then re-checks the
// college email domains so a matching account is approved right away.
export async function POST(request: NextRequest) {
  try {
    const principal = await getCampusPrincipal();
    const rate = await checkRateLimit('campus-onboarding', principal.userId, 30, 3600);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Send your college and campus' }, { status: 400, headers: NO_STORE });
    }
    const parsed = parseOnboardingBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

    const result = applyOnboardingInput(principal.membership, parsed.input, { blocked: principal.blocked });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });

    const now = Timestamp.now();
    await getAdminDb().collection(CAMPUS_COLLECTIONS.memberships).doc(principal.userId).set({
      ...result.patch,
      displayName: principal.displayName,
      ...(principal.membership ? {} : { createdAt: now }),
      updatedAt: now,
    }, { merge: true });

    // Runs the college email domain check against the saved college.
    const next = await getCampusPrincipal();
    const session = await campusSessionFor(next);
    return NextResponse.json({
      session,
      domainMismatch: next.membership?.student.status !== 'approved',
    }, { headers: NO_STORE });
  } catch (error) {
    return campusErrorResponse(error);
  }
}
