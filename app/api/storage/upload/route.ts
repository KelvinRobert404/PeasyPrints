import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { isAllowedOrigin } from '@/lib/utils/origin';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rateLimit';
import { getAdminBucket } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Require authenticated session and ignore client-supplied userId
    const { userId } = await clerkAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // A split assignment checkout uploads three files at once.
    const rate = await checkRateLimit('pdf-upload', userId, 30, 600);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);

    // Basic CSRF protection for same-site/allowlisted requests
    if (!isAllowedOrigin(req.url, req.headers.get('origin'), req.headers.get('x-forwarded-host'), req.headers.get('x-forwarded-proto'))) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file') as unknown as File | null;
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    // Reject on metadata before allocating a second in-memory copy. The platform
    // request-body limit is enforced separately at the edge.
    const ext = (file.name?.split('.').pop() || 'pdf').toLowerCase();
    const mime = (file as any).type || '';
    const maxBytes = 25 * 1024 * 1024; // 25MB limit
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }
    if (ext !== 'pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }
    if (mime && mime !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return NextResponse.json({ error: 'File content is not a valid PDF' }, { status: 400 });
    }
    // Count pages here so checkout prices the file that was actually uploaded,
    // not a page count the browser claims.
    let pageCount: number;
    try {
      pageCount = (await PDFDocument.load(buffer, { updateMetadata: false })).getPageCount();
    } catch {
      return NextResponse.json({ error: 'This PDF could not be read. It may be password-protected or damaged.' }, { status: 400 });
    }
    const safeName = `${crypto.randomUUID()}.pdf`;
    const path = `uploads/${userId}/${safeName}`;

    const gcsFile = getAdminBucket().file(path);
    await gcsFile.save(buffer, {
      contentType: 'application/pdf',
      resumable: false,
      public: false,
      metadata: { cacheControl: 'private,no-store', metadata: { ownerId: userId, pageCount: String(pageCount) } }
    });

    // Persist only the private object path. Authorized download endpoints issue
    // short-lived signed URLs when a customer or shop needs the document.
    const res = NextResponse.json({ path, pageCount });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e: any) {
    console.error('[storage/upload]', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}



