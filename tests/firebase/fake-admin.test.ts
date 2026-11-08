import assert from 'node:assert/strict';
import test from 'node:test';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { FakeBucket, FakeBucketStore, FakeFirestore, FakeFirestoreStore } from '../../src/lib/firebase/fakeAdmin.ts';
import { seedFakeDb } from '../../src/lib/firebase/fakeSeed.ts';
import { DEFAULT_FIXTURE_USER_ID, FIXTURE_USER_COOKIE, fixtureUserId, isFixtureMode, parseFixtureUserId } from '../../src/lib/firebase/fixtureMode.ts';

function withEnv(env: Record<string, string | undefined>, run: () => void) {
  const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  const target = process.env as Record<string, string | undefined>;
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete target[key];
      else target[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete target[key];
      else target[key] = value;
    }
  }
}

test('fixture mode is off unless the flag is 1 outside production', () => {
  withEnv({ NEXT_PUBLIC_SWOOP_FIXTURES: undefined, NODE_ENV: 'development' }, () => assert.equal(isFixtureMode(), false));
  withEnv({ NEXT_PUBLIC_SWOOP_FIXTURES: 'true', NODE_ENV: 'development' }, () => assert.equal(isFixtureMode(), false));
  withEnv({ NEXT_PUBLIC_SWOOP_FIXTURES: '1', NODE_ENV: 'production' }, () => assert.equal(isFixtureMode(), false));
  withEnv({ NEXT_PUBLIC_SWOOP_FIXTURES: '1', NODE_ENV: 'development' }, () => assert.equal(isFixtureMode(), true));
});

test('fixture user comes from the cookie, unknown ids fall back to the default', () => {
  const cookies = (value?: string) => ({ get: (name: string) => (name === FIXTURE_USER_COOKIE && value !== undefined ? { value } : undefined) });
  assert.equal(DEFAULT_FIXTURE_USER_ID, 'verified-kju-main');
  assert.equal(fixtureUserId(cookies('admin')), 'admin');
  assert.equal(fixtureUserId(cookies('girls-approved')), 'girls-approved');
  assert.equal(fixtureUserId(cookies('root')), 'verified-kju-main');
  assert.equal(fixtureUserId(cookies()), 'verified-kju-main');
  assert.equal(parseFixtureUserId('pending-id-card'), 'pending-id-card');
  assert.equal(parseFixtureUserId(null), 'verified-kju-main');
});

test('seed hook runs on an empty database', async () => {
  const db = new FakeFirestore();
  seedFakeDb(db);
  // KADA-19 SEED seeds the demo users (four personas and new-user).
  assert.equal((await db.collection('users').get()).size, 5);
});

test('create fails with ALREADY_EXISTS when the document exists', async () => {
  const db = new FakeFirestore();
  const ref = db.collection('orders').doc('o1');
  await ref.create({ status: 'new' });
  await assert.rejects(ref.create({ status: 'other' }), (error: Error & { code?: number }) => {
    assert.equal(error.code, 6);
    assert.match(error.message, /already exists/i);
    return true;
  });
  assert.equal((await ref.get()).data()?.status, 'new');
});

test('add and doc() generate 20 character ids', async () => {
  const db = new FakeFirestore();
  const ref = await db.collection('campus_admin_audit').add({ action: 'view' });
  assert.equal(ref.id.length, 20);
  assert.equal(db.collection('x').doc().id.length, 20);
  assert.equal((await ref.get()).exists, true);
});

test('increment works on existing, missing and merged fields', async () => {
  const db = new FakeFirestore();
  const ref = db.doc('metrics/m1');
  await ref.set({ views: 2 });
  await ref.update({ views: FieldValue.increment(3), saves: FieldValue.increment(1) });
  assert.deepEqual((await ref.get()).data(), { views: 5, saves: 1 });
  await ref.set({ views: FieldValue.increment(-1), nested: { n: FieldValue.increment(4) } }, { merge: true });
  assert.deepEqual((await ref.get()).data(), { views: 4, saves: 1, nested: { n: 4 } });
  // set without merge replaces the document, so the increment starts from zero
  await ref.set({ views: FieldValue.increment(7) });
  assert.deepEqual((await ref.get()).data(), { views: 7 });
});

