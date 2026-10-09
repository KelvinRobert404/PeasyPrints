import { NextRequest, NextResponse } from 'next/server';
import { getAdminBucket, getAdminDb } from '@/lib/firebase/admin';
import { matchesDeclaredFileType } from '@/lib/server/fileValidation';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import { isAllowedOrigin } from '@/lib/utils/origin';
import { getRequestUserId } from '@/lib/server/requestAuth';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 3 * 1024 * 1024;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const shop = await getAdminDb().collection('shops').doc(id).get();
  let path = shop.data()?.logoPath;
  if (shop.exists && typeof path !== 'string') {
    // Shops registered with a logo have logoUrl but no logoPath (the logo is
    // uploaded before the shop doc exists), so look in the standard location.
    for (const ext of ['png', 'jpg', 'webp']) {
      const [exists] = await getAdminBucket().file(`shop_logos/${id}/logo.${ext}`).exists();
      if (exists) { path = `shop_logos/${id}/logo.${ext}`; break; }
    }
  }
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
  const userId = await getRequestUserId(request);
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
  const logoUrl = `/api/shops/${encodeURIComponent(userId)}/logo?v=${Date.now()}`;
  // During registration the shop doc doesn't exist yet: the client creates it with
  // this logoUrl. Creating a stub here would turn that create into a denied update.
  const shopRef = getAdminDb().collection('shops').doc(userId);
  if ((await shopRef.get()).exists) {
    await shopRef.update({ logoPath: path, logoUrl, updatedAt: new Date() });
  }
  return NextResponse.json({ logoUrl });
}
