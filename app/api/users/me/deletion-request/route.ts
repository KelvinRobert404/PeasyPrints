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
  const rate = await checkRateLimit('account-deletion', userId, 3, 24 * 60 * 60);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Type the confirmation exactly' }, { status: 400 });
  await getAdminDb().collection('account_deletion_requests').doc(userId).set({
    userId,
    status: 'queued',
    requestedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
  return NextResponse.json({ ok: true, message: 'Deletion request queued' }, { headers: { 'Cache-Control': 'no-store' } });
}