test('update applies dotted field paths and needs an existing document', async () => {
  const db = new FakeFirestore();
  const ref = db.doc('shops/s1');
  await ref.set({ name: 'Copy hub', stats: { orders: 1, revenue: 10 }, flags: { a: true } });
  await ref.update({ 'stats.orders': FieldValue.increment(1), 'stats.payouts.pending': 3, 'flags.a': FieldValue.delete(), name: 'Hub' });
  assert.deepEqual((await ref.get()).data(), { name: 'Hub', stats: { orders: 2, revenue: 10, payouts: { pending: 3 } }, flags: {} });
  await ref.update('stats.revenue', 25, 'open', true);
  const snapshot = await ref.get();
  assert.equal(snapshot.get('stats.revenue'), 25);
  assert.equal(snapshot.get('open'), true);
  // a map value replaces the whole map at that path
  await ref.update({ stats: { orders: 0 } });
  assert.deepEqual((await ref.get()).data()?.stats, { orders: 0 });

  await assert.rejects(db.doc('shops/missing').update({ a: 1 }), (error: Error & { code?: number }) => error.code === 5);
  await assert.rejects(ref.update({}), /At least one field/);
});

test('merge set deep merges maps, deletes fields and keeps dotted keys literal', async () => {
  const db = new FakeFirestore();
  const ref = db.doc('users/u1');
  await ref.set({ profile: { name: 'Asha', year: 2 }, role: 'student', temp: 1 });
  await ref.set({ profile: { year: 3, hostel: 'B' }, temp: FieldValue.delete(), 'a.b': 1 }, { merge: true });
  assert.deepEqual((await ref.get()).data(), { profile: { name: 'Asha', year: 3, hostel: 'B' }, role: 'student', 'a.b': 1 });

  const fresh = db.doc('users/u2');
  await fresh.set({ x: 1 }, { merge: true });
  assert.deepEqual((await fresh.get()).data(), { x: 1 });
  await assert.rejects(db.doc('users/u3').set({ gone: FieldValue.delete() }), /FieldValue.delete/);
});

test('serverTimestamp, Dates and createTime use the real Timestamp class', async () => {
  const db = new FakeFirestore();
  const ref = db.doc('posts/p1');
  const when = new Date('2026-01-02T03:04:05.000Z');
  await ref.set({ createdAt: FieldValue.serverTimestamp(), expiresAt: when });
  const snapshot = await ref.get();
  assert.ok(snapshot.data()?.createdAt instanceof Timestamp);
  assert.ok(snapshot.data()?.expiresAt instanceof Timestamp);
  assert.equal((snapshot.data()?.expiresAt as Timestamp).toMillis(), when.getTime());
  assert.ok(snapshot.createTime instanceof Timestamp);
  const created = snapshot.createTime!;
  await ref.update({ title: 'x' });
  assert.equal((await ref.get()).createTime?.isEqual(created), true);
});

test('arrayUnion and arrayRemove dedupe by value', async () => {
  const db = new FakeFirestore();
  const ref = db.doc('lists/l1');
  await ref.set({ tags: ['a'] });
  await ref.update({ tags: FieldValue.arrayUnion('a', 'b', 'c') });
  await ref.update({ tags: FieldValue.arrayRemove('b') });
  await ref.update({ fresh: FieldValue.arrayUnion({ k: 1 }, { k: 1 }) });
  assert.deepEqual((await ref.get()).data(), { tags: ['a', 'c'], fresh: [{ k: 1 }] });
});

test('undefined values and class instances are rejected like the real SDK', async () => {
  const db = new FakeFirestore();
  await assert.rejects(db.doc('a/b').set({ x: undefined }), /undefined/);
  class Custom { value = 1; }
  await assert.rejects(db.doc('a/b').set({ x: new Custom() }), /Custom/);
  assert.throws(() => db.collection('a/b'), /collection/);
  assert.throws(() => db.doc('a'), /document/);
});

test('snapshots are copies, not live views of the store', async () => {
  const db = new FakeFirestore();
  const ref = db.doc('a/b');
  const input = { list: [1], map: { k: 'v' } };
  await ref.set(input);
  input.list.push(2);
  const data = (await ref.get()).data()!;
  (data.map as Record<string, string>).k = 'changed';
  assert.deepEqual((await ref.get()).data(), { list: [1], map: { k: 'v' } });
});

