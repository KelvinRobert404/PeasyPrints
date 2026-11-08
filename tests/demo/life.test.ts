import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import type { NotifyPayload } from '../../src/lib/campus/notify.ts';
import { dedupeKey, nextSlot } from '../../src/lib/campus/notifySlots.ts';
import { FakeBucket, FakeFirestore, fixtureBucketName } from '../../src/lib/firebase/fakeAdmin.ts';
import { seedFakeDb } from '../../src/lib/firebase/fakeSeed.ts';
import {
  APPROVE_AFTER_MS,
  ASK_AFTER_MS,
  CONTACT_REQUESTS,
  PRIVATE_CONTACTS,
  SEAT_AFTER_MS,
  sampleWhatsappNumber,
  setLifeEnqueueForTests,
  tickLife,
} from '../../src/lib/demo/server/life.ts';
import type { LifeEnqueue } from '../../src/lib/demo/server/life.ts';
import type { DemoWorld } from '../../src/lib/demo/server/world.ts';

const SANA = 'verified-kju-main';
const KABIR = 'verified-kju-airport';
/** 11:30 IST: outside quiet hours. */
const T0 = Date.parse('2026-11-09T06:00:00.000Z');
/** 23:30 IST: quiet hours. */
const NIGHT = Date.parse('2026-11-09T18:00:00.000Z');
const SANA_ONLY = { visitorUid: SANA };

type Data = Record<string, unknown>;

interface EnqueueCall {
  userIds: readonly string[];
  payload: NotifyPayload;
  db: unknown;
  now: Date | undefined;
}

let calls: EnqueueCall[] = [];
let failNotify = false;

/** Stands in for notify.ts's enqueue: records the call and writes the queued item at its dedupe id. */
const fakeEnqueue: LifeEnqueue = async (userIds, payload, options = {}) => {
  calls.push({ userIds, payload, db: options.db, now: options.now });
  if (failNotify) throw new Error('notify down');
  const now = options.now ?? new Date();
  const slot = nextSlot(now, { urgent: Boolean(payload.urgent) });
  const db = options.db as unknown as FakeFirestore;
  const targetId = payload.ref ? `${payload.ref.type}/${payload.ref.id}` : null;
  for (const userId of userIds) {
    await db
      .collection('notifications')
      .doc(dedupeKey({ userId, type: payload.kind, targetId, slot }))
      .create({ userId, kind: payload.kind, title: payload.title, createdAt: Timestamp.fromDate(now), deliverAfter: Timestamp.fromDate(slot) });
  }
  return { queued: userIds.length, skipped: 0 };
};

beforeEach(() => {
  calls = [];
  failNotify = false;
  setLifeEnqueueForTests(fakeEnqueue);
});

afterEach(() => {
  setLifeEnqueueForTests(null);
});

function makeWorld(createdAt: number = T0): DemoWorld {
  const db = new FakeFirestore();
  seedFakeDb(db, new Date(createdAt));
  return {
    id: 'life-test',
    bootId: 'boot',
    createdAt,
    db,
    bucket: new FakeBucket(fixtureBucketName()),
    rev: 0,
    changes: new Map(),
    ready: Promise.resolve(),
    lastTickAt: Number.NEGATIVE_INFINITY,
    logPaused: 0,
  };
}

async function read(world: DemoWorld, path: string): Promise<Data | undefined> {
  return (await world.db.doc(path).get()).data();
}

/** Writes a pending ask as POST /api/contact-requests does. */
async function visitorAsks(world: DemoWorld, listingId: string, buyerId: string, atMs: number): Promise<string> {
  const listing = (await read(world, `market_listings/${listingId}`))!;
  const id = `marketplace_${listingId}_${buyerId}`;
  await world.db.collection(CONTACT_REQUESTS).doc(id).set({
    contentType: 'marketplace',
    contentId: listingId,
    serial: listing.serial,
    intent: 'ask',
    title: listing.title,
    audience: listing.audience,
    collegeId: listing.collegeId,
    buyerId,
    buyerDisplayName: 'Sana',
    sellerId: listing.authorId,
    status: 'pending',
    createdAt: Timestamp.fromMillis(atMs),
    updatedAt: Timestamp.fromMillis(atMs),
    expiresAt: Timestamp.fromMillis(atMs + 72 * 3_600_000),
  });
  return id;
}

/** Posts a copy of a seeded listing as `authorId`, created at `atMs`. */
async function visitorPosts(world: DemoWorld, fromId: string, id: string, authorId: string, atMs: number, changes: Data = {}): Promise<Data> {
  const source = (await read(world, `market_listings/${fromId}`))!;
  const data = { ...source, authorId, createdAt: Timestamp.fromMillis(atMs), updatedAt: Timestamp.fromMillis(atMs), ...changes };
  await world.db.collection('market_listings').doc(id).set(data);
  return data;
}

