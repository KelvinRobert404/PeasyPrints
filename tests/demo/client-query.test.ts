import test from 'node:test';
import assert from 'node:assert/strict';

import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { FakeBucket, FakeDocumentReference, FakeFirestore } from '../../src/lib/firebase/fakeAdmin.ts';
import { seedFakeDb } from '../../src/lib/firebase/fakeSeed.ts';
import { FieldOp, Timestamp as ClientTimestamp, WIRE_TAG, encodeData, encodeValue } from '../../src/lib/demo/codec.ts';
import type { CodecHooks, WireMap, WireValue } from '../../src/lib/demo/codec.ts';
import {
  adminCodecHooks,
  handleClientRequest,
  isRefusedCollectionId,
} from '../../src/lib/demo/server/clientQuery.ts';
import type { ClientBucket, ClientResponse, WireDoc, WireFilter, WireOrder, WireQueryTarget, WireReadResult } from '../../src/lib/demo/server/clientQuery.ts';
import { DEMO_VISITOR_COOKIE } from '../../src/lib/demo/contract.ts';
import { resetWorldsForTests, setDemoCookieSourceForTests } from '../../src/lib/demo/server/world.ts';
import { GET, POST } from '../../app/api/demo/firestore/route.ts';

// ---------------------------------------------------------------------------
// Helpers

/** Client-side hooks, as the browser stand-in encodes values. */
class ClientRef {
  readonly path: string;
  constructor(path: string) {
    this.path = path;
  }
}

const clientHooks: CodecHooks = {
  refPath: (value) => (value instanceof ClientRef ? value.path : null),
  makeRef: (path) => new ClientRef(path),
};

function wire(value: unknown): WireValue {
  return encodeValue(value, clientHooks);
}

function seededDb(): FakeFirestore {
  const db = new FakeFirestore();
  seedFakeDb(db);
  const at = (minutes: number) => Timestamp.fromMillis(Date.UTC(2026, 10, 8, 9, minutes));
  db.seedDoc('things/a', { n: 3, tag: 'red', tags: ['x', 'y'], at: at(1), nested: { rank: 2 }, shop: db.doc('shops/one') });
  db.seedDoc('things/b', { n: 1, tag: 'blue', tags: ['y'], at: at(5), nested: { rank: 9 }, place: new GeoPoint(12.9, 77.6) });
  db.seedDoc('things/c', { n: 7, tag: 'red', tags: [], at: at(3), nested: { rank: 5 } });
  db.seedDoc('things/d', { n: 7, tag: 'green', tags: ['x'], at: at(9) });
  db.seedDoc('things/e', { tag: 'red', bytes: Buffer.from([1, 2, 3]) });
  db.seedDoc('_rate_limits/ip-1', { count: 4 });
  return db;
}

function asAdmin(db: FakeFirestore): Firestore {
  return db as unknown as Firestore;
}

async function run(db: FakeFirestore, body: unknown, options: { getBucket?: () => ClientBucket } = {}): Promise<ClientResponse> {
  // JSON round trip, exactly like the browser sends it.
  return handleClientRequest(() => asAdmin(db), JSON.parse(JSON.stringify(body)), options);
}

function queryTarget(path: string, parts: { filters?: WireFilter[]; orders?: WireOrder[]; limit?: number; limitToLast?: number } = {}): WireQueryTarget {
  return { kind: 'query', path, filters: parts.filters ?? [], orders: parts.orders ?? [], limit: parts.limit ?? null, limitToLast: parts.limitToLast ?? null };
}

async function readQuery(db: FakeFirestore, target: WireQueryTarget): Promise<WireDoc[]> {
  const response = await run(db, { op: 'read', targets: [target] });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const result = (response.body as { results: WireReadResult[] }).results[0];
  assert.ok(result.ok && result.kind === 'query', JSON.stringify(result));
  return result.docs;
}

/** The same query straight on FakeFirestore, encoded the way the server encodes. */
async function direct(db: FakeFirestore, build: (base: any) => any, path: string): Promise<WireDoc[]> {
  const hooks = adminCodecHooks(asAdmin(db));
  const snap = await build(db.collection(path)).get();
  return snap.docs.map((doc: any) => ({ path: doc.ref.path, data: encodeData(doc.data(), hooks) }));
}

