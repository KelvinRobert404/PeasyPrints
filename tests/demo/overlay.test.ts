import assert from 'node:assert/strict';
import test from 'node:test';
import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { DEMO_DATE_COOKIE, DEMO_SESSION_COOKIE, DEMO_VISITOR_COOKIE } from '../../src/lib/demo/contract.ts';
import {
  OverlayError,
  exportChanges,
  importOverlay,
  isOverlayDocPath,
  parseOverlay,
} from '../../src/lib/demo/server/overlay.ts';
import type { DemoOverlay } from '../../src/lib/demo/server/overlay.ts';
import {
  DEFAULT_WORLD_ID,
  changesSince,
  dropWorld,
  getWorld,
  hasWorld,
  resetWorldsForTests,
  setDemoCookieSourceForTests,
  setWorldHooksForTests,
} from '../../src/lib/demo/server/world.ts';
import type { DemoWorld } from '../../src/lib/demo/server/world.ts';
import { FakeDocumentReference } from '../../src/lib/firebase/fakeAdmin.ts';
import { hasOverlayChanges, mergeOverlay } from '../../src/lib/demo/client/persist.ts';
import { GET as getState, POST as postState } from '../../app/api/demo/state/route.ts';
import { POST as postReset } from '../../app/api/demo/reset/route.ts';

type Env = Record<string, string | undefined>;

