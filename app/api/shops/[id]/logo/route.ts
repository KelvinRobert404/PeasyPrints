import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { matchesDeclaredFileType } from '@/lib/server/fileValidation';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import { isAllowedOrigin } from '@/lib/utils/origin';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 3 * 1024 * 1024;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const shop = await getAdminDb().collection('shops').doc(id).get();
  const path = shop.data()?.logoPath;
  if (!shop.exists || typeof path !== 'string' || !path.startsWith(`shop_logos/${id}/`)) {
    return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
  }
  try {
    const file = getAdminBucket().file(path);
    const [[metadata], [content]] = await Promise.all([file.getMetadata(), file.download()]);
    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': metadata.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  const { id } = await context.params;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isAllowedOrigin(request.url, request.headers.get('origin'), request.headers.get('x-forwarded-host'), request.headers.get('x-forwarded-proto'))) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  const rate = await checkRateLimit('shop-logo', userId, 10, 3600);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

  const form = await request.formData();
  const upload = form.get('file');
  if (!(upload instanceof File) || upload.size < 1 || upload.size > MAX_BYTES || !ALLOWED_TYPES.has(upload.type)) {
    return NextResponse.json({ error: 'Use a JPG, PNG, or WebP image up to 3 MB' }, { status: 400 });
  }
  const content = Buffer.from(await upload.arrayBuffer());
  if (!matchesDeclaredFileType(content, upload.type)) return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
  const ext = upload.type === 'image/png' ? 'png' : upload.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `shop_logos/${userId}/logo.${ext}`;
  await getAdminBucket().file(path).save(content, {
    resumable: false,
    metadata: { contentType: upload.type, cacheControl: 'public,max-age=3600' },
  });
  await getAdminDb().collection('shops').doc(userId).set({
    logoPath: path,
    logoUrl: `/api/shops/${encodeURIComponent(userId)}/logo?v=${Date.now()}`,
    updatedAt: new Date(),
  }, { merge: true });
  return NextResponse.json({ logoUrl: `/api/shops/${encodeURIComponent(userId)}/logo?v=${Date.now()}` });
}
