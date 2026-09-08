import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const order = await getAdminDb().collection('orders').doc(id).get();
  if (!order.exists) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  const data = order.data()!;
  if (data.shopId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (data.paymentStatus !== 'paid' || ['cancelled', 'completed'].includes(data.status)) return NextResponse.json({ error: 'This order cannot be printed' }, { status: 409 });

  const ticket = crypto.randomBytes(32).toString('base64url');
  const ticketId = crypto.createHash('sha256').update(ticket).digest('hex');
  await getAdminDb().collection('print_tickets').doc(ticketId).create({
    jobId: id,
    shopId: userId,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 1000),
    usedAt: null,
  });
  return NextResponse.json({ ticket, expiresInSeconds: 120 }, { headers: { 'Cache-Control': 'no-store' } });
}
