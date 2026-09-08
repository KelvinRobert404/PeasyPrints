import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { isAllowedOrigin } from '@/lib/utils/origin';

const schema = z.object({ amount: z.number().int().min(1).max(1_000_000) });

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payout amount' }, { status: 400 });
  const db = getAdminDb();
  const requestRef = db.collection('payout_requests').doc();
  try {
    await db.runTransaction(async (transaction) => {
      const shopRef = db.collection('shops').doc(userId);
      const shop = await transaction.get(shopRef);
      if (!shop.exists) throw new Error('Shop not found');
      const balance = Number(shop.data()!.receivableAmount || 0);
      const reserved = Number(shop.data()!.reservedPayoutAmount || 0);
      if (parsed.data.amount > balance - reserved) throw new Error('Payout exceeds available balance');
      const now = Timestamp.now();
      transaction.create(requestRef, { shopId: userId, amount: parsed.data.amount, status: 'requested', requestedAt: now, updatedAt: now });
      transaction.update(shopRef, { reservedPayoutAmount: FieldValue.increment(parsed.data.amount), updatedAt: now });
    });
    return NextResponse.json({ id: requestRef.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error)?.message || error) }, { status: 409 });
  }
}