async function asksAbout(world: DemoWorld, listingId: string): Promise<Data[]> {
  const snapshot = await world.db.collection(CONTACT_REQUESTS).where('contentId', '==', listingId).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// ---------------------------------------------------------------------------
// Approvals

test('a sample seller approves the visitor’s ask 10 s after it was made', async () => {
  const world = makeWorld();
  const askedAt = T0 + 5_000;
  const id = await visitorAsks(world, 'mkt-headphones', SANA, askedAt);

  await tickLife(world, askedAt + APPROVE_AFTER_MS - 1, SANA_ONLY);
  assert.equal((await read(world, `${CONTACT_REQUESTS}/${id}`))!.status, 'pending');
  assert.equal(calls.length, 0);

  const now = askedAt + APPROVE_AFTER_MS + 1_500;
  await tickLife(world, now, SANA_ONLY);
  const request = (await read(world, `${CONTACT_REQUESTS}/${id}`))!;
  assert.equal(request.status, 'approved');
  assert.equal((request.decidedAt as Timestamp).toMillis(), now);
  assert.equal((request.updatedAt as Timestamp).toMillis(), now);
  assert.ok(request.demoLife);

  // The reveal has a number to show: a sample one, on the post's contact doc.
  const contact = (await read(world, `${PRIVATE_CONTACTS}/marketplace_mkt-headphones`))!;
  assert.equal(contact.authorId, 'student-farhan');
  assert.equal(contact.whatsappNumber, sampleWhatsappNumber('student-farhan'));
  assert.match(String(contact.whatsappNumber), /^\d{10}$/);

  // The buyer gets an inbox item, through notify.ts's enqueue on this world's db.
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.deepEqual(call.userIds, [SANA]);
  assert.equal(call.db, world.db);
  assert.equal(call.now?.getTime(), now);
  assert.equal(call.payload.kind, 'contact_approved');
  assert.equal(call.payload.title, 'Farhan shared their number');
  assert.equal(call.payload.urgent, true);
  assert.deepEqual(call.payload.ref, { type: 'contact_request', id });
  assert.equal(call.payload.href, '/marketplace/mkt-headphones');
  assert.ok(call.payload.title.split(' ').length < 10);

  // Once only.
  await tickLife(world, now + 60_000, SANA_ONLY);
  assert.equal(calls.length, 1);
});

test('a seller’s own WhatsApp number is kept', async () => {
  const world = makeWorld();
  await world.db.doc(`${PRIVATE_CONTACTS}/marketplace_mkt-headphones`).set({ authorId: 'student-farhan', audience: 'campus', whatsappNumber: '9123456780' });
  const id = await visitorAsks(world, 'mkt-headphones', SANA, T0 + 1_000);
  await tickLife(world, T0 + 20_000, SANA_ONLY);
  assert.equal((await read(world, `${CONTACT_REQUESTS}/${id}`))!.status, 'approved');
  assert.equal((await read(world, `${PRIVATE_CONTACTS}/marketplace_mkt-headphones`))!.whatsappNumber, '9123456780');
});

test('asks to the signed-in visitor, old, expired or for a closed post stay pending', async () => {
  const world = makeWorld();
  // Kabir asks about Sana's calculator while Sana is signed in: she decides herself.
  const own = await visitorAsks(world, 'mkt-calculator', KABIR, T0 + 1_000);
  // Made before the world existed.
  const old = await visitorAsks(world, 'mkt-cycle', SANA, T0 - 1_000);
  // Already past its expiry.
  const expired = await visitorAsks(world, 'mkt-scooter', SANA, T0 + 1_000);
  await world.db.doc(`${CONTACT_REQUESTS}/${expired}`).update({ expiresAt: Timestamp.fromMillis(T0 + 2_000) });
  // The post was sold.
  const sold = await visitorAsks(world, 'mkt-headphones', SANA, T0 + 1_000);
  await world.db.doc('market_listings/mkt-headphones').update({ status: 'sold' });

  await tickLife(world, T0 + 60_000, SANA_ONLY);
  for (const id of [own, old, expired, sold]) assert.equal((await read(world, `${CONTACT_REQUESTS}/${id}`))!.status, 'pending', id);
  assert.equal(calls.length, 0);

  // Signed in as Kabir instead, Sana is a sample seller and answers.
  await tickLife(world, T0 + 62_000, { visitorUid: KABIR });
  assert.equal((await read(world, `${CONTACT_REQUESTS}/${own}`))!.status, 'approved');
});

test('quiet hours do not hold the answer back', async () => {
  const world = makeWorld(NIGHT);
  const id = await visitorAsks(world, 'mkt-headphones', SANA, NIGHT + 1_000);
  const now = NIGHT + 12_000;
  await tickLife(world, now, SANA_ONLY);
  const slot = nextSlot(new Date(now), { urgent: true });
  assert.ok(slot.getTime() > now, 'the test time is in quiet hours');
  const item = (await read(world, `notifications/${dedupeKey({ userId: SANA, type: 'contact_approved', targetId: `contact_request/${id}`, slot })}`))!;
  assert.equal((item.deliverAfter as Timestamp).toMillis(), now);
});

test('a failed notify still approves', async () => {
  const world = makeWorld();
  failNotify = true;
  const id = await visitorAsks(world, 'mkt-headphones', SANA, T0 + 1_000);
  const logged = console.error;
  console.error = () => {};
  try {
    await tickLife(world, T0 + 20_000, SANA_ONLY);
  } finally {
    console.error = logged;
  }
  assert.equal((await read(world, `${CONTACT_REQUESTS}/${id}`))!.status, 'approved');
});

// ---------------------------------------------------------------------------
// Asks on new listings

test('a new listing gets one ask from a sample student of its campus after 45 s', async () => {
  const world = makeWorld();
  const postedAt = T0 + 3_000;
  const listing = await visitorPosts(world, 'mkt-calculator', 'mkt-new-kettle', SANA, postedAt, { title: 'Electric kettle, one litre' });

  await tickLife(world, postedAt + ASK_AFTER_MS - 1, SANA_ONLY);
  assert.equal((await asksAbout(world, 'mkt-new-kettle')).length, 0);

  const now = postedAt + ASK_AFTER_MS + 1_000;
  await tickLife(world, now, SANA_ONLY);
  const asks = await asksAbout(world, 'mkt-new-kettle');
  assert.equal(asks.length, 1);
  const [ask] = asks;
  const buyerId = String(ask.buyerId);
  assert.match(buyerId, /^student-/);
  assert.equal(ask.id, `marketplace_mkt-new-kettle_${buyerId}`);
  assert.equal(ask.sellerId, SANA);
  assert.equal(ask.status, 'pending');
  assert.equal(ask.intent, 'ask');
  assert.equal(ask.serial, listing.serial);
  assert.equal(ask.audience, 'campus');
  assert.equal((ask.createdAt as Timestamp).toMillis(), now);
  assert.ok(ask.demoLife);
  // A student who posts on KJU Main.
  const theirPosts = await world.db.collection('market_listings').where('authorId', '==', buyerId).get();
  assert.ok(theirPosts.docs.some((doc) => doc.get('campusId') === 'kju-main'));
  assert.ok((await read(world, 'market_listings/mkt-new-kettle'))!.demoLife);

  // Sana gets the same Update notifyOwner sends.
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.deepEqual(call.userIds, [SANA]);
  assert.equal(call.db, world.db);
  assert.equal(call.payload.kind, 'contact_request');
  assert.match(call.payload.title, new RegExp(`^[A-Z][a-z]+ asked about ${String(listing.serial)}$`));
  assert.equal(call.payload.body, 'Electric kettle, one litre. Approve to share your number.');
  assert.deepEqual(call.payload.ref, { type: 'contact_request', id: ask.id });

  // Once only, and the sample student's ask waits for Sana to decide.
  await tickLife(world, now + 5 * 60_000, SANA_ONLY);
  assert.equal((await asksAbout(world, 'mkt-new-kettle')).length, 1);
  assert.equal((await asksAbout(world, 'mkt-new-kettle'))[0].status, 'pending');
  assert.equal(calls.length, 1);
});

test('a wanted post gets an offer, Girls’ Space posts get a girl, Airport Road posts an Airport Road student', async () => {
  const world = makeWorld();
  await visitorPosts(world, 'mkt-calculator', 'mkt-new-wanted', SANA, T0 + 1_000, { kind: 'wanted', details: { kind: 'wanted' } });
  await visitorPosts(world, 'mkt-calculator', 'mkt-new-girls', 'girls-approved', T0 + 1_000, { audience: 'girls' });
  await visitorPosts(world, 'mkt-calculator', 'mkt-new-airport', KABIR, T0 + 1_000, { campusId: 'kju-airport-road' });
  await tickLife(world, T0 + 60_000, { visitorUid: null });

  const [offer] = await asksAbout(world, 'mkt-new-wanted');
  assert.equal(offer.intent, 'offer');
  const offerCall = calls.find((call) => call.payload.ref?.id === offer.id)!;
  assert.match(offerCall.payload.title, /has what you asked for$/);

  const [girls] = await asksAbout(world, 'mkt-new-girls');
  assert.ok(['student-tanvi', 'student-priya', 'student-sneha', 'student-isha'].includes(String(girls.buyerId)), String(girls.buyerId));
  assert.equal(calls.find((call) => call.payload.ref?.id === girls.id)!.payload.href, '/girls-space/marketplace/mkt-new-girls');

  const [airport] = await asksAbout(world, 'mkt-new-airport');
  const theirPosts = await world.db.collection('market_listings').where('authorId', '==', airport.buyerId).get();
  assert.ok(theirPosts.docs.some((doc) => doc.get('campusId') === 'kju-airport-road'));
});

test('seeded, seasonal and reserved listings get no ask', async () => {
  const world = makeWorld();
  const seeded = (await world.db.collection(CONTACT_REQUESTS).get()).size;
  await visitorPosts(world, 'mkt-calculator', 'season-may-kettle', SANA, T0 + 1_000);
  await visitorPosts(world, 'mkt-calculator', 'mkt-new-held', SANA, T0 + 1_000, {
    status: 'reserved',
    reservedBy: KABIR,
    reservedUntil: Timestamp.fromMillis(T0 + 86_400_000),
  });
  await tickLife(world, T0 + 120_000, SANA_ONLY);
  const all = await world.db.collection(CONTACT_REQUESTS).get();
  assert.equal(all.size, seeded);
  assert.equal(calls.length, 0);
});

// ---------------------------------------------------------------------------
// Games

test('a sample player takes a seat 20 s after the visitor joins', async () => {
  const world = makeWorld();
  const ref = world.db.doc('campus_games/game-football-open');
  const before = (await ref.get()).data()!;
  const joinedAt = T0 + 4_000;
  // Sana's join, as the games route writes it (she is already in the seeded list).
  await ref.update({ updatedAt: Timestamp.fromMillis(joinedAt) });

  await tickLife(world, joinedAt + SEAT_AFTER_MS - 1, SANA_ONLY);
  assert.deepEqual((await ref.get()).get('playerIds'), before.playerIds);

  const now = joinedAt + SEAT_AFTER_MS + 500;
  await tickLife(world, now, SANA_ONLY);
  const after = (await ref.get()).data()!;
  const players = after.playerIds as string[];
  assert.equal(players.length, (before.playerIds as string[]).length + 1);
  const added = players[players.length - 1];
  assert.match(added, /^student-/);
  assert.ok(!(before.playerIds as string[]).includes(added));
  assert.equal(after.status, 'open');
  assert.equal((after.updatedAt as Timestamp).toMillis(), now);
  assert.ok(after.demoLife);

  // Once only.
  await tickLife(world, now + 120_000, SANA_ONLY);
  assert.equal(((await ref.get()).get('playerIds') as string[]).length, players.length);
});

test('the last seat fills the game; full games, other people’s games and old games are left alone', async () => {
  const world = makeWorld();
  // A game Sana posted, one seat left.
  await world.db.doc('campus_games/game-new-carrom').set({
    authorId: SANA,
    posterDisplayName: 'Sana',
    campusId: 'kju-main',
    sport: 'other',
    level: 'casual',
    status: 'open',
    title: 'Carrom in the common room',
    note: null,
    place: null,
    startsAt: Timestamp.fromMillis(T0 + 86_400_000),
    playersNeeded: 2,
    playerIds: [SANA],
    createdAt: Timestamp.fromMillis(T0 + 1_000),
    updatedAt: Timestamp.fromMillis(T0 + 1_000),
  });
  // Full, though Ananya changed it in this world.
  await world.db.doc('campus_games/game-badminton-full').update({ updatedAt: Timestamp.fromMillis(T0 + 1_000) });
  // Kabir's game, while Sana is signed in.
  await world.db.doc('campus_games/game-chess-airport').update({ updatedAt: Timestamp.fromMillis(T0 + 1_000) });

  await tickLife(world, T0 + 60_000, SANA_ONLY);
  const carrom = (await world.db.doc('campus_games/game-new-carrom').get()).data()!;
  assert.equal((carrom.playerIds as string[]).length, 2);
  assert.equal(carrom.status, 'full');
  assert.deepEqual((await world.db.doc('campus_games/game-badminton-full').get()).get('playerIds'), [
    'girls-approved',
    'student-tanvi',
    'student-priya',
    'student-sneha',
  ]);
  assert.deepEqual((await world.db.doc('campus_games/game-chess-airport').get()).get('playerIds'), [KABIR]);
  // Seeded and untouched: the football game was last changed before the world.
  assert.equal(((await world.db.doc('campus_games/game-football-open').get()).get('playerIds') as string[]).length, 6);
});
