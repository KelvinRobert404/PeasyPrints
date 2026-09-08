import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { isAllowedOrigin } from '@/lib/utils/origin';
import { canApplyOrderAction, isOrderActionAlreadyApplied, ORDER_ACTIONS } from '@/lib/orders/lifecycle';

const schema = z.object({ action: z.enum(ORDER_ACTIONS) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  const { id } = await context.params;
  const action = parsed.data.action;
  const db = getAdminDb();

  try {
    await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('orders').doc(id);
      const historyRef = db.collection('history').doc(id);
      const order = await transaction.get(orderRef);
      if (!order.exists) throw new Error('Order not found');
      const data = order.data()!;
      if (data.shopId !== userId) throw new Error('Forbidden');
      if (!canApplyOrderAction(data.status, action)) {
        if (isOrderActionAlreadyApplied(data.status, action)) return;
        throw new Error(`Cannot ${action} an order in ${data.status} state`);
      }

      const now = Timestamp.now();
      const fileDeleteAfter = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000);
      if (action === 'complete') {
        transaction.set(historyRef, { ...data, orderId: id, status: 'completed', historyTimestamp: now, updatedAt: now });
        transaction.update(orderRef, { status: 'completed', completedAt: now, fileDeleteAfter, updatedAt: now });
        transaction.update(db.collection('shops').doc(userId), { receivableAmount: FieldValue.increment(Number(data.totalCost)), updatedAt: now });
      } else if (action === 'cancel') {
        transaction.set(historyRef, { ...data, orderId: id, status: 'cancelled', historyTimestamp: now, updatedAt: now });
        transaction.update(orderRef, { status: 'cancelled', cancelledAt: now, fileDeleteAfter, updatedAt: now });
      } else if (action === 'undo_complete') {
        transaction.delete(historyRef);
        transaction.update(orderRef, { status: 'printed', completedAt: null, fileDeleteAfter: null, updatedAt: now });
        transaction.update(db.collection('shops').doc(userId), { receivableAmount: FieldValue.increment(-Number(data.totalCost)), updatedAt: now });
      } else if (action === 'undo_cancel') {
        transaction.delete(historyRef);
        transaction.update(orderRef, { status: 'processing', cancelledAt: null, fileDeleteAfter: null, updatedAt: now });
      } else {
        transaction.update(orderRef, { status: action, updatedAt: now });
      }
    });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    const status = message === 'Forbidden' ? 403 : message === 'Order not found' ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
