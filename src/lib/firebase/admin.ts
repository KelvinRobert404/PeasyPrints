import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { FakeBucket, FakeFirestore } from '@/lib/firebase/fakeAdmin';
import { seedFakeDb } from '@/lib/firebase/fakeSeed';
import { isFixtureMode } from '@/lib/firebase/fixtureMode';

type AdminBucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

let cachedApp: App | null = null;

export function getAdminApp(): App {
  // Fixture mode has no Firebase project: fail loudly instead of reaching a live one.
  if (isFixtureMode()) throw new Error('Firebase Admin app is unavailable in fixture mode');
  if (cachedApp) return cachedApp;
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return existing;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : undefined);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin environment variables');
  }

  cachedApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
  return cachedApp;
}

// One seeded fake per server process, kept on globalThis so dev reloads and
// separately bundled routes share the same in-memory data.
type FixtureAdmin = { db: FakeFirestore; bucket: FakeBucket };
const fixtureGlobal = globalThis as typeof globalThis & { __swoopFixtureAdmin?: FixtureAdmin };

function fixtureAdmin(): FixtureAdmin {
  if (!fixtureGlobal.__swoopFixtureAdmin) {
    const db = new FakeFirestore();
    seedFakeDb(db);
    const bucket = new FakeBucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace(/^gs:\/\//, '') || 'swoop-fixtures');
    fixtureGlobal.__swoopFixtureAdmin = { db, bucket };
  }
  return fixtureGlobal.__swoopFixtureAdmin;
}

export function getAdminDb(): Firestore {
  if (isFixtureMode()) return fixtureAdmin().db as unknown as Firestore;
  return getFirestore(getAdminApp());
}

export function getAdminBucket(): AdminBucket {
  if (isFixtureMode()) return fixtureAdmin().bucket as unknown as AdminBucket;
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace(/^gs:\/\//, '');
  return getStorage(getAdminApp()).bucket(bucketName || undefined);
}