async function withEnv<T>(values: Env, run: () => Promise<T>): Promise<T> {
  const env = process.env as Env;
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

const DEMO_ENV: Env = { NEXT_PUBLIC_SWOOP_DEMO: '1', NEXT_PUBLIC_SWOOP_FIXTURES: undefined, NODE_ENV: 'development' };
const OFF_ENV: Env = { NEXT_PUBLIC_SWOOP_DEMO: undefined, NEXT_PUBLIC_SWOOP_FIXTURES: '1', NODE_ENV: 'development' };

/** Fresh worlds with no-op hooks, so only the test's own writes are logged. */
function fresh(): () => void {
  resetWorldsForTests();
  setDemoCookieSourceForTests(null);
  return setWorldHooksForTests({ tickOrders: () => {}, tickLife: () => {}, applySeason: () => {} });
}

function useVisitor(id: string) {
  setDemoCookieSourceForTests(async () => ({ get: (name: string) => (name === DEMO_VISITOR_COOKIE ? { value: id } : undefined) }));
}

/** Overlays travel as JSON, to the browser and back. */
function overWire(overlay: DemoOverlay): unknown {
  return JSON.parse(JSON.stringify(overlay));
}

function firstSeededPath(world: DemoWorld, collection: string): string {
  const path = [...world.db.store.docs.keys()].find((key) => key.startsWith(`${collection}/`) && key.split('/').length === 2);
  assert.ok(path, `a seeded ${collection} doc`);
  return path;
}

async function makeChanges(world: DemoWorld): Promise<{ updated: string; deleted: string }> {
  const db = world.db;
  const updated = firstSeededPath(world, 'users');
  const deleted = firstSeededPath(world, 'market_listings');
  await db.doc('campus_saves/sana_lamp').set({
    title: 'Lamp',
    savedAt: Timestamp.fromMillis(1_762_000_000_123),
    where: new GeoPoint(12.97, 77.59),
    listing: db.doc('market_listings/lamp'),
    raw: Buffer.from([1, 2, 3, 250]),
    nested: { tags: ['a', 'b'], count: 2, $type: 'not a tag' },
    nothing: null,
  });
  await db.doc(updated).update({ displayName: 'Changed' });
  await db.doc(deleted).delete();
  await db.doc('games/g1/players/sana').set({ joined: true });
  await world.bucket.file('campus_media/a.png').save(Buffer.from('png bytes'), { contentType: 'image/png' });
  await world.bucket.file('campus_media/gone.txt').save('bye', { contentType: 'text/plain' });
  await world.bucket.file('campus_media/gone.txt').delete();
  return { updated, deleted };
}

test('docs, deletes and bucket files round-trip through export and import', async () => {
  const restore = fresh();
  try {
    const before = getWorld('visitor-a');
    await before.ready;
    const { updated, deleted } = await makeChanges(before);
    const overlay = exportChanges(before, 0);
    assert.equal(overlay.bootId, before.bootId);
    assert.equal(overlay.rev, before.rev);
    assert.deepEqual(overlay.docs.map((doc) => doc.path), ['campus_saves/sana_lamp', updated, deleted, 'games/g1/players/sana']);
    assert.equal(overlay.docs.find((doc) => doc.path === deleted)?.data, null);
    assert.deepEqual(overlay.files, [
      { name: 'campus_media/a.png', base64: Buffer.from('png bytes').toString('base64'), contentType: 'image/png' },
      { name: 'campus_media/gone.txt', base64: null, contentType: '' },
    ]);

    // A server restart: the world comes back from the seed with a new boot.
    dropWorld('visitor-a');
    const after = getWorld('visitor-a');
    await after.ready;
    assert.notEqual(after.bootId, before.bootId);
    assert.equal(after.db.store.docs.has('campus_saves/sana_lamp'), false);
    assert.equal(after.db.store.docs.has(deleted), true);
    await after.bucket.file('campus_media/gone.txt').save('seeded');
    const revBefore = after.rev;

    await importOverlay(after, parseOverlay(overWire(overlay)));

    const saved = after.db.store.docs.get('campus_saves/sana_lamp')?.data;
    assert.ok(saved);
    assert.equal(saved.title, 'Lamp');
    assert.ok(saved.savedAt instanceof Timestamp);
    assert.equal((saved.savedAt as Timestamp).toMillis(), 1_762_000_000_123);
    assert.ok(saved.where instanceof GeoPoint);
    assert.ok((saved.where as GeoPoint).isEqual(new GeoPoint(12.97, 77.59)));
    assert.ok(saved.listing instanceof FakeDocumentReference);
    assert.equal((saved.listing as FakeDocumentReference).path, 'market_listings/lamp');
    assert.deepEqual([...(saved.raw as Uint8Array)], [1, 2, 3, 250]);
    assert.deepEqual(saved.nested, { tags: ['a', 'b'], count: 2, $type: 'not a tag' });
    assert.equal(saved.nothing, null);
    assert.equal(after.db.store.docs.get(updated)?.data.displayName, 'Changed');
    assert.equal(after.db.store.docs.has(deleted), false);
    assert.deepEqual(after.db.store.docs.get('games/g1/players/sana')?.data, { joined: true });

    const [png] = await after.bucket.file('campus_media/a.png').download();
    assert.equal(png.toString(), 'png bytes');
    assert.equal((await after.bucket.file('campus_media/a.png').getMetadata())[0].contentType, 'image/png');
    assert.deepEqual(await after.bucket.file('campus_media/gone.txt').exists(), [false]);

    // Restored data is not a new change, so it is never sent back as one.
    assert.equal(after.rev, revBefore);
    const since = changesSince(after, revBefore);
    assert.deepEqual([since.docs, since.files], [[], []]);

  } finally {
    restore();
  }
});

test('exportChanges sends only what changed after the rev, and leaves out server internals', async () => {
  const restore = fresh();
  try {
    const world = getWorld('visitor-b');
    await world.ready;
    await world.db.doc('saved_listings/one').set({ n: 1 });
    const rev = world.rev;
    await world.db.doc('saved_listings/two').set({ n: 2 });
    await world.db.doc('_health/ping').set({ ok: true });
    await world.db.doc('saved_listings/one').update({ n: 3 });

    const changes = exportChanges(world, rev);
    assert.deepEqual(changes.docs, [
      { path: 'saved_listings/two', data: { n: 2 } },
      { path: 'saved_listings/one', data: { n: 3 } },
    ]);
    assert.equal(changes.rev, world.rev);
    assert.deepEqual(exportChanges(world, world.rev).docs, []);
  } finally {
    restore();
  }
});

test('parseOverlay refuses bad overlays and importOverlay writes nothing on bad data', async () => {
  const restore = fresh();
  try {
    const base = { bootId: 'b1', rev: 1, docs: [], files: [] };
    assert.deepEqual(parseOverlay(base), base);
    for (const bad of [
      null,
      { ...base, bootId: 'has space' },
      { ...base, rev: -1 },
      { ...base, docs: [{ path: '_rate_limits/x', data: {} }] },
      { ...base, docs: [{ path: 'users', data: {} }] },
      { ...base, docs: [{ path: 'users/a', data: [] }] },
      { ...base, files: [{ name: '', base64: 'AA==', contentType: 'a' }] },
      { ...base, files: [{ name: 'a', base64: 5, contentType: 'a' }] },
    ]) {
      assert.throws(() => parseOverlay(bad), OverlayError, JSON.stringify(bad));
    }
    assert.equal(isOverlayDocPath('season-pack/x'), true);
    assert.equal(isOverlayDocPath('market_items/season-may-1'), false);

    const world = getWorld('visitor-c');
    await world.ready;
    const overlay = parseOverlay({
      ...base,
      docs: [
        { path: 'saved_listings/ok', data: { n: 1 } },
        { path: 'saved_listings/bad', data: { when: { $type: 'timestamp', seconds: 'x', nanoseconds: 0 } } },
      ],
    });
    await assert.rejects(importOverlay(world, overlay), OverlayError);
    assert.equal(world.db.store.docs.has('saved_listings/ok'), false);

    const badFile = parseOverlay({ ...base, files: [{ name: 'f', base64: 'not base64!', contentType: 'text/plain' }] });
    await assert.rejects(importOverlay(world, badFile), OverlayError);
  } finally {
    restore();
  }
});

test('mergeOverlay keeps the newest value per path, in change order', () => {
  const base: DemoOverlay = {
    bootId: 'b1',
    rev: 2,
    docs: [
      { path: 'a/1', data: { n: 1 } },
      { path: 'a/2', data: { n: 2 } },
    ],
    files: [{ name: 'f1', base64: 'AA==', contentType: 'text/plain' }],
  };
  const merged = mergeOverlay(base, {
    bootId: 'b1',
    rev: 4,
    docs: [
      { path: 'a/1', data: null },
      { path: 'a/3', data: { n: 3 } },
    ],
    files: [{ name: 'f1', base64: null, contentType: '' }],
  });
  assert.deepEqual(merged, {
    bootId: 'b1',
    rev: 4,
    docs: [
      { path: 'a/2', data: { n: 2 } },
      { path: 'a/1', data: null },
      { path: 'a/3', data: { n: 3 } },
    ],
    files: [{ name: 'f1', base64: null, contentType: '' }],
  });
  // An older change set from the same boot is ignored; a new boot is always taken.
  assert.equal(mergeOverlay(merged, { bootId: 'b1', rev: 3, docs: [{ path: 'a/9', data: {} }], files: [] }), merged);
  assert.equal(mergeOverlay(merged, { bootId: 'b2', rev: 0, docs: [], files: [] }).bootId, 'b2');
  assert.equal(mergeOverlay(null, base).docs.length, 2);
  assert.equal(hasOverlayChanges(null), false);
  assert.equal(hasOverlayChanges({ bootId: 'b', rev: 0, docs: [], files: [] }), false);
  assert.equal(hasOverlayChanges(base), true);
});

test('/api/demo/state pulls changes, says fresh after a restart, and restores an overlay', async () => {
  const restore = fresh();
  try {
    useVisitor('visitor-route');
    await withEnv(DEMO_ENV, async () => {
      const first = (await (await getState(new Request('http://localhost:3019/api/demo/state?since=0'))).json()) as DemoOverlay;
      const world = getWorld('visitor-route');
      assert.equal(first.bootId, world.bootId);

      await world.db.doc('saved_listings/route').set({ title: 'Desk' });
      const pulled = (await (await getState(new Request(`http://localhost:3019/api/demo/state?since=${first.rev}&boot=${first.bootId}`))).json()) as DemoOverlay;
      assert.deepEqual(pulled.docs, [{ path: 'saved_listings/route', data: { title: 'Desk' } }]);

      assert.equal((await getState(new Request('http://localhost:3019/api/demo/state?since=x'))).status, 400);

      dropWorld('visitor-route');
      const stale = (await (await getState(new Request(`http://localhost:3019/api/demo/state?since=${pulled.rev}&boot=${pulled.bootId}`))).json()) as { fresh?: boolean; bootId: string };
      assert.equal(stale.fresh, true);
      assert.notEqual(stale.bootId, pulled.bootId);

      const post = await postState(new Request('http://localhost:3019/api/demo/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3019' },
        body: JSON.stringify(pulled),
      }));
      assert.equal(post.status, 200);
      const restored = getWorld('visitor-route');
      assert.equal(restored.bootId, stale.bootId);
      assert.deepEqual(restored.db.store.docs.get('saved_listings/route')?.data, { title: 'Desk' });

      const crossSite = await postState(new Request('http://localhost:3019/api/demo/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body: JSON.stringify(pulled),
      }));
      assert.equal(crossSite.status, 403);
      const badBody = await postState(new Request('http://localhost:3019/api/demo/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"bootId":"b","rev":0,"docs":[{"path":"_x/y","data":{}}],"files":[]}',
      }));
      assert.equal(badBody.status, 400);
    });

    await withEnv(OFF_ENV, async () => {
      assert.equal((await getState(new Request('http://localhost:3019/api/demo/state'))).status, 404);
      const post = await postState(new Request('http://localhost:3019/api/demo/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
      assert.equal(post.status, 404);
    });
    await withEnv({ ...DEMO_ENV, NODE_ENV: 'production' }, async () => {
      assert.equal((await getState(new Request('http://localhost:3019/api/demo/state'))).status, 404);
    });
  } finally {
    setDemoCookieSourceForTests(null);
    restore();
  }
});

