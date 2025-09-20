import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && String(v);
}

function initAdmin() {
  // @ts-ignore
  if (!(admin as any).apps || (admin as any).apps.length === 0) {
    const projectId = getEnv('FIREBASE_ADMIN_PROJECT_ID');
    const clientEmail = getEnv('FIREBASE_ADMIN_CLIENT_EMAIL');
    const privateKey = getEnv('FIREBASE_ADMIN_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Server is not configured');
    }
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  }
}

function serializeTimestamp(ts: any): number | null {
  try { return ts?.toMillis?.() ?? null; } catch { return null; }
}

export async function GET(req: NextRequest) {
  try {
    const expected = (getEnv('NEXT_PUBLIC_GODVIEW_PASSPHRASE') || 'swoopistheking').toString();
    const header = req.headers.get('x-godview-passphrase') || '';
    const url = new URL(req.url);
    const qp = url.searchParams.get('pass') || '';
    const provided = header || qp;
    if (!provided || provided !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    initAdmin();

    const fs = admin.firestore();

    const [shopsSnap, ordersSnap, pendingSnap, historySnap] = await Promise.all([
      fs.collection('shops').get(),
      fs.collection('orders').orderBy('timestamp', 'desc').limit(500).get(),
      fs.collection('orders').where('status', 'in', ['processing', 'printing', 'printed']).orderBy('timestamp', 'desc').limit(500).get(),
      fs.collection('history').orderBy('historyTimestamp', 'desc').limit(500).get(),
    ]);

    const shops = shopsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const orders = ordersSnap.docs.map((d) => {
      const data: any = d.data();
      return { id: d.id, ...data, timestamp: serializeTimestamp(data.timestamp) };
    });
    const pendingOrders = pendingSnap.docs.map((d) => {
      const data: any = d.data();
      return { id: d.id, ...data, timestamp: serializeTimestamp(data.timestamp) };
    });
    const historyOrders = historySnap.docs.map((d) => {
      const data: any = d.data();
      return { id: d.id, ...data, historyTimestamp: serializeTimestamp(data.historyTimestamp) };
    });

    return NextResponse.json({ shops, orders, pendingOrders, historyOrders, serverTime: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


