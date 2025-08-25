import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

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

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file') as unknown as File | null;
    const userId = (form.get('userId') as string) || 'anonymous';
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = (file.name?.split('.').pop() || 'pdf').toLowerCase();
    const path = `uploads/${userId}/${Date.now()}-${file.name || 'file.' + ext}`;

    const defaultBucket = (admin.app().options.storageBucket as string) || '';
    // Resolve effective bucket from env or app options
    const envBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || defaultBucket;
    const bucket = admin.storage().bucket(envBucket);
    const gcsFile = bucket.file(path);
    await gcsFile.save(buffer, {
      contentType: file.type || 'application/octet-stream',
      resumable: false,
      public: true
    });

    const bucketName = bucket.name;
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media`;
    return NextResponse.json({ url, path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}



