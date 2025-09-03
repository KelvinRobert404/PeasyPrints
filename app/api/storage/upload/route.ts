import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import admin from 'firebase-admin';
import crypto from 'crypto';
import { isAllowedOrigin } from '@/lib/utils/origin';

export const runtime = 'nodejs';

let adminInitialized = false;
function ensureAdminInit() {
  if (adminInitialized) return;
  // Avoid duplicate initializeApp during dev HMR
  // @ts-ignore
  if ((admin as any).apps && (admin as any).apps.length > 0) {
    adminInitialized = true;
    return;
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin envs');
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: storageBucket || undefined
  });
  adminInitialized = true;
}

export async function POST(req: NextRequest) {
  try {
    ensureAdminInit();

    // Require authenticated session and ignore client-supplied userId
    const { userId } = await clerkAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Basic CSRF protection for same-site/allowlisted requests
    if (!isAllowedOrigin(req.url, req.headers.get('origin'))) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file') as unknown as File | null;
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Restrict to PDF by extension and content-type; generate safe server-side filename
    const ext = (file.name?.split('.').pop() || 'pdf').toLowerCase();
    const mime = (file as any).type || '';
    const maxBytes = 25 * 1024 * 1024; // 25MB limit
    if (buffer.length > maxBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }
    if (ext !== 'pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }
    if (mime && mime !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }
    const safeName = `${crypto.randomUUID()}.pdf`;
    const path = `uploads/${userId}/${safeName}`;

    const defaultBucket = (admin.app().options.storageBucket as string) || '';
    // Resolve effective bucket from env or app options
    const envBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || defaultBucket;
    const bucket = admin.storage().bucket(envBucket);
    const gcsFile = bucket.file(path);
    await gcsFile.save(buffer, {
      contentType: 'application/pdf',
      resumable: false,
      public: false
    });

    const [signedUrl] = await gcsFile.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
    const url = signedUrl;
    const res = NextResponse.json({ url, path });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}