// ---------------------------------------------------------------------------
// Queries match FakeFirestore

test('where, orderBy and limit through clientQuery match FakeFirestore', async () => {
  const db = seededDb();
  const cases: Array<{ name: string; path: string; target: WireQueryTarget; build: (base: any) => any }> = [
    {
      name: 'ordersStore: a student’s orders, newest first',
      path: 'orders',
      target: queryTarget('orders', { filters: [{ field: 'userId', op: '==', value: 'verified-kju-main' }], orders: [{ field: 'timestamp', direction: 'desc' }] }),
      build: (q) => q.where('userId', '==', 'verified-kju-main').orderBy('timestamp', 'desc'),
    },
    {
      name: 'godview: latest orders with limit',
      path: 'orders',
      target: queryTarget('orders', { orders: [{ field: 'timestamp', direction: 'desc' }], limit: 2 }),
      build: (q) => q.orderBy('timestamp', 'desc').limit(2),
    },
    {
      name: 'in filter',
      path: 'orders',
      target: queryTarget('orders', { filters: [{ field: 'status', op: 'in', value: ['printing', 'printed'] }] }),
      build: (q) => q.where('status', 'in', ['printing', 'printed']),
    },
    {
      name: 'equality plus two orders',
      path: 'things',
      target: queryTarget('things', { filters: [{ field: 'tag', op: '==', value: 'red' }], orders: [{ field: 'n', direction: 'desc' }, { field: 'at', direction: 'asc' }] }),
      build: (q) => q.where('tag', '==', 'red').orderBy('n', 'desc').orderBy('at', 'asc'),
    },
    {
      name: 'timestamp range from the client',
      path: 'things',
      target: queryTarget('things', { filters: [{ field: 'at', op: '>=', value: wire(ClientTimestamp.fromMillis(Date.UTC(2026, 10, 8, 9, 3))) }] }),
      build: (q) => q.where('at', '>=', Timestamp.fromMillis(Date.UTC(2026, 10, 8, 9, 3))),
    },
    {
      name: 'array-contains and nested field order',
      path: 'things',
      target: queryTarget('things', { filters: [{ field: 'tags', op: 'array-contains', value: 'y' }], orders: [{ field: 'nested.rank', direction: 'asc' }] }),
      build: (q) => q.where('tags', 'array-contains', 'y').orderBy('nested.rank'),
    },
    {
      name: 'not-in, != and limitToLast',
      path: 'things',
      target: queryTarget('things', { filters: [{ field: 'n', op: 'not-in', value: [3] }], orders: [{ field: 'n', direction: 'asc' }], limitToLast: 2 }),
      build: (q) => q.where('n', 'not-in', [3]).orderBy('n').limitToLast(2),
    },
    {
      name: 'document id filter',
      path: 'things',
      target: queryTarget('things', { filters: [{ field: '__name__', op: 'in', value: ['a', 'd'] }] }),
      build: (q) => q.where('__name__', 'in', ['a', 'd']),
    },
    {
      name: 'reference equality from the client',
      path: 'things',
      target: queryTarget('things', { filters: [{ field: 'shop', op: '==', value: wire(new ClientRef('shops/one')) }] }),
      build: (q) => q.where('shop', '==', db.doc('shops/one')),
    },
  ];

  for (const entry of cases) {
    const viaClient = await readQuery(db, entry.target);
    const expected = await direct(db, entry.build, entry.path);
    assert.deepEqual(viaClient, expected, entry.name);
  }

  // The cases are not vacuous.
  const mine = await readQuery(db, cases[0].target);
  assert.ok(mine.length >= 2);
  assert.ok(mine.every((doc) => doc.data?.userId === 'verified-kju-main'));
  assert.equal((await readQuery(db, cases[1].target)).length, 2);
});

