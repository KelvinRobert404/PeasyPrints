import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { isAdminUser } from '@/lib/admin/config';
import { getRequestUserId } from '@/lib/server/requestAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const order = await getAdminDb().collection('orders').doc(id).get();
  if (!order.exists) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  const data = order.data()!;
  let allowed = data.userId === userId || data.shopId === userId;
  if (!allowed) {
    const user = await currentUser();
    allowed = isAdminUser(user);
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const variant = request.nextUrl.searchParams.get('variant') || 'original';
  const path = variant === 'bw'
    ? data.splitFilePaths?.bwPath
    : variant === 'color'
      ? data.splitFilePaths?.colorPath
      : data.splitFilePaths?.originalPath || data.filePath;
  if (!path) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const [signedUrl] = await getAdminBucket().file(path).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000 });
  // Token-authenticated callers (the shopfront) can't follow a link with headers,
  // so they ask for the signed URL as JSON and open it themselves.
  if (request.nextUrl.searchParams.get('format') === 'json') {
    return NextResponse.json({ url: signedUrl }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const response = NextResponse.redirect(signedUrl, 307);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
