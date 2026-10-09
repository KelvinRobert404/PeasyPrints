import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { captureServerEvent } from '@/lib/posthog/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });

    const payloadText = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';
    const expected = crypto.createHmac('sha256', webhookSecret).update(payloadText).digest('hex');
    const supplied = Buffer.from(signature, 'hex');
    const wanted = Buffer.from(expected, 'hex');
    if (supplied.length !== wanted.length || !crypto.timingSafeEqual(supplied, wanted)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(payloadText);
    const db = getAdminDb();
    // Razorpay sends a stable event id header and resends the same id on retries.
    const eventId = request.headers.get('x-razorpay-event-id') || crypto.createHash('sha256').update(payloadText).digest('hex');
    const eventRef = db.collection('razorpay_webhook_events').doc(eventId);
    try {
      await eventRef.create({ eventType: event?.event || null, receivedAt: new Date(), status: 'received' });
    } catch (error) {
      if (String((error as { code?: unknown }).code) === '6' || String((error as Error).message).toLowerCase().includes('already exists')) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw error;
    }

    try {
      const type = String(event?.event || '');
      const payment = event?.payload?.payment?.entity;
      if ((type === 'payment.captured' || type === 'payment.failed') && payment?.order_id) {
        const paymentRef = db.collection('payments').doc(String(payment.order_id));
        await db.runTransaction(async (transaction) => {
          const intent = await transaction.get(paymentRef);
          if (!intent.exists) return;
          const data = intent.data()!;
          const matches = Number(payment.amount) === Number(data.amountPaise) && payment.currency === data.currency;
          if (!matches) {
            transaction.update(paymentRef, { reconciliationStatus: 'amount_mismatch', updatedAt: new Date() });
            return;
          }
          if (type === 'payment.captured') {
            if (data.razorpayPaymentId && data.razorpayPaymentId !== payment.id) return;
            // Webhooks often arrive after the client already verified and finalized the
            // order; never move a 'fulfilled' intent back to 'paid'.
            const alreadySettled = data.status === 'paid' || data.status === 'fulfilled';
            transaction.update(paymentRef, {
              ...(alreadySettled ? {} : { status: 'paid' }),
              razorpayPaymentId: payment.id,
              webhookVerifiedAt: new Date(),
              updatedAt: new Date(),
            });
          } else if (data.status !== 'paid' && data.status !== 'fulfilled') {
            // Don't bind razorpayPaymentId: Checkout lets the customer retry on the same
            // order, and the successful retry must still be able to bind.
            transaction.update(paymentRef, {
              status: 'failed',
              ...(payment.id ? { failedPaymentIds: FieldValue.arrayUnion(String(payment.id)) } : {}),
              webhookFailedAt: new Date(),
              updatedAt: new Date(),
            });
          }
        });
      }
    } catch (error) {
      // Release the dedupe marker so Razorpay's retry of this event is processed
      // instead of being acknowledged as a duplicate.
      await eventRef.delete().catch(() => undefined);
      throw error;
    }

    await eventRef.set({ processedAt: new Date(), status: 'processed' }, { merge: true });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    captureServerEvent({ event: 'error', properties: { source: 'razorpay_webhook', error: String((error as Error)?.message || error) } });
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 500 });
  }
}