test('reads encode Timestamp, GeoPoint, refs and bytes for the wire', async () => {
  const db = seededDb();
  const response = await run(db, { op: 'read', targets: [{ kind: 'doc', path: 'things/a' }, { kind: 'doc', path: 'things/b' }, { kind: 'doc', path: 'things/e' }, { kind: 'doc', path: 'things/missing' }] });
  assert.equal(response.status, 200);
  const [a, b, e, missing] = (response.body as { results: WireReadResult[] }).results;
  assert.ok(a.ok && a.kind === 'doc' && b.ok && b.kind === 'doc' && e.ok && e.kind === 'doc' && missing.ok && missing.kind === 'doc');
  assert.equal((a.doc.data?.at as WireMap)[WIRE_TAG], 'timestamp');
  assert.deepEqual(a.doc.data?.shop, { [WIRE_TAG]: 'ref', path: 'shops/one' });
  assert.deepEqual(b.doc.data?.place, { [WIRE_TAG]: 'geopoint', latitude: 12.9, longitude: 77.6 });
  assert.deepEqual(e.doc.data?.bytes, { [WIRE_TAG]: 'bytes', base64: 'AQID' });
  assert.deepEqual(missing.doc, { path: 'things/missing', data: null });
});

test('a bad query fails on its own and the other reads still answer', async () => {
  const db = seededDb();
  const response = await run(db, {
    op: 'read',
    targets: [queryTarget('things', { limitToLast: 1 }), { kind: 'doc', path: 'things/a' }],
  });
  assert.equal(response.status, 200);
  const [bad, good] = (response.body as { results: WireReadResult[] }).results;
  assert.ok(!bad.ok);
  assert.equal(bad.error.code, 'invalid-argument');
  assert.ok(good.ok);
});

// ---------------------------------------------------------------------------
// Writes

test('writes decode field values and land in the store', async () => {
  const db = seededDb();
  const response = await run(db, {
    op: 'write',
    writes: [
      { kind: 'set', path: 'things/new', data: encodeData({ at: new FieldOp('serverTimestamp'), when: ClientTimestamp.fromMillis(1_000), shop: new ClientRef('shops/two') }, clientHooks, { allowFieldOps: true }), merge: false },
      { kind: 'update', path: 'things/a', data: encodeData({ n: new FieldOp('increment', 2), 'nested.rank': new FieldOp('delete'), tags: new FieldOp('arrayUnion', undefined, ['z']) }, clientHooks, { allowFieldOps: true }) },
      { kind: 'set', path: 'things/b', data: { tag: 'teal' }, merge: true },
      { kind: 'create', path: 'things/created', data: { ok: true } },
      { kind: 'delete', path: 'things/c' },
    ],
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));

  const created = (await db.doc('things/new').get()).data()!;
  assert.ok(created.at instanceof Timestamp);
  assert.ok(created.when instanceof Timestamp);
  assert.equal((created.when as Timestamp).toMillis(), 1_000);
  assert.ok(created.shop instanceof FakeDocumentReference);
  assert.equal((created.shop as FakeDocumentReference).path, 'shops/two');

  const a = (await db.doc('things/a').get()).data()!;
  assert.equal(a.n, 5);
  assert.deepEqual(a.nested, {});
  assert.deepEqual(a.tags, ['x', 'y', 'z']);
  const b = (await db.doc('things/b').get()).data()!;
  assert.equal(b.tag, 'teal');
  assert.equal(b.n, 1);
  assert.equal((await db.doc('things/created').get()).exists, true);
  assert.equal((await db.doc('things/c').get()).exists, false);
});

test('a write batch is all or nothing', async () => {
  const db = seededDb();
  const response = await run(db, {
    op: 'write',
    writes: [
      { kind: 'set', path: 'things/first', data: { ok: true }, merge: false },
      { kind: 'update', path: 'things/nope', data: { x: 1 } },
    ],
  });
  assert.equal(response.status, 404);
  assert.equal((response.body as { error: { code: string } }).error.code, 'not-found');
  assert.equal((await db.doc('things/first').get()).exists, false);

  const exists = await run(db, { op: 'write', writes: [{ kind: 'create', path: 'things/a', data: { x: 1 } }] });
  assert.equal(exists.status, 409);
});

