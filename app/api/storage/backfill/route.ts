import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import crypto from 'crypto';

export const runtime = 'nodejs';

function ensureAdminInit() {
  // @ts-ignore
  if ((admin as any).apps && (admin as any).apps.length > 0) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
  if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase Admin envs');
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }), storageBucket });
}

// Body: { filePaths: string[] } where each is like "uploads/{uid}/{filename}.pdf"
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-admin-secret');
    if (!secret || secret !== process.env.BACKFILL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const json = await req.json().catch(() => ({}));
    const filePaths: string[] = Array.isArray(json?.filePaths) ? json.filePaths : [];
    if (filePaths.length === 0) {
      return NextResponse.json({ error: 'No file paths provided' }, { status: 400 });
    }

    ensureAdminInit();
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string;
    const bucket = admin.storage().bucket(bucketName);

    const results: Array<{ path: string; url?: string; error?: string }> = [];
    for (const path of filePaths) {
      try {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        if (!exists) {
          results.push({ path, error: 'Not found' });
          continue;
        }
        const token = crypto.randomUUID();
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
        const encodedPath = encodeURIComponent(path);
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
        results.push({ path, url });
      } catch (err: any) {
        results.push({ path, error: String(err?.message || err) });
      }
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}


