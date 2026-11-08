import { NextResponse, type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { DEMO_ORIGIN, DEMO_VISITOR_COOKIE } from '@/lib/demo/contract';
import { isDemoMode } from '@/lib/demo/mode';
import { readDemoSession } from '@/lib/demo/server/identity';
import {
  DEMO_EVENT_ID_PREFIX,
  RazorpayDemoError,
  demoRazorpayId,
  handlerResponseFor,
  payDemoOrder,
  paymentErrorFor,
  signWebhookBody,
  webhookEventFor,
} from '@/lib/demo/server/razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Demo only: plays Razorpay's servers for the demo pay sheet. Records a UPI
// payment on the visitor's demo order (captured, or failed on request), sends
// the signed webhook to our own /api/razorpay/webhook in this visitor's world,
// and returns what Checkout hands to `handler` (or to `payment.failed`).
// No money moves and nothing leaves localhost. 404 outside the demo.

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
/** The webhook route may still be compiling on the first payment. */
const WEBHOOK_TIMEOUT_MS = 90_000;

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/** Browsers send Origin on POST; a cross-site one is refused. */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === request.nextUrl.host || host === request.headers.get('host');
  } catch {
    return false;
  }
}

/** Our own origin, only ever on this machine. */
function localOrigin(request: NextRequest): string {
  const url = new URL(request.url);
  return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname) ? url.origin : DEMO_ORIGIN;
}

function parseBody(value: unknown): { orderId: string; fail: boolean } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { order_id: orderId, fail: failFlag } = value as Record<string, unknown>;
  if (typeof orderId !== 'string' || orderId.length === 0 || orderId.length > 64) return null;
  if (failFlag !== undefined && typeof failFlag !== 'boolean') return null;
  return { orderId, fail: failFlag === true };
}

/** Delivers the signed webhook like Razorpay would. A failed delivery never fails the payment. */
async function sendWebhook(request: NextRequest, body: string, webhookSecret: string): Promise<boolean> {
  const visitor = request.cookies.get(DEMO_VISITOR_COOKIE)?.value;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Razorpay-Signature': signWebhookBody(body, webhookSecret),
    'X-Razorpay-Event-Id': demoRazorpayId(DEMO_EVENT_ID_PREFIX),
  };
  // The visitor cookie picks the same world the payment was recorded in.
  if (visitor && VISITOR_ID_PATTERN.test(visitor)) headers.Cookie = `${DEMO_VISITOR_COOKIE}=${visitor}`;
  try {
    const response = await fetch(new URL('/api/razorpay/webhook', localOrigin(request)), {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!response.ok) console.warn(`[demo/razorpay] webhook answered ${response.status}`);
    return response.ok;
  } catch (error) {
    console.warn('[demo/razorpay] webhook not delivered', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isDemoMode()) return fail(404, 'Not found');
  if (!isSameOrigin(request)) return fail(403, 'Cross-site requests are refused');
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return fail(415, 'Send JSON');

  const session = readDemoSession(request.cookies);
  if (!session) return fail(401, 'Sign in required');

  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }
  const input = parseBody(raw);
  if (!input) return fail(400, 'Send an order_id');

  // The launcher's placeholders, never real keys.
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!keySecret || !webhookSecret) return fail(500, 'Razorpay placeholders are missing. Run npm run demo.');

  try {
    const { payment } = await payDemoOrder(getAdminDb(), { orderId: input.orderId, userId: session.uid, fail: input.fail });
    const webhook = await sendWebhook(request, JSON.stringify(webhookEventFor(payment)), webhookSecret);
    if (payment.status === 'failed') {
      return NextResponse.json({ ok: false, error: paymentErrorFor(payment), webhook }, { headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, ...handlerResponseFor(payment, keySecret), webhook }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RazorpayDemoError) {
      const status = /does not exist/.test(error.error.description) ? 404 : 409;
      return fail(status, error.error.description);
    }
    console.error('[demo/razorpay/pay]', error);
    return fail(500, 'Demo payment failed');
  }
}

export async function GET() {
  if (!isDemoMode()) return fail(404, 'Not found');
  return NextResponse.json({ error: 'Use POST' }, { status: 405, headers: { ...NO_STORE, Allow: 'POST' } });
}
