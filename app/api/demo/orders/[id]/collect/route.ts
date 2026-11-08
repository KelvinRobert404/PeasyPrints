import { NextResponse, type NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { isDemoMode } from '@/lib/demo/mode';
import { readDemoSession } from '@/lib/demo/server/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Demo only: the student says they picked up their print. Moves the caller's
// own ready order ('printed') to 'collected'. Calling it again is fine.
// 404 outside the demo.

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

class CollectError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isDemoMode()) return fail(404, 'Not found');
  if (!isSameOrigin(request)) return fail(403, 'Cross-site requests are refused');
  const session = readDemoSession(request.cookies);
  if (!session) return fail(401, 'Sign in required');
  const { id } = await context.params;
  if (!ORDER_ID_PATTERN.test(id)) return fail(404, 'Order not found');

  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(id);
  try {
    const status = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(orderRef);
      // Someone else's order reads as missing.
      if (!snap.exists || snap.data()?.userId !== session.uid) throw new CollectError(404, 'Order not found');
      const current = String(snap.data()?.status ?? '');
      if (current === 'collected') return current;
      if (current !== 'printed') throw new CollectError(409, 'This order is not ready yet');
      const now = Timestamp.now();
      transaction.update(orderRef, { status: 'collected', collectedAt: now, updatedAt: now });
      return 'collected';
    });
    return NextResponse.json({ ok: true, id, status }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof CollectError) return fail(error.status, error.message);
    console.error('[demo/orders/collect]', error);
    return fail(500, 'Could not mark it collected');
  }
}

export async function GET() {
  if (!isDemoMode()) return fail(404, 'Not found');
  return NextResponse.json({ error: 'Use POST' }, { status: 405, headers: { ...NO_STORE, Allow: 'POST' } });
}