test('field values are refused outside writes', async () => {
  const db = seededDb();
  const sentinel = { [WIRE_TAG]: 'fieldOp', op: 'serverTimestamp' };
  const response = await run(db, { op: 'read', targets: [queryTarget('things', { filters: [{ field: 'at', op: '==', value: sentinel }] })] });
  const [result] = (response.body as { results: WireReadResult[] }).results;
  assert.ok(!result.ok);
  assert.equal(result.error.code, 'invalid-argument');
});

// ---------------------------------------------------------------------------
// Refusals

test("collections starting with '_' are refused before the database is touched", async () => {
  assert.equal(isRefusedCollectionId('_rate_limits'), true);
  assert.equal(isRefusedCollectionId('orders'), false);
  const refused = [
    { op: 'read', targets: [{ kind: 'doc', path: '_rate_limits/ip-1' }] },
    { op: 'read', targets: [queryTarget('_rate_limits')] },
    { op: 'read', targets: [{ kind: 'doc', path: 'orders/x/_private/y' }] },
    { op: 'write', writes: [{ kind: 'set', path: '_rate_limits/ip-1', data: { count: 0 }, merge: false }] },
    { op: 'write', writes: [{ kind: 'delete', path: '_internal/doc' }] },
  ];
  for (const body of refused) {
    const response = await handleClientRequest(() => {
      throw new Error('the database must not be reached');
    }, body);
    assert.equal(response.status, 403, JSON.stringify(body));
    assert.equal((response.body as { error: { code: string } }).error.code, 'permission-denied');
  }

  // A reference to a refused collection inside written data is refused too.
  const db = seededDb();
  const viaRef = await run(db, { op: 'write', writes: [{ kind: 'set', path: 'things/z', data: { r: { [WIRE_TAG]: 'ref', path: '_rate_limits/ip-1' } }, merge: false }] });
  assert.equal(viaRef.status, 403);
  assert.equal((await db.doc('things/z').get()).exists, false);
  assert.equal((await db.doc('_rate_limits/ip-1').get()).data()?.count, 4);
});

test('malformed requests are refused', async () => {
  const db = seededDb();
  const bad: unknown[] = [
    null,
    { op: 'drop' },
    { op: 'read', targets: [] },
    { op: 'read', targets: [{ kind: 'doc', path: 'things' }] },
    { op: 'read', targets: [{ kind: 'doc', path: 'things//a' }] },
    { op: 'read', targets: [queryTarget('things/a')] },
    { op: 'read', targets: [{ ...queryTarget('things'), filters: [{ field: 'n', op: 'like', value: 1 }] }] },
    { op: 'read', targets: [{ ...queryTarget('things'), limit: 0 }] },
    { op: 'write', writes: [{ kind: 'update', path: 'things/a', data: {} }] },
    { op: 'write', writes: [{ kind: 'set', path: 'things/a', data: [1] }] },
    { op: 'downloadUrl', path: '../secret' },
  ];
  for (const body of bad) {
    const response = await run(db, body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

// ---------------------------------------------------------------------------
// Storage download URLs

test('download URLs are inline data: URLs for files in the bucket', async () => {
  const db = seededDb();
  const bucket = new FakeBucket('demo-test');
  await bucket.file('listing_images/u1/a.png').save(Buffer.from([137, 80, 78, 71]), { contentType: 'image/png' });
  const getBucket = () => bucket as unknown as ClientBucket;

  const found = await run(db, { op: 'downloadUrl', path: 'listing_images/u1/a.png' }, { getBucket });
  assert.equal(found.status, 200);
  assert.match((found.body as { url: string }).url, /^data:image\/png;base64,/);

  const missing = await run(db, { op: 'downloadUrl', path: 'listing_images/u1/none.png' }, { getBucket });
  assert.equal(missing.status, 404);
});

// ---------------------------------------------------------------------------
// The route

function withDemo<T>(on: boolean, fn: () => Promise<T>): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NEXT_PUBLIC_SWOOP_DEMO;
  if (on) env.NEXT_PUBLIC_SWOOP_DEMO = '1';
  else delete env.NEXT_PUBLIC_SWOOP_DEMO;
  return fn().finally(() => {
    if (previous === undefined) delete env.NEXT_PUBLIC_SWOOP_DEMO;
    else env.NEXT_PUBLIC_SWOOP_DEMO = previous;
  });
}

function routeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3019/api/demo/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3019', ...headers },
    body: JSON.stringify(body),
  });
}

