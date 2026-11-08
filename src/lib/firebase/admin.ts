import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
// Relative .ts imports so node tests can load this module.
import { FakeBucket, FakeFirestore, fixtureBucketName } from './fakeAdmin.ts';
import { seedFakeDb } from './fakeSeed.ts';
import { isFixtureMode } from './fixtureMode.ts';
import { isDemoMode } from '../demo/mode.ts';
import { currentWorld } from '../demo/server/world.ts';

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

// Plain fixture mode: one seeded fake per server process, kept on globalThis
// so dev reloads and separately bundled routes share the same in-memory data.
type FixtureAdmin = { db: FakeFirestore; bucket: FakeBucket };
const fixtureGlobal = globalThis as typeof globalThis & { __swoopFixtureAdmin?: FixtureAdmin };

function fixtureAdmin(): FixtureAdmin {
  if (!fixtureGlobal.__swoopFixtureAdmin) {
    const db = new FakeFirestore();
    seedFakeDb(db);
    fixtureGlobal.__swoopFixtureAdmin = { db, bucket: new FakeBucket(fixtureBucketName()) };
  }
  return fixtureGlobal.__swoopFixtureAdmin;
}

// Demo mode: each call resolves the current visitor's world (src/lib/demo/server/world.ts).
// These fakes hold no data themselves, so one per module is enough.
let demoAdminCache: FixtureAdmin | null = null;

function demoAdmin(): FixtureAdmin {
  demoAdminCache ??= {
    db: new FakeFirestore({ resolveStore: async () => (await currentWorld()).db.store }),
    bucket: new FakeBucket(fixtureBucketName(), { resolveStore: async () => (await currentWorld()).bucket.store }),
  };
  return demoAdminCache;
}

export function getAdminDb(): Firestore {
  if (isDemoMode()) return demoAdmin().db as unknown as Firestore;
  if (isFixtureMode()) return fixtureAdmin().db as unknown as Firestore;
  return getFirestore(getAdminApp());
}

export function getAdminBucket(): AdminBucket {
  if (isDemoMode()) return demoAdmin().bucket as unknown as AdminBucket;
  if (isFixtureMode()) return fixtureAdmin().bucket as unknown as AdminBucket;
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace(/^gs:\/\//, '');
  return getStorage(getAdminApp()).bucket(bucketName || undefined);
}
