import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import admin from 'firebase-admin';
import crypto from 'crypto';
import { captureServerEvent } from '@/lib/posthog/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Initialize Admin SDK
    // @ts-ignore
    if (!(admin as any).apps || (admin as any).apps.length === 0) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!projectId || !clientEmail || !privateKey) {
        return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
      }
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    }

    // Require authenticated session
    const { userId } = await clerkAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Basic CSRF protection for same-site requests
    const origin = req.headers.get('origin');
    if (origin) {
      const url = new URL(req.url);
      const expectedOrigin = `${url.protocol}//${url.host}`;
      if (origin !== expectedOrigin) {
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
      }
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification params' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const hmac = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const valid = hmac === razorpay_signature;
    if (!valid) {
      captureServerEvent({
        event: 'razorpay_payment_failed',
        distinctId: userId,
        properties: { razorpay_order_id, razorpay_payment_id, status: 'invalid_signature' }
      });
      return NextResponse.json({ valid: false, error: 'Invalid signature' }, { status: 400 });
    }
    // Bind to internal payment record and atomically mark as paid once
    try {
      const paymentsRef = admin.firestore().collection('payments').doc(razorpay_order_id);
      await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(paymentsRef);
        if (!snap.exists) {
          throw new Error('Order not found');
        }
        const data = snap.data() as any;
        if (data.userId !== userId) {
          throw new Error('Forbidden');
        }
        if (data.status === 'paid') {
          return; // idempotent
        }
        tx.update(paymentsRef, {
          status: 'paid',
          razorpay_payment_id,
          razorpay_signature,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    } catch (err) {
      captureServerEvent({
        event: 'razorpay_payment_failed',
        distinctId: userId,
        properties: { razorpay_order_id, razorpay_payment_id, status: 'rejected' }
      });
      return NextResponse.json({ valid: false, error: 'Verification rejected' }, { status: 400 });
    }
    captureServerEvent({
      event: 'razorpay_payment_succeeded',
      distinctId: userId,
      properties: { razorpay_order_id, razorpay_payment_id, status: 'paid' }
    });
    const res = NextResponse.json({ valid: true });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}


