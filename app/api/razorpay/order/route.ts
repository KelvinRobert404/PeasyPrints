import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { CheckoutQuoteSchema, normalizeQuoteInput, type CheckoutQuoteInput } from '@/lib/checkout/schema';
import { createServerQuote, QuoteError } from '@/lib/checkout/pricing';
import { normalizeShopPricing } from '@/lib/utils/pricing';
import { getAdminDb } from '@/lib/firebase/admin';
import { getVerifiedUploadPageCount } from '@/lib/server/uploads';
import { captureServerEvent } from '@/lib/posthog/server';
import { isAllowedOrigin } from '@/lib/utils/origin';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

class CheckoutInputError extends Error {}

// Price the files that were actually uploaded, using page counts the upload
// route recorded server-side, so a client cannot pay for fewer pages than it sends.
async function verifyCheckoutFiles(input: CheckoutQuoteInput, userId: string) {
  const { files } = input;
  try {
    const documentPages = await getVerifiedUploadPageCount(files.splitFiles?.originalPath || files.filePath, userId);
    if (documentPages !== input.totalPages) {
      throw new CheckoutInputError('The page count does not match the uploaded file. Please reselect your file.');
    }
    if (files.splitFiles) {
      const [bwPages, colorPages] = await Promise.all([
        getVerifiedUploadPageCount(files.splitFiles.bwPath, userId),
        getVerifiedUploadPageCount(files.splitFiles.colorPath, userId),
      ]);
      if (colorPages !== (input.assignment?.colorPages.length ?? 0) || bwPages + colorPages !== input.totalPages) {
        throw new CheckoutInputError('The colour page split does not match your selection. Please try again.');
      }
    }
  } catch (error) {
    if (error instanceof CheckoutInputError) throw error;
    throw new CheckoutInputError('Your uploaded file could not be verified. Please upload it again.');
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rate = await checkRateLimit('payment-intent', userId, 10, 300);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
    return NextResponse.json({ error: 'A valid idempotency key is required' }, { status: 400 });
  }

  try {
    const parsed = CheckoutQuoteSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid checkout configuration' }, { status: 400 });
    const input = normalizeQuoteInput(parsed.data);

    const db = getAdminDb();
    const shop = await db.collection('shops').doc(input.shopId).get();
    const pricing = shop.exists ? normalizeShopPricing(shop.data()) : undefined;
    if (!pricing) return NextResponse.json({ error: 'Shop pricing unavailable' }, { status: 400 });
    if (shop.data()?.isOpen === false) return NextResponse.json({ error: 'This shop is currently closed' }, { status: 409 });

    try {
      await verifyCheckoutFiles(input, userId);
    } catch (error) {
      if (error instanceof CheckoutInputError) return NextResponse.json({ error: error.message }, { status: 400 });
      throw error;
    }

    let quote: ReturnType<typeof createServerQuote>;
    try {
      quote = createServerQuote(input, pricing);
    } catch (error) {
      if (error instanceof QuoteError) return NextResponse.json({ error: error.message }, { status: 400 });
      throw error;
    }
    const idHash = crypto.createHash('sha256').update(`${userId}:${idempotencyKey}`).digest('hex');
    const idempotencyRef = db.collection('payment_idempotency').doc(idHash);
    const existing = await idempotencyRef.get();
    if (existing.exists) {
      const data = existing.data()!;
      if (data.userId !== userId) return NextResponse.json({ error: 'Invalid idempotency key' }, { status: 409 });
      if (data.razorpayOrder) {
        return NextResponse.json({ order: data.razorpayOrder, quote: data.quote }, { headers: { 'Cache-Control': 'no-store' } });
      }
      return NextResponse.json({ error: 'Checkout creation is already in progress' }, { status: 409 });
    }

    await idempotencyRef.create({ userId, state: 'creating', createdAt: new Date() });
    try {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) throw new Error('Razorpay is not configured');

      const Razorpay = (await import('razorpay')).default;
      const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const razorpayOrder = await instance.orders.create({
        amount: quote.amountPaise,
        currency: quote.currency,
        receipt: `pp_${idHash.slice(0, 24)}`,
        notes: { userId, shopId: input.shopId },
      });

      const payment = {
      userId,
      shopId: input.shopId,
      shopName: shop.data()!.name || '',
      quoteInput: input,
      quote,
      amount: quote.amount,
      amountPaise: quote.amountPaise,
      currency: quote.currency,
      status: 'created',
      razorpayOrderId: razorpayOrder.id,
      idempotencyKeyHash: idHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
      const batch = db.batch();
      batch.set(db.collection('payments').doc(razorpayOrder.id), payment);
      batch.set(idempotencyRef, { state: 'created', razorpayOrder, quote, updatedAt: new Date() }, { merge: true });
      await batch.commit();

      captureServerEvent({ event: 'razorpay_order_created', distinctId: userId, properties: { razorpay_order_id: razorpayOrder.id, amount: quote.amount, shopId: input.shopId } });
      return NextResponse.json({ order: razorpayOrder, quote }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      // A provider failure must not poison this idempotency key forever.
      await idempotencyRef.delete().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    captureServerEvent({ event: 'order_creation_failed', distinctId: userId, properties: { stage: 'payment_intent', error: String((error as Error)?.message || error) } });
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