test('/api/demo/firestore is 404 outside the demo', async () => {
  await withDemo(false, async () => {
    const post = await POST(routeRequest({ op: 'read', targets: [{ kind: 'doc', path: 'orders/x' }] }));
    assert.equal(post.status, 404);
    assert.equal((await GET()).status, 404);
  });
});

test("/api/demo/firestore runs on the visitor's world and refuses '_' collections", async () => {
  setDemoCookieSourceForTests(async () => ({
    get: (name: string) => (name === DEMO_VISITOR_COOKIE ? { value: 'client-query-test' } : undefined),
  }));
  try {
    await withDemo(true, async () => {
      const refused = await POST(routeRequest({ op: 'read', targets: [{ kind: 'doc', path: '_rate_limits/x' }] }));
      assert.equal(refused.status, 403);

      const crossSite = await POST(routeRequest({ op: 'read', targets: [{ kind: 'doc', path: 'orders/x' }] }, { Origin: 'https://evil.example' }));
      assert.equal(crossSite.status, 403);

      const notJson = await POST(new Request('http://localhost:3019/api/demo/firestore', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' }));
      assert.equal(notJson.status, 415);

      const query = queryTarget('orders', { filters: [{ field: 'userId', op: '==', value: 'verified-kju-main' }], orders: [{ field: 'timestamp', direction: 'desc' }] });
      const ok = await POST(routeRequest({ op: 'read', targets: [query] }));
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get('cache-control'), 'private, no-store');
      const [result] = ((await ok.json()) as { results: WireReadResult[] }).results;
      assert.ok(result.ok && result.kind === 'query');
      assert.ok(result.docs.length > 0);
      assert.ok(result.docs.every((doc) => doc.data?.userId === 'verified-kju-main'));

      const write = await POST(routeRequest({ op: 'write', writes: [{ kind: 'set', path: 'demo_probe/one', data: { hello: 'world' }, merge: false }] }));
      assert.equal(write.status, 200);
      const back = await POST(routeRequest({ op: 'read', targets: [{ kind: 'doc', path: 'demo_probe/one' }] }));
      const [doc] = ((await back.json()) as { results: WireReadResult[] }).results;
      assert.ok(doc.ok && doc.kind === 'doc');
      assert.deepEqual(doc.doc.data, { hello: 'world' });
    });
  } finally {
    setDemoCookieSourceForTests(null);
    resetWorldsForTests();
  }
});

// ---------------------------------------------------------------------------
// The browser stand-ins, end to end through handleClientRequest

const browser = globalThis as Record<string, unknown>;
let cookieJar = '';
const storage = new Map<string, string>();

function installBrowser(db: FakeFirestore): { requests: () => number; restore: () => void } {
  const saved = { window: browser.window, document: browser.document, localStorage: browser.localStorage, fetch: globalThis.fetch };
  let count = 0;
  browser.window = globalThis;
  browser.document = {
    get cookie() {
      return cookieJar;
    },
    visibilityState: 'visible',
    addEventListener: () => undefined,
  };
  browser.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  };
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), '/api/demo/firestore');
    count += 1;
    const result = await handleClientRequest(() => asAdmin(db), JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return {
    requests: () => count,
    restore: () => {
      browser.window = saved.window;
      browser.document = saved.document;
      browser.localStorage = saved.localStorage;
      globalThis.fetch = saved.fetch;
    },
  };
}

async function waitFor(check: () => boolean, timeoutMs: number): Promise<number> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out after ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return Date.now() - started;
}