test('queries filter, order and limit', async () => {
  const db = new FakeFirestore();
  const listings = db.collection('marketplace_listings');
  const at = (minutes: number) => Timestamp.fromMillis(Date.UTC(2026, 0, 1) + minutes * 60_000);
  await listings.doc('l1').set({ authorId: 'u1', status: 'active', price: 1500, tags: ['books'], postedAt: at(1) });
  await listings.doc('l2').set({ authorId: 'u2', status: 'active', price: 800, tags: ['cycle', 'books'], postedAt: at(3) });
  await listings.doc('l3').set({ authorId: 'u1', status: 'sold', price: 2500, tags: [], postedAt: at(2) });
  await listings.doc('l4').set({ authorId: 'u3', status: 'draft' });
  await db.doc('marketplace_listings/l1/history/h1').set({ status: 'active' });

  const ids = async (query: { get(): Promise<{ docs: Array<{ id: string }> }> }) => (await query.get()).docs.map((doc) => doc.id);

  assert.deepEqual(await ids(listings.where('status', '==', 'active')), ['l1', 'l2']);
  assert.deepEqual(await ids(listings.where('authorId', '==', 'u1').where('status', '==', 'active')), ['l1']);
  assert.deepEqual(await ids(listings.where('status', '!=', 'active')), ['l4', 'l3']);
  assert.deepEqual(await ids(listings.where('status', 'in', ['sold', 'draft'])), ['l3', 'l4']);
  assert.deepEqual(await ids(listings.where('tags', 'array-contains', 'books')), ['l1', 'l2']);
  assert.deepEqual(await ids(listings.where('price', '<', 1500)), ['l2']);
  assert.deepEqual(await ids(listings.where('price', '<=', 1500)), ['l2', 'l1']);
  assert.deepEqual(await ids(listings.where('price', '>', 1500)), ['l3']);
  assert.deepEqual(await ids(listings.where('price', '>=', 800).orderBy('price', 'desc')), ['l3', 'l1', 'l2']);
  assert.deepEqual(await ids(listings.where('postedAt', '<=', at(2))), ['l1', 'l3']);
  // orderBy drops documents missing the field; limit trims after sorting
  assert.deepEqual(await ids(listings.orderBy('postedAt', 'desc').limit(2)), ['l2', 'l3']);
  assert.deepEqual(await ids(listings.limit(1)), ['l1']);
  // a string never matches a numeric range
  assert.deepEqual(await ids(listings.where('price', '>', '0')), []);

  const snapshot = await listings.where('status', '==', 'missing').get();
  assert.equal(snapshot.empty, true);
  assert.equal(snapshot.size, 0);
  assert.equal((await listings.count().get()).data().count, 4);
  assert.throws(() => listings.where('status', 'in', []), /non-empty array/);
});

test('getAll returns snapshots in request order', async () => {
  const db = new FakeFirestore();
  await db.doc('orders/a').set({ n: 1 });
  await db.doc('orders/c').set({ n: 3 });
  const snapshots = await db.getAll(db.doc('orders/c'), db.doc('orders/b'), db.doc('orders/a'));
  assert.deepEqual(snapshots.map((snapshot) => [snapshot.id, snapshot.exists]), [['c', true], ['b', false], ['a', true]]);
});

test('transactions run one at a time and commit atomically', async () => {
  const db = new FakeFirestore();
  const counter = db.doc('counters/serial');
  await counter.set({ value: 0 });

  // read-modify-write without increment: only correct if transactions are serial
  await Promise.all(Array.from({ length: 20 }, () => db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counter);
    await new Promise((resolve) => setTimeout(resolve, 1));
    transaction.update(counter, { value: (snapshot.data()?.value as number) + 1 });
  })));
  assert.equal((await counter.get()).data()?.value, 20);

  // a throwing callback writes nothing
  await assert.rejects(db.runTransaction(async (transaction) => {
    transaction.set(db.doc('counters/other'), { value: 1 });
    throw new Error('boom');
  }), /boom/);
  assert.equal((await db.doc('counters/other').get()).exists, false);

  // a failing create at commit rolls back the earlier writes in the same transaction
  await assert.rejects(db.runTransaction(async (transaction) => {
    transaction.update(counter, { value: 99 });
    transaction.create(counter, { value: 1 });
  }), (error: Error & { code?: number }) => error.code === 6);
  assert.equal((await counter.get()).data()?.value, 20);

  // reads must come before writes
  await assert.rejects(db.runTransaction(async (transaction) => {
    transaction.update(counter, { value: 1 });
    await transaction.get(counter);
  }), /reads to be executed before all writes/);

  // queries inside a transaction and the returned value
  const count = await db.runTransaction(async (transaction) => (await transaction.get(db.collection('counters').where('value', '>=', 0))).size);
  assert.equal(count, 1);
});

test('batches apply all writes or none', async () => {
  const db = new FakeFirestore();
  await db.doc('r/1').set({ v: 1 });
  const ok = db.batch();
  ok.set(db.doc('r/2'), { v: 2 }).update(db.doc('r/1'), { v: FieldValue.increment(1) }).delete(db.doc('r/3'));
  await ok.commit();
  assert.deepEqual((await db.collection('r').get()).docs.map((doc) => doc.data().v), [2, 2]);

  const bad = db.batch();
  bad.delete(db.doc('r/1'));
  bad.update(db.doc('r/missing'), { v: 1 });
  await assert.rejects(bad.commit(), (error: Error & { code?: number }) => error.code === 5);
  assert.equal((await db.doc('r/1').get()).exists, true);
});

