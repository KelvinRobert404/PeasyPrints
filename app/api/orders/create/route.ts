import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { FinalizeOrderSchema, type CheckoutFiles } from '@/lib/checkout/schema';
import { getAdminDb } from '@/lib/firebase/admin';
import { assertUploadExists, protectedOrderFileUrl } from '@/lib/server/uploads';
import { captureServerEvent } from '@/lib/posthog/server';
import { isAllowedOrigin } from '@/lib/utils/origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  try {
    const parsed = FinalizeOrderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid order finalization payload' }, { status: 400 });
    const input = parsed.data;

    const db = getAdminDb();
    const paymentRef = db.collection('payments').doc(input.razorpayOrderId);
    const orderRef = db.collection('orders').doc(input.razorpayOrderId);

    // The files were verified and bound to this payment when it was quoted.
    const intentSnapshot = await paymentRef.get();
    if (!intentSnapshot.exists) throw new Error('Payment intent not found');
    const intentData = intentSnapshot.data()!;
    if (intentData.userId !== userId) throw new Error('Payment intent does not belong to this user');
    if (intentData.status === 'fulfilled' && intentData.orderId) {
      return NextResponse.json({ id: intentData.orderId, existing: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const files = intentData.quoteInput?.files as CheckoutFiles | undefined;
    if (!files?.filePath) throw new Error('Uploaded file not found for this payment');
    const paths = [files.filePath];
    if (files.splitFiles) paths.push(files.splitFiles.bwPath, files.splitFiles.colorPath, ...(files.splitFiles.originalPath ? [files.splitFiles.originalPath] : []));
    await Promise.all([...new Set(paths)].map((path) => assertUploadExists(path, userId)));

    const result = await db.runTransaction(async (transaction) => {
      const [payment, existingOrder] = await Promise.all([transaction.get(paymentRef), transaction.get(orderRef)]);
      if (!payment.exists) throw new Error('Payment intent not found');
      const intent = payment.data()!;
      if (intent.userId !== userId) throw new Error('Payment intent does not belong to this user');
      if (intent.status === 'fulfilled' && intent.orderId) return { id: intent.orderId, existing: true };
      if (intent.status !== 'paid' || intent.razorpayPaymentId !== input.razorpayPaymentId) throw new Error('A captured payment is required');
      if (existingOrder.exists) throw new Error('Order identifier already exists');

      const quoteInput = intent.quoteInput;
      const order = {
        userId,
        shopId: intent.shopId,
        shopName: intent.shopName || '',
        userName: input.userName || '',
        fileName: files.fileName,
        filePath: files.filePath,
        fileUrl: protectedOrderFileUrl(orderRef.id),
        totalPages: quoteInput.totalPages,
        totalCost: intent.quote.amount,
        currency: intent.currency,
        paymentOrderId: input.razorpayOrderId,
        paymentId: input.razorpayPaymentId,
        paymentStatus: 'paid',
        status: 'processing',
        timestamp: new Date(),
        updatedAt: new Date(),
        emergency: Boolean(quoteInput.printSettings.emergency),
        afterDark: Boolean(quoteInput.printSettings.afterDark),
        printSettings: quoteInput.printSettings,
        pricingDetails: intent.quote.pricingDetails,
        jobType: quoteInput.jobType,
        assignment: quoteInput.assignment || null,
        ...(files.splitFiles ? {
          splitFilePaths: files.splitFiles,
          splitFiles: {
            bwUrl: protectedOrderFileUrl(orderRef.id, 'bw'),
            colorUrl: protectedOrderFileUrl(orderRef.id, 'color'),
          },
        } : {}),
      };
      transaction.create(orderRef, order);
      transaction.update(paymentRef, { status: 'fulfilled', orderId: orderRef.id, fulfilledAt: new Date(), updatedAt: new Date() });
      return { id: orderRef.id, existing: false };
    });

    captureServerEvent({ event: 'order_created', distinctId: userId, properties: { orderId: result.id, razorpay_order_id: input.razorpayOrderId } });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    captureServerEvent({ event: 'order_creation_failed', distinctId: userId, properties: { stage: 'finalize', error: message } });
    const status = /required|not found|does not belong|already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? message : 'Failed to finalize order' }, { status });
  }
}