test('the firebase/firestore stand-in reads, writes and listens through the route handler', async () => {
  const fs = await import('../../src/lib/demo/shims/firebase-firestore.ts');
  const { initializeApp, getApps } = await import('../../src/lib/demo/shims/firebase-app.ts');
  const db = seededDb();
  const env = installBrowser(db);
  try {
    // No env: the app and Firestore come up without throwing.
    const app = getApps().length ? getApps()[0] : initializeApp({ apiKey: undefined as unknown as string });
    const store = fs.getFirestore(app);

    const mine = await fs.getDocs(fs.query(fs.collection(store, 'orders'), fs.where('userId', '==', 'verified-kju-main'), fs.orderBy('timestamp', 'desc'), fs.limit(3)));
    const expected = await db.collection('orders').where('userId', '==', 'verified-kju-main').orderBy('timestamp', 'desc').limit(3).get();
    assert.deepEqual(mine.docs.map((d) => d.id), expected.docs.map((d) => d.id));
    const first = mine.docs[0].data();
    assert.ok(first.timestamp instanceof ClientTimestamp);
    assert.equal(first.timestamp.toMillis(), (expected.docs[0].data().timestamp as Timestamp).toMillis());

    const ready = await fs.getDoc(fs.doc(store, 'orders', 'order-sana-ready'));
    assert.equal(ready.exists(), true);
    assert.equal(ready.get('status'), 'printed');
    assert.equal((await fs.getDoc(fs.doc(store, 'orders/none'))).exists(), false);

    // Writes, including the field values the repo uses.
    const added = await fs.addDoc(fs.collection(store, 'announcements'), { title: 'Sample', createdAt: fs.serverTimestamp() });
    const stored = (await db.doc(added.path).get()).data()!;
    assert.ok(stored.createdAt instanceof Timestamp);
    await fs.updateDoc(fs.doc(store, 'things/a'), { tag: 'violet', updatedAt: fs.serverTimestamp() });
    await fs.setDoc(fs.doc(store, 'things/b'), { extra: 1 }, { merge: true });
    const batch = fs.writeBatch(store);
    batch.update(fs.doc(store, 'things/c'), { n: 70 });
    batch.delete(fs.doc(store, 'things/d'));
    await batch.commit();
    await fs.deleteDoc(fs.doc(store, 'things/e'));
    assert.equal((await db.doc('things/a').get()).data()?.tag, 'violet');
    assert.equal((await db.doc('things/b').get()).data()?.tag, 'blue');
    assert.equal((await db.doc('things/c').get()).data()?.n, 70);
    assert.equal((await db.doc('things/d').get()).exists, false);
    assert.equal((await db.doc('things/e').get()).exists, false);

    // Refusals and things outside the demo.
    await assert.rejects(fs.getDoc(fs.doc(store, '_rate_limits/ip-1')), (error: { code?: string }) => error.code === 'permission-denied');
    await assert.rejects(fs.runTransaction(), /Not in the demo: runTransaction/);
    assert.throws(() => fs.collectionGroup(), /Not in the demo: collectionGroup/);

    // onSnapshot: first answer fast, one request for all listeners, then only on change.
    const statuses: string[] = [];
    const lists: number[] = [];
    const before = env.requests();
    const stopDoc = fs.onSnapshot(fs.doc(store, 'orders', 'order-sana-printing'), (snap) => statuses.push(snap.data()?.status));
    const stopList = fs.onSnapshot(fs.query(fs.collection(store, 'orders'), fs.where('userId', '==', 'verified-kju-airport')), (snap) => lists.push(snap.size));
    try {
      await waitFor(() => statuses.length === 1 && lists.length === 1, 1000);
      assert.equal(env.requests() - before, 1);
      assert.deepEqual(statuses, ['printing']);

      // A status written on the server shows within 3 s.
      await db.doc('orders/order-sana-printing').update({ status: 'printed' });
      const took = await waitFor(() => statuses.length === 2, 3000);
      assert.ok(took <= 3000);
      assert.deepEqual(statuses, ['printing', 'printed']);
      assert.equal(lists.length, 1, 'the other list did not change, so it must not be called again');
      assert.ok(lists[0] >= 1);

      // A write from this tab nudges listeners straight away.
      await fs.updateDoc(fs.doc(store, 'orders/order-sana-printing'), { status: 'collected' });
      await waitFor(() => statuses.length === 3, 1000);
      assert.equal(statuses[2], 'collected');
    } finally {
      stopDoc();
      stopList();
    }
  } finally {
    env.restore();
  }
});

