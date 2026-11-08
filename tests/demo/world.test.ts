import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { DEMO_DATE_COOKIE, DEMO_VISITOR_COOKIE } from '../../src/lib/demo/contract.ts';
import type { DemoDateId } from '../../src/lib/demo/contract.ts';
import {
  DEFAULT_WORLD_ID,
  MAX_WORLDS,
  WORLD_TICK_INTERVAL_MS,
  changesSince,
  currentWorld,
  currentWorldId,
  dropWorld,
  getWorld,
  hasWorld,
  resetWorldsForTests,
  setDemoCookieSourceForTests,
  setWorldHooksForTests,
  touchWorld,
  withChangeLogPaused,
} from '../../src/lib/demo/server/world.ts';
import type { DemoWorld } from '../../src/lib/demo/server/world.ts';
import { getAdminBucket, getAdminDb } from '../../src/lib/firebase/admin.ts';
import type { FakeFirestore } from '../../src/lib/firebase/fakeAdmin.ts';

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
const FIXTURE_ENV: Env = { NEXT_PUBLIC_SWOOP_DEMO: undefined, NEXT_PUBLIC_SWOOP_FIXTURES: '1', NODE_ENV: 'development' };

/** Pretends each call runs inside a request with these cookies. */
function useCookies(values: Record<string, string>) {
  setDemoCookieSourceForTests(async () => ({ get: (name: string) => (name in values ? { value: values[name] } : undefined) }));
}

/** Visitor ids are mutable so one test can switch between visitors. */
function useVisitor(state: { id: string; date?: DemoDateId }) {
  setDemoCookieSourceForTests(async () => ({
    get: (name: string) => {
      if (name === DEMO_VISITOR_COOKIE) return { value: state.id };
      if (name === DEMO_DATE_COOKIE && state.date) return { value: state.date };
      return undefined;
    },
  }));
}

function fresh() {
  resetWorldsForTests();
  setDemoCookieSourceForTests(null);
}

const fake = (db: Firestore) => db as unknown as FakeFirestore;

test('writes in world A are invisible in world B', async () => {
  fresh();
  const visitor = { id: 'visitor-a' };
  useVisitor(visitor);
  await withEnv(DEMO_ENV, async () => {
    const db = fake(getAdminDb());
    const bucket = getAdminBucket();
    assert.equal(getAdminDb(), getAdminDb());

    // Both worlds start from the same seed.
    const seeded = (await db.collection('users').get()).size;
    assert.equal(seeded, 5);

    await db.doc('market_items/mine').set({ title: 'Lamp' });
    await db.doc('users/verified-kju-main').update({ displayName: 'Changed in A' });
    await bucket.file('campus_media/a.png').save(Buffer.from('a'));

    visitor.id = 'visitor-b';
    assert.equal((await db.doc('market_items/mine').get()).exists, false);
    assert.notEqual((await db.doc('users/verified-kju-main').get()).get('displayName'), 'Changed in A');
    assert.deepEqual(await bucket.file('campus_media/a.png').exists(), [false]);
    assert.equal((await db.collection('users').get()).size, seeded);

    visitor.id = 'visitor-a';
    assert.equal((await db.doc('market_items/mine').get()).get('title'), 'Lamp');
    assert.deepEqual(await bucket.file('campus_media/a.png').exists(), [true]);
  });

  assert.equal(getWorld('visitor-a').db.store.docs.has('market_items/mine'), true);
  assert.equal(getWorld('visitor-b').db.store.docs.has('market_items/mine'), false);
});

test('transactions run one at a time per world', async () => {
  fresh();
  const visitor = { id: 'tx-a' };
  useVisitor(visitor);
  await withEnv(DEMO_ENV, async () => {
    const db = fake(getAdminDb());
    await db.doc('counters/c').set({ n: 0 });

    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = db.runTransaction(async (transaction) => {
      const snap = await transaction.get(db.doc('counters/c'));
      events.push('first read');
      await gate;
      transaction.update(db.doc('counters/c'), { n: Number(snap.get('n')) + 1 });
      events.push('first write');
    });
    const second = db.runTransaction(async (transaction) => {
      const snap = await transaction.get(db.doc('counters/c'));
      events.push('second read');
      transaction.update(db.doc('counters/c'), { n: Number(snap.get('n')) + 1 });
    });

    // Let both transactions pick world A before the visitor changes.
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ['first read']);

    // Another world's transaction is not held up by world A's queue.
    visitor.id = 'tx-b';
    await db.doc('counters/c').set({ n: 10 });
    await db.runTransaction(async (transaction) => {
      transaction.update(db.doc('counters/c'), { n: 11 });
    });
    events.push('world b done');

    release();
    await Promise.all([first, second]);
    assert.deepEqual(events, ['first read', 'world b done', 'first write', 'second read']);

    visitor.id = 'tx-a';
    assert.equal((await db.doc('counters/c').get()).get('n'), 2);
    visitor.id = 'tx-b';
    assert.equal((await db.doc('counters/c').get()).get('n'), 11);
  });
});

