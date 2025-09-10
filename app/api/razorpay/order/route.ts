import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import admin from 'firebase-admin';
import crypto from 'crypto';
import { captureServerEvent } from '@/lib/posthog/server';
import { isAllowedOrigin } from '@/lib/utils/origin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Initialize Admin SDK (safe across HMR)
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

    // Basic CSRF protection for same-site/allowlisted requests
    if (!isAllowedOrigin(req.url, req.headers.get('origin'), req.headers.get('x-forwarded-host'), req.headers.get('x-forwarded-proto'))) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const body = await req.json();
    const { amount, currency = 'INR', receipt } = body as { amount: number; currency?: string; receipt?: string };

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Idempotency support (optional)
    const idempotencyKey = req.headers.get('idempotency-key') || undefined;
    const idHash = idempotencyKey ? crypto.createHash('sha256').update(`${userId}:${idempotencyKey}`).digest('hex') : undefined;
    if (idHash) {
      try {
        const paymentsRef = admin.firestore().collection('payments');
        const existingSnap = await paymentsRef
          .where('userId', '==', userId)
          .where('idempotencyKeyHash', '==', idHash)
          .limit(1)
          .get();
        if (!existingSnap.empty) {
          const doc = existingSnap.docs[0];
          const data = doc.data();
          if (data?.razorpay_order) {
            const res = NextResponse.json({ order: data.razorpay_order });
            res.headers.set('Cache-Control', 'no-store');
            return res;
          }
        }
      } catch {}
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret) {
      const Razorpay = (await import('razorpay')).default;
      const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const order = await instance.orders.create({
        amount: Math.round(amount * 100),
        currency,
        receipt: receipt || `rcpt_${Date.now()}`
      });
      // Persist a payment intent document keyed by Razorpay order id
      try {
        const paymentsRef = admin.firestore().collection('payments');
        const payload = {
          userId,
          amount,
          currency,
          receipt: order.receipt || null,
          status: 'created',
          razorpay_order_id: order.id,
          razorpay_order: order,
          idempotencyKeyHash: idHash || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        } as any;
        await paymentsRef.doc(order.id).set(payload, { merge: true });
      } catch {}
      // Server-side analytics (no PII)
      captureServerEvent({
        event: 'razorpay_order_created',
        distinctId: userId,
        properties: { razorpay_order_id: order.id, amount, currency },
      });
      const res = NextResponse.json({ order });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    // No secrets configured → do not create a mock order (it causes checkout failure). Surface error.
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