test('bucket stub saves, reads, signs and deletes files', async () => {
  const bucket = new FakeBucket('test-bucket');
  const file = bucket.file('campus_media/u1/a.png');
  assert.deepEqual(await file.exists(), [false]);
  await file.save(Buffer.from('png-bytes'), { metadata: { contentType: 'image/png', cacheControl: 'private', metadata: { owner: 'u1' } } });
  assert.deepEqual(await file.exists(), [true]);
  const [content] = await file.download();
  assert.equal(content.toString(), 'png-bytes');
  const [metadata] = await file.getMetadata();
  assert.equal(metadata.contentType, 'image/png');
  assert.equal(metadata.size, '9');
  assert.equal(metadata.metadata.owner, 'u1');

  const [readUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60_000 });
  assert.equal(readUrl, `data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`);
  const [writeUrl] = await bucket.file('renders/r1/out.mp4').getSignedUrl({ action: 'write', expires: Date.now() + 60_000 });
  assert.match(writeUrl, /^https:\/\/fixture-storage\.invalid\/test-bucket\/renders\/r1\/out\.mp4\?action=write/);

  await file.delete();
  assert.deepEqual(await file.exists(), [false]);
  await assert.rejects(file.download(), (error: Error & { code?: number }) => error.code === 404);
  await assert.rejects(file.delete(), (error: Error & { code?: number }) => error.code === 404);
  await file.delete({ ignoreNotFound: true });
});

test('a store resolver routes every async operation to the picked store', async () => {
  const stores = { a: new FakeFirestoreStore(), b: new FakeFirestoreStore() };
  let current: keyof typeof stores = 'a';
  const db = new FakeFirestore({ resolveStore: async () => stores[current] });

  await db.doc('r/1').set({ v: 1 });
  await db.collection('r').add({ v: 2 });
  await db.doc('r/1').update({ v: FieldValue.increment(1) });
  const batch = db.batch();
  batch.set(db.doc('r/3'), { v: 3 });
  await batch.commit();
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(db.doc('r/1'));
    transaction.set(db.doc('r/4'), { v: Number(snap.get('v')) + 2 });
  });
  assert.equal(stores.a.docs.size, 4);
  assert.equal(stores.b.docs.size, 0);
  assert.equal(db.store.docs.size, 0);

  current = 'b';
  assert.equal((await db.doc('r/1').get()).exists, false);
  assert.equal((await db.collection('r').get()).size, 0);
  assert.equal((await db.collection('r').count().get()).data().count, 0);
  await db.doc('r/1').set({ v: 9 });
  current = 'a';
  assert.equal((await db.doc('r/1').get()).get('v'), 2);
  await db.doc('r/4').delete();
  assert.deepEqual((await db.getAll(db.doc('r/4'), db.doc('r/3'))).map((snap) => snap.exists), [false, true]);

  // The synchronous helpers only work on a database with its own store.
  assert.throws(() => db.seedDoc('r/5', { v: 5 }), /synchronous/);
  assert.throws(() => db.collection('r').resolve(), /synchronous/);
});

test('the store reports written paths and whether a transaction is running', async () => {
  const db = new FakeFirestore();
  const written: string[][] = [];
  db.store.onWrite = (paths) => written.push(paths);
  await db.doc('r/1').set({ v: 1 });
  const batch = db.batch();
  batch.set(db.doc('r/2'), { v: 2 }).delete(db.doc('r/1'));
  await batch.commit();
  await assert.rejects(db.doc('r/missing').update({ v: 1 }));
  assert.deepEqual(written, [['r/1'], ['r/2', 'r/1']]);

  assert.equal(db.store.busy, false);
  let busyInside = false;
  await db.runTransaction(async () => {
    busyInside = db.store.busy;
  });
  assert.equal(busyInside, true);
  assert.equal(db.store.busy, false);
});

test('a bucket store resolver routes file operations and reports changes', async () => {
  const stores = { a: new FakeBucketStore(), b: new FakeBucketStore() };
  let current: keyof typeof stores = 'a';
  const bucket = new FakeBucket('test-bucket', { resolveStore: async () => stores[current] });
  const changed: string[][] = [];
  stores.a.onChange = (names) => changed.push(names);

  await bucket.file('x/a.txt').save('a');
  await bucket.file('x/b.txt').save('b');
  current = 'b';
  assert.deepEqual(await bucket.file('x/a.txt').exists(), [false]);
  assert.deepEqual((await bucket.getFiles({ prefix: 'x/' }))[0].length, 0);
  current = 'a';
  assert.equal((await bucket.file('x/a.txt').download())[0].toString(), 'a');
  await bucket.file('x/a.txt').delete();
  await bucket.file('x/a.txt').delete({ ignoreNotFound: true });
  await bucket.deleteFiles({ prefix: 'x/' });
  assert.deepEqual(changed, [['x/a.txt'], ['x/b.txt'], ['x/a.txt'], ['x/b.txt']]);
  assert.equal(bucket.store.files.size, 0);
});