test('the firebase/auth stand-in follows swoop_demo_session and bridges demo:<uid> tokens', async () => {
  const { getAuth, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signOut } = await import('../../src/lib/demo/shims/firebase-auth.ts');
  const { encodeDemoSession, DEMO_SESSION_COOKIE } = await import('../../src/lib/demo/contract.ts');
  const env = installBrowser(seededDb());
  storage.clear();
  cookieJar = '';
  try {
    const auth = getAuth();
    // A function, so TypeScript does not narrow the getter after the first check.
    const current = () => auth.currentUser;
    await auth.authStateReady();
    assert.equal(current(), null);

    cookieJar = `other=1; ${DEMO_SESSION_COOKIE}=${encodeDemoSession({ uid: 'verified-kju-main' })}`;
    assert.equal(current(), null, 'not bridged yet');
    await assert.rejects(signInWithCustomToken(auth, 'demo:verified-kju-airport'), (error: { code?: string }) => error.code === 'auth/invalid-custom-token');
    await assert.rejects(signInWithCustomToken(auth, 'eyJhbGciOi.real.token'), (error: { code?: string }) => error.code === 'auth/invalid-custom-token');

    const credential = await signInWithCustomToken(auth, 'demo:verified-kju-main');
    assert.equal(credential.user.uid, 'verified-kju-main');
    assert.equal(current()?.uid, 'verified-kju-main');
    assert.deepEqual(current()?.providerData, []);
    assert.equal(await current()?.getIdToken(), 'demo:verified-kju-main');
    assert.equal(current()?.displayName, 'Sana');

    const seen: Array<string | null> = [];
    const stop = onAuthStateChanged(auth, (user) => seen.push(user?.uid ?? null));
    try {
      await waitFor(() => seen.length === 1, 500);
      assert.deepEqual(seen, ['verified-kju-main']);
      // Signing out of the demo (cookie gone) reaches listeners.
      cookieJar = 'other=1';
      await waitFor(() => seen.length === 2, 2000);
      assert.deepEqual(seen, ['verified-kju-main', null]);
      // Back in as the same student: still bridged.
      cookieJar = `${DEMO_SESSION_COOKIE}=${encodeDemoSession({ uid: 'verified-kju-main' })}`;
      await waitFor(() => seen.length === 3, 2000);
      await signOut(auth);
      assert.equal(current(), null);
      assert.deepEqual(seen, ['verified-kju-main', null, 'verified-kju-main', null]);
    } finally {
      stop();
    }

    await assert.rejects(signInWithEmailAndPassword(auth, 'owner@shop.test', 'x'), /Not in the demo: signInWithEmailAndPassword/);
  } finally {
    cookieJar = '';
    storage.clear();
    env.restore();
  }
});

test('one refused read in a batch fails alone', async () => {
  const db = seededDb();
  const response = await run(db, { op: 'read', targets: [{ kind: 'doc', path: '_rate_limits/ip-1' }, { kind: 'doc', path: 'things/a' }, { kind: 'doc', path: 'things' }] });
  assert.equal(response.status, 200);
  const [refused, good, bad] = (response.body as { results: WireReadResult[] }).results;
  assert.ok(!refused.ok && refused.error.code === 'permission-denied');
  assert.ok(good.ok && good.kind === 'doc' && good.doc.data?.tag === 'red');
  assert.ok(!bad.ok && bad.error.code === 'invalid-argument');
});

test('a refused listener gets its error and the others keep listening', async () => {
  const fs = await import('../../src/lib/demo/shims/firebase-firestore.ts');
  const env = installBrowser(seededDb());
  const errors: string[] = [];
  const seen: string[] = [];
  const store = fs.getFirestore();
  const stopBad = fs.onSnapshot(fs.doc(store, '_rate_limits/ip-1'), () => seen.push('bad'), (error) => errors.push(error.code));
  const stopGood = fs.onSnapshot(fs.doc(store, 'things/a'), (snap) => seen.push(snap.get('tag')));
  try {
    await waitFor(() => errors.length === 1 && seen.length === 1, 1000);
    assert.deepEqual(errors, ['permission-denied']);
    assert.deepEqual(seen, ['red']);
  } finally {
    stopBad();
    stopGood();
    env.restore();
  }
});
