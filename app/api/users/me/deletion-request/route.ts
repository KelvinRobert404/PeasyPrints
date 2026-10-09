import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import { isAllowedOrigin } from '@/lib/utils/origin';

const schema = z.object({ confirmation: z.literal('DELETE MY ACCOUNT') });

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  // Validate before spending the rate limit so a typo doesn't lock the user out for a day.
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Type the confirmation exactly' }, { status: 400 });
  const rate = await checkRateLimit('account-deletion', userId, 3, 24 * 60 * 60);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  const ref = getAdminDb().collection('account_deletion_requests').doc(userId);
  const existing = await ref.get();
  // Don't reset a request that is already being processed or done back to 'queued'.
  if (existing.exists && ['processing', 'completed'].includes(existing.data()?.status)) {
    return NextResponse.json({ ok: true, message: 'Deletion request already in progress' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  await ref.set({
    userId,
    status: 'queued',
    requestedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
  return NextResponse.json({ ok: true, message: 'Deletion request queued' }, { headers: { 'Cache-Control': 'no-store' } });
}