test('/api/demo/reset drops the world, mints a new visitor and clears session and date', async () => {
  const restore = fresh();
  const resetRequest = (headers: Record<string, string>) =>
    new Request('http://localhost:3019/api/demo/reset', { method: 'POST', headers: { origin: 'http://localhost:3019', ...headers } });
  try {
    await withEnv(DEMO_ENV, async () => {
      getWorld('visitor-reset');
      const response = await postReset(resetRequest({ cookie: `${DEMO_VISITOR_COOKIE}=visitor-reset; ${DEMO_SESSION_COOKIE}=abc; ${DEMO_DATE_COOKIE}=may` }));
      assert.equal(response.status, 200);
      assert.equal(hasWorld('visitor-reset'), false);
      const cookies = response.headers.getSetCookie();
      assert.equal(cookies.length, 3);
      const visitor = cookies.find((cookie) => cookie.startsWith(`${DEMO_VISITOR_COOKIE}=`)) ?? '';
      const id = visitor.slice(DEMO_VISITOR_COOKIE.length + 1).split(';')[0];
      assert.match(id, /^[A-Za-z0-9_-]{1,128}$/);
      assert.notEqual(id, 'visitor-reset');
      assert.match(visitor, /; HttpOnly/);
      assert.match(visitor, /; Path=\//);
      for (const name of [DEMO_SESSION_COOKIE, DEMO_DATE_COOKIE]) {
        assert.ok(cookies.includes(`${name}=; Path=/; Max-Age=0; SameSite=Lax`), name);
      }

      // The shared default world is never dropped.
      getWorld(DEFAULT_WORLD_ID);
      await postReset(resetRequest({ cookie: `${DEMO_VISITOR_COOKIE}=${DEFAULT_WORLD_ID}` }));
      assert.equal(hasWorld(DEFAULT_WORLD_ID), true);

      assert.equal((await postReset(resetRequest({ origin: 'https://evil.example' }))).status, 403);
    });

    await withEnv(OFF_ENV, async () => {
      getWorld('visitor-off');
      const response = await postReset(resetRequest({ cookie: `${DEMO_VISITOR_COOKIE}=visitor-off` }));
      assert.equal(response.status, 404);
      assert.equal(hasWorld('visitor-off'), true);
    });
  } finally {
    restore();
  }
});
