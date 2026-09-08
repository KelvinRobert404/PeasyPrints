import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rawTicket = request.nextUrl.searchParams.get('ticket');
  if (!rawTicket || rawTicket.length < 32) return NextResponse.json({ error: 'A print ticket is required' }, { status: 401 });

  const db = getAdminDb();
  const ticketId = crypto.createHash('sha256').update(rawTicket).digest('hex');
  const ticketRef = db.collection('print_tickets').doc(ticketId);
  const orderRef = db.collection('orders').doc(id);
  const order = await db.runTransaction(async (transaction) => {
    const [ticket, snapshot] = await Promise.all([transaction.get(ticketRef), transaction.get(orderRef)]);
    if (!ticket.exists || !snapshot.exists) return null;
    const ticketData = ticket.data()!;
    const orderData = snapshot.data()!;
    const expiresAt = ticketData.expiresAt?.toDate?.() || new Date(ticketData.expiresAt);
    if (ticketData.jobId !== id || ticketData.shopId !== orderData.shopId || ticketData.usedAt || expiresAt.getTime() <= Date.now()) return null;
    if (orderData.paymentStatus !== 'paid' || ['cancelled', 'completed'].includes(orderData.status)) return null;
    transaction.update(ticketRef, { usedAt: new Date() });
    return orderData;
  });
  if (!order) return NextResponse.json({ error: 'Invalid or expired print ticket' }, { status: 401 });

  const isColor = String(order.printSettings?.printColor || '').toLowerCase().includes('color');
  const filePath = (order.splitFilePaths && (isColor ? order.splitFilePaths.colorPath : order.splitFilePaths.bwPath)) || order.filePath;
  if (!filePath) return NextResponse.json({ error: 'No file is attached to this job' }, { status: 409 });
  const [fileUrl] = await getAdminBucket().file(filePath).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000 });
  return NextResponse.json({ fileUrl, copies: Math.max(1, Math.min(Number(order.printSettings?.copies || 1), 50)), isColor }, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

