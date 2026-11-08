import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { POST as postDate, GET as getDate } from '../../app/api/demo/date/route.ts';
import { CAMPUS_COLLECTIONS } from '../../src/lib/campus/constants.ts';
import { buildCampusFixtures } from '../../src/lib/campus/fixtures/index.ts';
import { buildSeasonPack } from '../../src/lib/campus/fixtures/seasonal.ts';
import { homeSeasonalSlot, isPeakHousingSeason, seasonalPrompt } from '../../src/lib/campus/season.ts';
import { DEMO_DATE_COOKIE, DEMO_DATE_IDS, DEMO_VISITOR_COOKIE, isSeasonDocId } from '../../src/lib/demo/contract.ts';
import type { DemoDateId } from '../../src/lib/demo/contract.ts';
import { demoInstant, rawDemoDateFrom, seasonInstant } from '../../src/lib/demo/season.ts';
import { applySeason, seasonPackFor } from '../../src/lib/demo/server/seasonPack.ts';
import { changesSince, dropWorld, getWorld, resetWorldsForTests, setDemoCookieSourceForTests } from '../../src/lib/demo/server/world.ts';
import type { DemoWorld } from '../../src/lib/demo/server/world.ts';

type Env = Record<string, string | undefined>;

async function withEnv<T>(values: Env, run: () => T | Promise<T>): Promise<T> {
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

const DEMO_ON: Env = { NEXT_PUBLIC_SWOOP_DEMO: '1', NODE_ENV: 'development' };
const DEMO_OFF: Env = { NEXT_PUBLIC_SWOOP_DEMO: undefined, NODE_ENV: 'development' };

// A time on an IST calendar date.
const ist = (date: string, time = '12:00') => new Date(`${date}T${time}:00+05:30`);

// ---------------------------------------------------------------------------
// Instants

test('each demo date maps to its instant', () => {
  const now = ist('2026-11-08', '15:45');
  assert.equal(demoInstant('nov', now).getTime(), now.getTime());
  assert.equal(demoInstant('may', now).getTime(), ist('2027-05-20', '15:45').getTime());
  assert.equal(demoInstant('july', now).getTime(), ist('2027-07-10', '15:45').getTime());
});

test('nov keeps today only between 15 Oct and 30 Nov', () => {
  assert.equal(demoInstant('nov', ist('2026-10-15', '00:00')).getTime(), ist('2026-10-15', '00:00').getTime());
  assert.equal(demoInstant('nov', ist('2026-11-30', '23:59')).getTime(), ist('2026-11-30', '23:59').getTime());
  assert.equal(demoInstant('nov', ist('2026-10-14')).getTime(), ist('2026-11-10').getTime());
  assert.equal(demoInstant('nov', ist('2026-12-01')).getTime(), ist('2027-11-10').getTime());
  assert.equal(demoInstant('nov', ist('2027-03-02', '08:30')).getTime(), ist('2027-11-10', '08:30').getTime());
});

test('may and july are the next one, today included, on IST days', () => {
  assert.equal(demoInstant('may', ist('2027-05-20', '09:00')).getTime(), ist('2027-05-20', '09:00').getTime());
  assert.equal(demoInstant('may', ist('2027-05-21')).getTime(), ist('2028-05-20').getTime());
  assert.equal(demoInstant('may', ist('2027-01-03')).getTime(), ist('2027-05-20').getTime());
  assert.equal(demoInstant('july', ist('2027-07-10')).getTime(), ist('2027-07-10').getTime());
  assert.equal(demoInstant('july', ist('2027-07-11')).getTime(), ist('2028-07-10').getTime());
  // 20 May 19:00 UTC is 21 May 00:30 IST, so the next 20 May is a year away.
  assert.equal(demoInstant('may', new Date('2027-05-20T19:00:00Z')).getTime(), ist('2028-05-20', '00:30').getTime());
});

test('season helpers at each demo date', () => {
  const now = ist('2026-11-08');
  const may = demoInstant('may', now);
  const july = demoInstant('july', now);
  const nov = demoInstant('nov', now);
  assert.equal(homeSeasonalSlot(may)?.title, 'Moving out? Sell it as a bundle');
  assert.equal(seasonalPrompt(may), 'moving_out');
  assert.equal(isPeakHousingSeason(may), true);
  assert.equal(homeSeasonalSlot(july)?.title, 'Set up your room for less');
  assert.equal(seasonalPrompt(july), 'set_up_room');
  assert.equal(isPeakHousingSeason(july), true);
  assert.equal(homeSeasonalSlot(nov)?.title, 'Exams soon? Print your notes');
  assert.equal(seasonalPrompt(nov), null);
  assert.equal(isPeakHousingSeason(nov), false);
  // Outside the exam window, 'nov' still lands on an exam day.
  assert.equal(homeSeasonalSlot(demoInstant('nov', ist('2027-02-10')))?.id, 'exams');
});

test('seasonInstant leaves real time alone with demo off', async () => {
  const now = ist('2026-11-08', '10:00');
  await withEnv(DEMO_OFF, () => {
    for (const raw of ['may', 'july', 'nov', null, 'junk']) assert.equal(seasonInstant(raw, now).getTime(), now.getTime());
  });
  await withEnv({ NEXT_PUBLIC_SWOOP_DEMO: '1', NODE_ENV: 'production' }, () => {
    assert.equal(seasonInstant('may', now).getTime(), now.getTime());
  });
});

test('seasonInstant follows the cookie in demo mode', async () => {
  const now = ist('2026-11-08', '10:00');
  await withEnv(DEMO_ON, () => {
    assert.equal(seasonInstant('may', now).getTime(), ist('2027-05-20', '10:00').getTime());
    assert.equal(seasonInstant('july', now).getTime(), ist('2027-07-10', '10:00').getTime());
    assert.equal(seasonInstant(null, now).getTime(), now.getTime());
    assert.equal(seasonInstant('junk', now).getTime(), now.getTime());
  });
});

test('rawDemoDateFrom reads the date cookie', () => {
  assert.equal(rawDemoDateFrom(`a=1; ${DEMO_DATE_COOKIE}=july; b=2`), 'july');
  assert.equal(rawDemoDateFrom(`${DEMO_DATE_COOKIE}=`), null);
  assert.equal(rawDemoDateFrom('a=1'), null);
  assert.equal(rawDemoDateFrom(null), null);
});

// ---------------------------------------------------------------------------
// Packs

test('packs: season ids, unique serials, both campuses, real and demo clocks', () => {
  const now = ist('2026-11-08');
  const base = buildCampusFixtures(now);
  const baseSerials = new Set([...base.market, ...base.housing].map((doc) => doc.data.serial));
  for (const id of ['may', 'july'] as const) {
    const instant = demoInstant(id, now);
    const pack = buildSeasonPack(id, now, instant);
    const all = [...pack.market, ...pack.housing, ...pack.deals];
    assert.ok(all.length > 0);
    for (const doc of all) assert.ok(isSeasonDocId(doc.id), doc.id);
    assert.equal(new Set(all.map((doc) => doc.id)).size, all.length);
    const serials = [...pack.market, ...pack.housing].map((doc) => doc.data.serial);
    assert.equal(new Set(serials).size, serials.length);
    for (const serial of serials) assert.ok(!baseSerials.has(serial), serial);
    for (const doc of [...pack.market, ...pack.housing]) {
      const created = (doc.data.createdAt as Timestamp).toMillis();
      assert.ok(created <= now.getTime() && created > now.getTime() - 7 * 86_400_000, `${doc.id} createdAt follows real now`);
      assert.ok((doc.data.availabilityExpiresAt as Timestamp).toMillis() > now.getTime(), `${doc.id} is still live`);
    }
    const campuses = new Set([...pack.market, ...pack.housing].map((doc) => doc.data.campusId));
    assert.deepEqual([...campuses].sort(), ['kju-airport-road', 'kju-main']);
    for (const doc of pack.housing) {
      const moveIn = doc.data.moveIn as Timestamp | null;
      if (moveIn) assert.ok(moveIn.toMillis() >= instant.getTime() - 86_400_000, `${doc.id} moves in after the demo date`);
    }
    for (const doc of pack.market) {
      if (doc.data.details.kind === 'cab_split') {
        assert.ok((doc.data.details.leavesAt as Timestamp).toMillis() > instant.getTime(), `${doc.id} travels after the demo date`);
      }
    }
  }
});

test('May pack: move-out bundles, summer sublets, cheap furniture', () => {
  const now = ist('2026-11-08');
  const pack = buildSeasonPack('may', now, demoInstant('may', now));
  assert.ok(pack.market.filter((doc) => doc.data.kind === 'bundle').length >= 3);
  assert.ok(pack.market.some((doc) => doc.data.kind === 'item' && (doc.data.price ?? 0) <= 500));
  const sublets = pack.housing.filter((doc) => doc.data.kind === 'sublet');
  assert.ok(sublets.length >= 2);
  assert.ok(sublets.some((doc) => doc.data.campusId === 'kju-airport-road'));
  assert.equal(pack.deals.length, 0);
});

test('July pack: room-wanted posts, new-student deals, set-up-room items', () => {
  const now = ist('2026-11-08');
  const pack = buildSeasonPack('july', now, demoInstant('july', now));
  const wanted = pack.housing.filter((doc) => doc.data.kind === 'roommate' && doc.data.postedAs === 'tenant');
  assert.ok(wanted.length >= 3);
  assert.ok(wanted.some((doc) => doc.data.campusId === 'kju-airport-road'));
  assert.ok(pack.deals.length >= 2);
  assert.deepEqual([...new Set(pack.deals.map((doc) => doc.data.campusId))].sort(), ['kju-airport-road', 'kju-main']);
  assert.ok(pack.market.filter((doc) => doc.data.category === 'hostel_essentials').length >= 4);
});

test('seasonPackFor: nov has no pack', () => {
  assert.equal(seasonPackFor('nov'), null);
  assert.equal(seasonPackFor('may'), 'may');
  assert.equal(seasonPackFor('july'), 'july');
});

// ---------------------------------------------------------------------------
// applySeason on a world

function seasonPaths(world: DemoWorld): string[] {
  return [...world.db.store.docs.keys()].filter((path) => isSeasonDocId(path.split('/').at(-1) ?? '')).sort();
}

test('applySeason swaps packs, keeps own posts and saves, and is idempotent', async () => {
  resetWorldsForTests();
  try {
    const world = getWorld('season-world-a', { dateId: 'nov' });
    await world.ready;
    assert.deepEqual(seasonPaths(world), []);

    const ownPost = `${CAMPUS_COLLECTIONS.market}/my-own-post`;
    const ownSave = `${CAMPUS_COLLECTIONS.saves}/verified-kju-main_marketplace_season-may-cooler`;
    await world.db.doc(ownPost).set({ title: 'Mine', authorId: 'verified-kju-main' });
    await world.db.doc(ownSave).set({ userId: 'verified-kju-main', contentType: 'marketplace', contentId: 'season-may-cooler' });
    const rev = world.rev;

    applySeason(world, 'may');
    const may = seasonPaths(world);
    assert.ok(may.length > 0);
    assert.ok(may.every((path) => path.includes('/season-may-')));
    assert.ok(may.includes(`${CAMPUS_COLLECTIONS.market}/season-may-bundle-full-room`));
    assert.ok(may.includes(`${CAMPUS_COLLECTIONS.housing}/season-may-sublet-main`));

    // Edits to a pack doc survive a repeat of the same date.
    await world.db.doc(`${CAMPUS_COLLECTIONS.market}/season-may-cooler`).update({ status: 'reserved' });
    applySeason(world, 'may');
    assert.deepEqual(seasonPaths(world), may);
    assert.equal(world.db.store.docs.get(`${CAMPUS_COLLECTIONS.market}/season-may-cooler`)?.data.status, 'reserved');

    applySeason(world, 'july');
    const july = seasonPaths(world);
    assert.ok(july.every((path) => path.includes('/season-july-')));
    assert.ok(july.includes(`${CAMPUS_COLLECTIONS.deals}/season-july-deal-bedding`));
    assert.ok(july.includes(`${CAMPUS_COLLECTIONS.housing}/season-july-wanted-main`));

    applySeason(world, 'nov');
    assert.deepEqual(seasonPaths(world), []);

    assert.ok(world.db.store.docs.has(ownPost));
    assert.ok(world.db.store.docs.has(ownSave));
    // Pack writes never reach the change log.
    assert.equal(changesSince(world, rev).docs.filter((path) => path.includes('/season-')).length, 0);
  } finally {
    resetWorldsForTests();
  }
});

test('a new world starts with its demo date pack', async () => {
  resetWorldsForTests();
  try {
    for (const dateId of DEMO_DATE_IDS) {
      const world = getWorld(`season-world-${dateId}`, { dateId: dateId as DemoDateId });
      await world.ready;
      const paths = seasonPaths(world);
      if (dateId === 'nov') assert.deepEqual(paths, []);
      else assert.ok(paths.length > 0 && paths.every((path) => path.includes(`/season-${dateId}-`)));
    }
  } finally {
    resetWorldsForTests();
  }
});

// ---------------------------------------------------------------------------
// Route

function dateRequest(body: unknown, init: { origin?: string } = {}): Request {
  const headers = new Headers({ 'content-type': 'application/json', host: 'localhost:3019' });
  if (init.origin) headers.set('origin', init.origin);
  return new Request('http://localhost:3019/api/demo/date', { method: 'POST', headers, body: JSON.stringify(body) });
}

test('date route is 404 outside the demo', async () => {
  await withEnv(DEMO_OFF, async () => {
    assert.equal((await postDate(dateRequest({ date: 'may' }))).status, 404);
    assert.equal((await getDate(new Request('http://localhost:3019/api/demo/date'))).status, 404);
  });
});

test('date route sets the cookie and swaps the visitor pack', async () => {
  resetWorldsForTests();
  const visitor = 'season-route-visitor';
  setDemoCookieSourceForTests(async () => ({
    get: (name: string) => (name === DEMO_VISITOR_COOKIE ? { value: visitor } : undefined),
  }));
  try {
    await withEnv(DEMO_ON, async () => {
      assert.equal((await postDate(dateRequest({ date: 'june' }))).status, 400);
      assert.equal((await postDate(dateRequest(null))).status, 400);
      assert.equal((await postDate(dateRequest({ date: 'may' }, { origin: 'https://evil.example' }))).status, 403);

      const world = getWorld(visitor, { dateId: 'nov' });
      await world.ready;
      const ownPost = `${CAMPUS_COLLECTIONS.housing}/my-room`;
      await world.db.doc(ownPost).set({ title: 'My room' });

      const response = await postDate(dateRequest({ date: 'july' }, { origin: 'http://localhost:3019' }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, date: 'july' });
      const cookie = response.headers.get('set-cookie') ?? '';
      assert.match(cookie, new RegExp(`^${DEMO_DATE_COOKIE}=july;`));
      assert.doesNotMatch(cookie, /HttpOnly/i);
      assert.ok(seasonPaths(world).length > 0 && seasonPaths(world).every((path) => path.includes('/season-july-')));
      assert.ok(world.db.store.docs.has(ownPost));

      const read = await getDate(new Request('http://localhost:3019/api/demo/date', { headers: { cookie: `${DEMO_DATE_COOKIE}=may` } }));
      assert.deepEqual(await read.json(), { date: 'may' });
    });
  } finally {
    setDemoCookieSourceForTests(null);
    dropWorld(visitor);
    resetWorldsForTests();
  }
});
