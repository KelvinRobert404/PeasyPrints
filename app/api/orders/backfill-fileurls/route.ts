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
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin envs');
  }
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

type BackfillRequest = {
  ids?: string[];
  limit?: number;
  dryRun?: boolean;
};

function parseObjectRefFromUrl(urlString: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(urlString);
    // Pattern 1: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?...
    if (url.hostname === 'firebasestorage.googleapis.com') {
      const m = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/][^]*)$/);
      if (m) {
        const bucket = m[1];
        const encodedPathWithMaybeTrailing = m[2];
        // encodedPath may include additional slashes but no question mark (query is separate)
        const path = decodeURIComponent(encodedPathWithMaybeTrailing);
        return { bucket, path };
      }
    }
    // Pattern 2: https://storage.googleapis.com/{bucket}/{path}?...
    if (url.hostname === 'storage.googleapis.com') {
      const parts = url.pathname.replace(/^\//, '').split('/');
      if (parts.length >= 2) {
        const bucket = parts.shift() as string;
        const path = parts.join('/');
        return { bucket, path };
      }
    }
    // Pattern 3: https://{bucket}.storage.googleapis.com/{path}?... (less common)
    if (url.hostname.endsWith('.storage.googleapis.com')) {
      const bucket = url.hostname.replace('.storage.googleapis.com', '');
      const path = url.pathname.replace(/^\//, '');
      if (bucket && path) return { bucket, path };
    }
    // Pattern 4: https://{bucketHost}/{maybe o}/{encodedPath}?... (CDN style)
    if (url.hostname.endsWith('.firebasestorage.app')) {
      // Usually either /o/{encodedPath} or just /{path}
      const oMatch = url.pathname.match(/^\/o\/([^/][^]*)$/);
      if (oMatch) {
        const bucket = url.hostname; // Accept host as bucket identifier for backfill
        const path = decodeURIComponent(oMatch[1]);
        return { bucket, path };
      }
      const path = url.pathname.replace(/^\//, '');
      if (path) {
        return { bucket: url.hostname, path };
      }
    }
  } catch {}
  return null;
}

function needsBackfill(urlString: string): boolean {
  if (!urlString) return false;
  const hasToken = urlString.includes('token=');
  const hasSignedParams = urlString.includes('GoogleAccessId=') || urlString.includes('Signature=') || urlString.includes('Expires=');
  // If already token-based, skip
  if (hasToken && !hasSignedParams) return false;
  // If looks like a signed URL or lacks token and uses storage domains, backfill
  const looksLikeStorage = urlString.includes('firebasestorage.googleapis.com') || urlString.includes('storage.googleapis.com');
  return looksLikeStorage && (!hasToken || hasSignedParams);
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-admin-secret');
    if (!secret || secret !== process.env.BACKFILL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as BackfillRequest;
    const ids = Array.isArray(body?.ids) ? body.ids : undefined;
    const limit = Math.max(1, Math.min(Number(body?.limit) || 50, 500));
    const dryRun = !!body?.dryRun;

    ensureAdminInit();

    const db = admin.firestore();
    const storageBucketDefault = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string | undefined;
    const results: Array<{ id: string; oldUrl?: string; newUrl?: string; status: string; error?: string }> = [];

    if (ids && ids.length > 0) {
      for (const id of ids) {
        try {
          const ref = db.collection('orders').doc(id);
          const snap = await ref.get();
          if (!snap.exists) {
            results.push({ id, status: 'skipped', error: 'Order not found' });
            continue;
          }
          const data = snap.data() as any;
          const oldUrl = data?.fileUrl as string;
          if (!oldUrl || !needsBackfill(oldUrl)) {
            results.push({ id, oldUrl, status: 'skipped' });
            continue;
          }
          const refInfo = parseObjectRefFromUrl(oldUrl);
          if (!refInfo) {
            results.push({ id, oldUrl, status: 'failed', error: 'Could not parse object path from URL' });
            continue;
          }
          const bucketName = refInfo.bucket && refInfo.bucket.includes('.') ? refInfo.bucket : (storageBucketDefault as string);
          const bucket = admin.storage().bucket(bucketName);
          const file = bucket.file(refInfo.path);
          const [exists] = await file.exists();
          if (!exists) {
            results.push({ id, oldUrl, status: 'failed', error: 'Object not found in bucket' });
            continue;
          }
          const token = crypto.randomUUID();
          if (!dryRun) {
            await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
          }
          const encodedPath = encodeURIComponent(refInfo.path);
          const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
          if (!dryRun) {
            await ref.update({ fileUrl: newUrl });
          }
          results.push({ id, oldUrl, newUrl, status: dryRun ? 'would_update' : 'updated' });
        } catch (err: any) {
          results.push({ id, status: 'failed', error: String(err?.message || err) });
        }
      }
    } else {
      // Process a limited batch of recent orders (no filter available for substring)
      const snap = await db.collection('orders').orderBy('timestamp', 'desc').limit(limit).get();
      for (const doc of snap.docs) {
        try {
          const data = doc.data() as any;
          const id = doc.id;
          const oldUrl = data?.fileUrl as string;
          if (!oldUrl || !needsBackfill(oldUrl)) {
            results.push({ id, oldUrl, status: 'skipped' });
            continue;
          }
          const refInfo = parseObjectRefFromUrl(oldUrl);
          if (!refInfo) {
            results.push({ id, oldUrl, status: 'failed', error: 'Could not parse object path from URL' });
            continue;
          }
          const bucketName = refInfo.bucket && refInfo.bucket.includes('.') ? refInfo.bucket : (storageBucketDefault as string);
          const bucket = admin.storage().bucket(bucketName);
          const file = bucket.file(refInfo.path);
          const [exists] = await file.exists();
          if (!exists) {
            results.push({ id, oldUrl, status: 'failed', error: 'Object not found in bucket' });
            continue;
          }
          const token = crypto.randomUUID();
          if (!dryRun) {
            await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
          }
          const encodedPath = encodeURIComponent(refInfo.path);
          const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
          if (!dryRun) {
            await doc.ref.update({ fileUrl: newUrl });
          }
          results.push({ id, oldUrl, newUrl, status: dryRun ? 'would_update' : 'updated' });
        } catch (err: any) {
          results.push({ id: doc.id, status: 'failed', error: String(err?.message || err) });
        }
      }
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}



