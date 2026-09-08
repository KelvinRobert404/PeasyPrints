import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { captureServerEvent } from '@/lib/posthog/server';
import { isAllowedOrigin } from '@/lib/utils/origin';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  razorpay_order_id: z.string().min(1).max(128),
  razorpay_payment_id: z.string().min(1).max(128),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rate = await checkRateLimit('payment-verify', userId, 20, 300);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment verification payload' }, { status: 400 });
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error('Razorpay is not configured');

    const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      captureServerEvent({ event: 'razorpay_payment_failed', distinctId: userId, properties: { razorpay_order_id: orderId, reason: 'invalid_signature' } });
      return NextResponse.json({ valid: false, error: 'Invalid signature' }, { status: 400 });
    }

    const db = getAdminDb();
    const paymentRef = db.collection('payments').doc(orderId);
    const intent = await paymentRef.get();
    if (!intent.exists || intent.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 });
    }

    const Razorpay = (await import('razorpay')).default;
    const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const providerPayment = await instance.payments.fetch(paymentId);
    const expectedAmount = Number(intent.data()!.amountPaise);
    if (providerPayment.order_id !== orderId || Number(providerPayment.amount) !== expectedAmount || providerPayment.currency !== intent.data()!.currency || providerPayment.status !== 'captured') {
      captureServerEvent({ event: 'razorpay_payment_failed', distinctId: userId, properties: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, reason: 'provider_mismatch', provider_status: providerPayment.status } });
      return NextResponse.json({ valid: false, error: 'Payment has not been captured for the quoted amount' }, { status: 409 });
    }

    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(paymentRef);
      if (!fresh.exists || fresh.data()!.userId !== userId) throw new Error('Payment intent ownership changed');
      if (fresh.data()!.razorpayPaymentId && fresh.data()!.razorpayPaymentId !== paymentId) throw new Error('Payment intent already bound');
      transaction.update(paymentRef, {
        status: 'paid',
        razorpayPaymentId: paymentId,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      });
    });

    captureServerEvent({ event: 'razorpay_payment_succeeded', distinctId: userId, properties: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, status: 'paid' } });
    return NextResponse.json({ valid: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    captureServerEvent({ event: 'error', distinctId: userId, properties: { source: 'payment_verify', error: String((error as Error)?.message || error) } });
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