test("with no request context the 'default' world is used with one warning", async (t) => {
  fresh();
  const warn = t.mock.method(console, 'warn', () => undefined);
  // In node there is no Next request, so `await cookies()` is unavailable.
  assert.equal(await currentWorldId(), DEFAULT_WORLD_ID);
  const world = await currentWorld();
  assert.equal(world.id, DEFAULT_WORLD_ID);
  await withEnv(DEMO_ENV, async () => {
    await fake(getAdminDb()).doc('notes/n1').set({ text: 'shared' });
  });
  assert.equal(world.db.store.docs.has('notes/n1'), true);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /default/);

  // A request without a visitor cookie also lands in 'default', without a second warning.
  useCookies({});
  assert.equal(await currentWorldId(), DEFAULT_WORLD_ID);
  useCookies({ [DEMO_VISITOR_COOKIE]: 'bad id!' });
  assert.equal(await currentWorldId(), DEFAULT_WORLD_ID);
  assert.equal(warn.mock.callCount(), 1);
  useCookies({ [DEMO_VISITOR_COOKIE]: 'v_123-abc' });
  assert.equal(await currentWorldId(), 'v_123-abc');
});

test('each world has a bootId, a rev and a change log of doc paths and bucket files', async () => {
  fresh();
  const world = getWorld('log-a');
  const other = getWorld('log-b');
  assert.match(world.bootId, /^[0-9a-f-]{36}$/);
  assert.notEqual(world.bootId, other.bootId);
  // The seed itself is not a change.
  assert.equal(world.rev, 0);
  assert.deepEqual(changesSince(world, 0), { bootId: world.bootId, rev: 0, docs: [], files: [] });

  await world.db.doc('market_items/m1').set({ title: 'Lamp' });
  await world.db.doc('_rate_limits/ip-1').set({ count: 1 });
  await world.db.doc('payment_idempotency/k1').set({ orderId: 'o1' });
  await world.db.doc('market_items/season-may-1').set({ title: 'Move-out bundle' });
  await world.db.doc('housing_posts/season-july-1/photos/p1').set({ url: 'x' });
  assert.equal(world.rev, 1);

  const batch = world.db.batch();
  batch.set(world.db.doc('saves/s1'), { at: 1 });
  batch.delete(world.db.doc('market_items/m1'));
  batch.set(world.db.doc('_rate_limits/ip-2'), { count: 1 });
  await batch.commit();
  assert.equal(world.rev, 2);

  await world.bucket.file('campus_media/u1/a.png').save(Buffer.from('a'));
  assert.equal(world.rev, 3);
  await world.db.doc('saves/s1').update({ at: 2 });
  assert.equal(world.rev, 4);

  assert.deepEqual(changesSince(world, 0), {
    bootId: world.bootId,
    rev: 4,
    docs: ['market_items/m1', 'saves/s1'],
    files: ['campus_media/u1/a.png'],
  });
  assert.deepEqual(changesSince(world, 2).docs, ['saves/s1']);
  assert.deepEqual(changesSince(world, 2).files, ['campus_media/u1/a.png']);
  assert.deepEqual(changesSince(world, 4).docs, []);

  await world.bucket.file('campus_media/u1/a.png').delete();
  assert.deepEqual(changesSince(world, 4).files, ['campus_media/u1/a.png']);

  // Restoring an overlay does not log its writes.
  await withChangeLogPaused(world, () => world.db.doc('saves/s2').set({ at: 3 }));
  assert.equal(world.rev, 5);
  assert.deepEqual(changesSince(world, 5).docs, []);

  // Other worlds keep their own log.
  assert.equal(other.rev, 0);

  // A dropped world comes back fresh with a new bootId.
  assert.equal(dropWorld('log-a'), true);
  assert.equal(hasWorld('log-a'), false);
  const reborn = getWorld('log-a');
  assert.notEqual(reborn.bootId, world.bootId);
  assert.equal(reborn.rev, 0);
  assert.equal((await reborn.db.doc('saves/s1').get()).exists, false);
});

