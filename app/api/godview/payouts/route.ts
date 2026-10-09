import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { CampusHttpError, campusErrorResponse, requireAdminPrincipal } from '@/lib/campus/auth';

const schema = z.object({ id: z.string().min(1).max(128), action: z.enum(['processing', 'paid', 'cancelled']), reference: z.string().trim().max(200).optional() });

export async function GET() {
  try {
    await requireAdminPrincipal();
    const snapshot = await getAdminDb().collection('payout_requests').orderBy('requestedAt', 'desc').limit(200).get();
    return NextResponse.json({ items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), requestedAt: doc.data().requestedAt?.toDate?.()?.toISOString() || null })) });
  } catch (error) {
    return campusErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminPrincipal();
    const body = schema.parse(await request.json());
    const db = getAdminDb();
    await db.runTransaction(async (transaction) => {
      const requestRef = db.collection('payout_requests').doc(body.id);
      const payoutRequest = await transaction.get(requestRef);
      if (!payoutRequest.exists) throw new CampusHttpError(404, 'Payout request not found');
      const data = payoutRequest.data()!;
      if (['paid', 'cancelled'].includes(data.status)) {
        if (data.status === body.action) return;
        throw new CampusHttpError(409, 'Payout request is already closed');
      }
      const shopRef = db.collection('shops').doc(data.shopId);
      const shop = await transaction.get(shopRef);
      if (!shop.exists) throw new CampusHttpError(404, 'Shop not found');
      const amount = Number(data.amount);
      const shopData = shop.data()!;
      if (!Number.isFinite(amount) || amount <= 0 || Number(shopData.reservedPayoutAmount || 0) < amount) {
        throw new CampusHttpError(409, 'Reserved payout balance is inconsistent');
      }
      if (body.action === 'paid' && Number(shopData.receivableAmount || 0) < amount) {
        throw new CampusHttpError(409, 'Receivable balance is insufficient');
      }
      const now = Timestamp.now();
      if (body.action === 'processing') {
        transaction.update(requestRef, { status: 'processing', processedBy: admin.email, updatedAt: now });
        return;
      }
      transaction.update(shopRef, {
        reservedPayoutAmount: FieldValue.increment(-amount),
        ...(body.action === 'paid' ? { receivableAmount: FieldValue.increment(-amount) } : {}),
        updatedAt: now,
      });
      transaction.update(requestRef, { status: body.action, reference: body.reference || null, decidedBy: admin.email, updatedAt: now });
      if (body.action === 'paid') transaction.set(db.collection('payouts').doc(body.id), { requestId: body.id, shopId: data.shopId, amount: data.amount, reference: body.reference || null, createdAt: now, createdBy: admin.email });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid payout action' }, { status: 400 });
    return campusErrorResponse(error);
  }
}