test('tickOrders and tickLife run at most every 2 s per world', async (t) => {
  fresh();
  const calls: string[] = [];
  const restore = setWorldHooksForTests({
    tickOrders: (world, nowMs) => {
      calls.push(`orders ${world.id} ${nowMs}`);
    },
    tickLife: async (world, nowMs) => {
      calls.push(`life ${world.id} ${nowMs}`);
    },
  });
  t.after(restore);

  const a = getWorld('tick-a');
  const b = getWorld('tick-b');
  await touchWorld(a, 10_000);
  await touchWorld(a, 10_500);
  await touchWorld(b, 10_500);
  await touchWorld(a, 10_000 + WORLD_TICK_INTERVAL_MS - 1);
  await touchWorld(a, 10_000 + WORLD_TICK_INTERVAL_MS);
  assert.deepEqual(calls, [
    'orders tick-a 10000',
    'life tick-a 10000',
    'orders tick-b 10500',
    'life tick-b 10500',
    'orders tick-a 12000',
    'life tick-a 12000',
  ]);

  // Through the request path: one access ticks, an access straight after does not.
  calls.length = 0;
  useVisitor({ id: 'tick-c' });
  await currentWorld();
  await currentWorld();
  assert.deepEqual(calls.map((call) => call.split(' ').slice(0, 2).join(' ')), ['orders tick-c', 'life tick-c']);

  // A tick that writes through getAdminDb() reaches the same world without ticking again.
  restore();
  setWorldHooksForTests({
    tickOrders: async (world) => {
      calls.push(`nested ${world.id}`);
      await withEnv(DEMO_ENV, () => fake(getAdminDb()).doc('orders/ticked').set({ by: world.id }));
    },
  });
  calls.length = 0;
  useVisitor({ id: 'tick-d' });
  const d = await currentWorld();
  assert.deepEqual(calls, ['nested tick-d']);
  assert.equal(d.db.store.docs.has('orders/ticked'), true);

  // No tick while the world is inside a transaction, so a read made there never waits on a tick.
  calls.length = 0;
  d.lastTickAt = Number.NEGATIVE_INFINITY;
  await d.db.runTransaction(async () => {
    await touchWorld(d, 50_000);
  });
  assert.deepEqual(calls, []);
  await touchWorld(d, 50_000);
  assert.deepEqual(calls, ['nested tick-d']);

  // A failing hook is logged, never thrown into the request.
  const error = t.mock.method(console, 'error', () => undefined);
  setWorldHooksForTests({
    tickLife: () => {
      throw new Error('boom');
    },
  });
  await touchWorld(getWorld('tick-e'), 1);
  assert.equal(error.mock.callCount(), 1);
});

test('applySeason runs when a world is created, with the visitor date', async (t) => {
  fresh();
  const seasons: Array<[string, DemoDateId]> = [];
  t.after(
    setWorldHooksForTests({
      applySeason: async (world: DemoWorld, dateId: DemoDateId) => {
        await world.db.doc('market_items/season-pack').set({ dateId });
        seasons.push([world.id, dateId]);
      },
    }),
  );

  const visitor: { id: string; date?: DemoDateId } = { id: 'season-a', date: 'may' };
  useVisitor(visitor);
  const a = await currentWorld();
  assert.deepEqual(seasons, [['season-a', 'may']]);
  // The pack is in place before the first request reads, and it is not logged.
  assert.equal(a.db.store.docs.get('market_items/season-pack')?.data.dateId, 'may');
  assert.equal(a.rev, 0);

  await currentWorld();
  visitor.date = 'july';
  await currentWorld();
  assert.equal(seasons.length, 1, 'only on creation');

  visitor.id = 'season-b';
  visitor.date = undefined;
  await currentWorld();
  await getWorld('season-c').ready;
  assert.deepEqual(seasons, [['season-a', 'may'], ['season-b', 'nov'], ['season-c', 'nov']]);
});

test('past 50 worlds the least recently used one is evicted', () => {
  fresh();
  assert.equal(MAX_WORLDS, 50);
  const first = getWorld('lru-0');
  for (let index = 1; index < MAX_WORLDS; index += 1) getWorld(`lru-${index}`);
  assert.equal(hasWorld('lru-0'), true);

  // Using lru-0 again makes lru-1 the oldest.
  assert.equal(getWorld('lru-0'), first);
  getWorld('lru-50');
  assert.equal(hasWorld('lru-1'), false);
  assert.equal(hasWorld('lru-0'), true);
  getWorld('lru-51');
  assert.equal(hasWorld('lru-2'), false);
  assert.equal(hasWorld('lru-50'), true);
  assert.equal(hasWorld('lru-51'), true);
});

test('plain fixture mode keeps one shared store', async () => {
  fresh();
  useVisitor({ id: 'fixture-visitor' });
  await withEnv(FIXTURE_ENV, async () => {
    const db = fake(getAdminDb());
    assert.equal(db, fake(getAdminDb()));
    assert.equal(getAdminBucket(), getAdminBucket());
    // Synchronous seeding works because this database has its own store.
    db.seedDoc('notes/fixture', { text: 'shared' });
    assert.equal((await db.doc('notes/fixture').get()).get('text'), 'shared');
    assert.equal((await db.collection('users').get()).size, 5);
    await getAdminBucket().file('f.txt').save('x');
    assert.deepEqual(await getAdminBucket().file('f.txt').exists(), [true]);
  });
  assert.equal(hasWorld('fixture-visitor'), false);
  assert.equal(hasWorld(DEFAULT_WORLD_ID), false);

  // The demo never sees the fixture store.
  await withEnv(DEMO_ENV, async () => {
    assert.equal((await fake(getAdminDb()).doc('notes/fixture').get()).exists, false);
  });
});
