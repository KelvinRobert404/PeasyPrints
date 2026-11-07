import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { getCampus, getCollege } from '../../src/lib/campus/catalog.ts';
import { CAMPUS_COLLECTIONS } from '../../src/lib/campus/constants.ts';
import { validateCourse } from '../../src/lib/campus/courses.ts';
import { stillAvailableDue } from '../../src/lib/campus/listingRules.ts';
import {
  FIXTURE_EMAIL_DOMAIN,
  FIXTURE_PEOPLE,
  FIXTURE_SHOPS,
  SAMPLE_DEAL_CREATOR,
  buildCampusFixtures,
} from '../../src/lib/campus/fixtures/index.ts';
import { FakeFirestore } from '../../src/lib/firebase/fakeAdmin.ts';
import { SHOPS_COLLECTION, seedFakeDb } from '../../src/lib/firebase/fakeSeed.ts';
import { FIXTURE_USER_IDS } from '../../src/lib/firebase/fixtureMode.ts';

const NOW = new Date('2026-11-07T06:30:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const fixtures = buildCampusFixtures(NOW);

type Doc = { id: string; data: object };

const allDocs: [string, Doc[]][] = Object.entries(fixtures);

function ms(value: unknown): number {
  assert.ok(value instanceof Timestamp, 'expected a Timestamp');
  return value.toMillis();
}

function daysAgo(value: unknown): number {
  return (NOW.getTime() - ms(value)) / DAY_MS;
}

/** Every string inside a value, with the key it sits under. */
function strings(value: unknown, key = ''): [string, string][] {
  if (typeof value === 'string') return [[key, value]];
  if (Array.isArray(value)) return value.flatMap((item) => strings(item, key));
  if (value && typeof value === 'object' && !(value instanceof Timestamp)) {
    return Object.entries(value).flatMap(([childKey, child]) => strings(child, childKey));
  }
  return [];
}

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value && typeof value === 'object' && !(value instanceof Timestamp)) return Object.values(value).some(hasUndefined);
  return false;
}

// Machine values, not copy: ids, codes and enums.
const NON_COPY_KEYS = new Set(['serial', 'collegeCode', 'code', 'bloodGroup', 'path', 'contentType', 'href']);
// Short forms students actually write.
const ACRONYMS = new Set(['KJU', 'PG', 'BHK', 'ID', 'USB', 'HDMI', 'LG', 'CCTV', 'CMR', 'BDS']);

test('every collection has fixtures and no doc holds undefined', () => {
  for (const [name, docs] of allDocs) {
    assert.ok(docs.length > 0, `${name} is empty`);
    const ids = docs.map((doc) => doc.id);
    assert.equal(new Set(ids).size, ids.length, `${name} has duplicate ids`);
    for (const doc of docs) assert.equal(hasUndefined(doc.data), false, `${name}/${doc.id} has undefined`);
  }
});

test('catalog ids exist: colleges, campuses, landmarks, courses, shops', () => {
  const places = [
    ...fixtures.market.map((doc) => doc.data.place),
    ...fixtures.housing.map((doc) => doc.data.place),
    ...fixtures.deals.map((doc) => doc.data.place),
    ...fixtures.lostFound.map((doc) => doc.data.place),
    ...fixtures.games.map((doc) => doc.data.place),
  ];
  for (const place of places) {
    if (!place) continue;
    const campus = getCampus(place.campusId);
    assert.ok(campus, `unknown campus ${place.campusId}`);
    if (place.landmarkId) assert.ok(campus.landmarks.some((landmark) => landmark.id === place.landmarkId), `unknown landmark ${place.landmarkId}`);
    else assert.equal(place.lat, null);
    assert.ok(place.roughDistanceM === null || place.roughDistanceM % 50 === 0, 'distance is privacy rounded');
  }

  for (const doc of [...fixtures.market, ...fixtures.housing]) {
    const campus = getCampus(doc.data.campusId);
    assert.ok(campus && campus.collegeId === doc.data.collegeId, `${doc.id} campus belongs to its college`);
    assert.ok(getCollege(doc.data.collegeId));
    if (doc.data.place) assert.equal(doc.data.place.campusId, doc.data.campusId);
  }
  const campusIds = [
    ...fixtures.deals,
    ...fixtures.lostFound,
    ...fixtures.bloodRequests,
    ...fixtures.bloodDonors,
    ...fixtures.games,
  ].map((doc) => doc.data.campusId);
  for (const id of campusIds) assert.ok(getCampus(id), `unknown campus ${id}`);

  for (const { data } of fixtures.memberships) {
    const campus = getCampus(data.campusId);
    assert.ok(campus && campus.collegeId === data.collegeId);
    assert.equal(data.campusLabel, campus.label);
    if (data.course) assert.equal(validateCourse(data.course).ok, true, `${data.userId} course`);
  }

  assert.equal(FIXTURE_SHOPS.length, 3);
  for (const shop of FIXTURE_SHOPS) assert.ok(getCampus(shop.collegeId), `shop ${shop.id} campus`);
});

test('people: every author and actor is a known person, girls posts by girls', () => {
  const authors = [
    ...fixtures.market.map((doc) => doc.data.authorId),
    ...fixtures.housing.map((doc) => doc.data.authorId),
    ...fixtures.lostFound.map((doc) => doc.data.authorId),
    ...fixtures.bloodRequests.map((doc) => doc.data.authorId),
    ...fixtures.games.flatMap((doc) => [doc.data.authorId, ...doc.data.playerIds]),
    ...fixtures.contactRequests.flatMap((doc) => [doc.data.buyerId, doc.data.sellerId]),
  ];
  for (const id of authors) {
    assert.ok(FIXTURE_PEOPLE[id], `unknown person ${id}`);
    assert.notEqual(id, 'new-user');
    assert.notEqual(id, 'unverified-kju');
    assert.notEqual(id, 'pending-id-card');
  }
  for (const doc of [...fixtures.market, ...fixtures.housing]) {
    if (doc.data.audience === 'girls') {
      assert.equal(FIXTURE_PEOPLE[doc.data.authorId].girls, true, `${doc.id} girls author`);
      assert.equal(doc.data.promotionEligible, false);
    }
  }
  for (const doc of fixtures.market) assert.equal(doc.data.sellerDisplayName, FIXTURE_PEOPLE[doc.data.authorId].displayName);
});

test('required fields are set', () => {
  for (const doc of [...fixtures.market, ...fixtures.housing]) {
    const data = doc.data;
    assert.ok(data.title.trim() && data.description.trim(), `${doc.id} text`);
    assert.match(data.serial, /^KJU-[MH]\d{4}$/);
    assert.deepEqual(data.images, []);
    assert.ok(ms(data.createdAt) <= NOW.getTime(), `${doc.id} createdAt in the past`);
    ms(data.updatedAt);
    ms(data.availabilityExpiresAt);
  }
  const serials = [...fixtures.market, ...fixtures.housing].map((doc) => doc.data.serial);
  assert.equal(new Set(serials).size, serials.length, 'serials are unique');
  for (const doc of fixtures.market) {
    assert.equal(doc.data.kind, doc.data.details.kind);
    if (doc.data.priceTerms === 'free' || doc.data.priceTerms === 'swap') assert.equal(doc.data.price, null);
    else if (doc.data.kind !== 'wanted') assert.ok((doc.data.price ?? 0) > 0, `${doc.id} price`);
  }
  for (const doc of fixtures.housing) assert.ok(doc.data.rentPp > 0 && doc.data.place.label);
  for (const doc of fixtures.deals) assert.ok(doc.data.title && doc.data.offer && doc.data.merchantName);
  for (const doc of fixtures.notifications) assert.ok(doc.data.title && FIXTURE_PEOPLE[doc.data.userId]);
});

test('copy: no ALL CAPS, titles under 10 words, no rupee sign', () => {
  for (const [name, docs] of allDocs) {
    for (const doc of docs) {
      for (const [key, text] of strings(doc.data)) {
        if (NON_COPY_KEYS.has(key)) continue;
        assert.ok(!text.includes('₹'), `${name}/${doc.id} uses the rupee sign`);
        for (const word of text.match(/[A-Za-z0-9]+/g) ?? []) {
          const letters = word.replace(/[0-9]/g, '');
          if (letters.length >= 2 && letters === letters.toUpperCase() && !ACRONYMS.has(word) && !ACRONYMS.has(letters)) {
            assert.fail(`${name}/${doc.id}.${key} shouts: "${word}"`);
          }
        }
      }
    }
  }
  const titles = [...fixtures.market, ...fixtures.housing, ...fixtures.deals, ...fixtures.lostFound, ...fixtures.games, ...fixtures.notifications].map(
    (doc) => doc.data.title,
  );
  for (const title of titles) {
    assert.ok(title.split(/\s+/).length < 10, `title too long: ${title}`);
    assert.equal(title[0], title[0].toUpperCase(), `title starts with a capital: ${title}`);
  }
});

test('no stock URLs: images are empty or campus media', () => {
  for (const [name, docs] of allDocs) {
    for (const doc of docs) {
      for (const [key, text] of strings(doc.data)) {
        assert.doesNotMatch(text, /https?:\/\/|unsplash|pexels|pixabay|shutterstock|istock/i, `${name}/${doc.id}.${key}`);
      }
      const images = (doc.data as { images?: unknown }).images;
      if (images !== undefined) {
        assert.ok(Array.isArray(images));
        for (const url of images) assert.match(String(url), /^\/api\/campus\/media\/[^/?]+$/);
      }
    }
  }
  for (const shop of FIXTURE_SHOPS) assert.equal(shop.logoUrl, undefined);
});

test('core: memberships per fixture user, college config, shops', () => {
  const byId = new Map(fixtures.memberships.map((doc) => [doc.id, doc.data]));
  for (const id of FIXTURE_USER_IDS) {
    if (id === 'new-user') assert.equal(byId.has(id), false, 'new-user has no membership');
    else assert.ok(byId.get(id), `${id} membership`);
  }
  assert.equal(byId.get('pending-id-card')!.studentVerification.status, 'pending');
  assert.equal(byId.get('pending-id-card')!.studentVerification.method, 'id_card');
  assert.equal(byId.get('unverified-kju')!.studentVerification.status, 'unverified');
  assert.equal(byId.get('verified-kju-main')!.campusId, 'kju-main');
  assert.equal(byId.get('verified-kju-airport')!.campusId, 'kju-airport-road');
  assert.equal(byId.get('girls-approved')!.girlsSpaceVerification.status, 'approved');
  for (const id of ['verified-kju-main', 'verified-kju-airport', 'girls-approved', 'admin']) {
    const member = byId.get(id)!;
    assert.equal(member.studentVerification.status, 'approved');
    assert.ok(ms(member.studentVerification.expiresAt) > NOW.getTime(), `${id} verification active`);
    assert.ok(member.course && member.stay, `${id} course and stay`);
    assert.equal(member.displayName, FIXTURE_PEOPLE[id].displayName);
  }
  const config = fixtures.collegeConfigs.find((doc) => doc.id === 'kju');
  assert.ok(config);
  assert.deepEqual(config.data.emailDomains, [FIXTURE_EMAIL_DOMAIN]);
  assert.equal(FIXTURE_EMAIL_DOMAIN, 'kju.test');
  assert.equal(config.data.marketplaceEnabled && config.data.housingEnabled, true);
});

test('market: kinds, price terms and states the brief asks for', () => {
  const market = fixtures.market.map((doc) => ({ id: doc.id, ...doc.data }));
  const of = (kind: string) => market.filter((item) => item.kind === kind);
  assert.ok(market.length >= 30);
  assert.ok(market.some((item) => item.campusId === 'kju-main'));
  assert.ok(market.some((item) => item.campusId === 'kju-airport-road'));
  assert.ok(of('bundle').length >= 3);

  const vehicles = of('vehicle');
  assert.equal(vehicles.length, 2);
  assert.ok(vehicles.some((item) => /insurance ends/i.test(item.description)));

  const tickets = of('ticket');
  assert.equal(tickets.length, 2);
  const showtimes = tickets.map((item) => (item.details.kind === 'ticket' ? ms(item.details.happensAt) : 0));
  assert.ok(showtimes.some((time) => time < NOW.getTime()) && showtimes.some((time) => time > NOW.getTime()));

  assert.equal(of('pass').length, 2);
  const seats = of('seat');
  assert.equal(seats.length, 3);
  assert.deepEqual(new Set(seats.map((item) => item.genderPref)), new Set(['girls', 'boys', 'anyone']));
  const cabs = of('cab_split');
  assert.equal(cabs.length, 1);
  assert.equal(cabs[0].priceTerms, 'per_person');
  assert.ok(cabs[0].details.kind === 'cab_split' && /airport/i.test(cabs[0].details.to));
  assert.equal(of('wanted').length, 4);

  assert.deepEqual(new Set(market.map((item) => item.priceTerms)), new Set(['fixed', 'negotiable', 'free', 'swap', 'per_person']));
  for (const status of ['reserved', 'sold', 'needs_confirmation']) assert.ok(market.some((item) => item.status === status), status);
  const reserved = market.filter((item) => item.status === 'reserved');
  for (const item of reserved) assert.ok(item.reservedBy && ms(item.reservedUntil) > NOW.getTime());
  assert.ok(market.some((item) => item.previousPrice !== null && item.price !== null && item.price < item.previousPrice && item.priceDroppedAt));
  assert.ok(market.filter((item) => item.audience === 'girls').length >= 4);

  const sanaConfirmed = market
    .filter((item) => item.authorId === 'verified-kju-main' && item.confirmedAt)
    .map((item) => Math.round(daysAgo(item.confirmedAt)));
  assert.ok(sanaConfirmed.includes(4) && sanaConfirmed.includes(1));
});

test('market: the 4-day confirmation is due a nudge, the 1-day one is not', () => {
  const iso = (value: unknown) => new Date(ms(value)).toISOString();
  const nudge = (id: string) => {
    const { data } = fixtures.market.find((doc) => doc.id === id)!;
    return stillAvailableDue(
      {
        status: data.status === 'reserved' ? 'reserved' : 'active',
        availabilityExpiresAt: iso(data.availabilityExpiresAt),
        createdAt: iso(data.createdAt),
        lastConfirmedAt: data.confirmedAt ? iso(data.confirmedAt) : null,
      },
      NOW,
    );
  };
  assert.equal(nudge('mkt-calculator'), true);
  assert.equal(nudge('mkt-study-lamp'), false);
});

test('housing: posters, move-in kinds, beds, distance and states', () => {
  const housing = fixtures.housing.map((doc) => ({ id: doc.id, ...doc.data }));
  assert.ok(housing.length >= 12);
  assert.deepEqual(new Set(housing.map((item) => item.postedAs)), new Set(['tenant', 'leaving', 'owner_contact']));
  assert.ok(housing.some((item) => item.brokerage.charged && (item.brokerage.amount ?? 0) > 0), 'agent with brokerage');
  assert.ok(housing.some((item) => item.roommate?.note && /speak/i.test(item.roommate.note) && /from/i.test(item.roommate.note)));
  assert.ok(housing.some((item) => /we are 2/i.test(item.title)));
  assert.ok(housing.some((item) => /replacement/i.test(item.title)));
  assert.ok(housing.some((item) => /sublet/i.test(item.title)));

  const moveIns = housing.map((item) => (item.moveIn ? (ms(item.moveIn) - NOW.getTime()) / DAY_MS : null));
  assert.ok(moveIns.includes(null), 'move in now');
  assert.ok(moveIns.some((days) => days !== null && days > 0.5 && days < 1.5), 'from tomorrow');
  assert.ok(moveIns.some((days) => days !== null && days > 10), 'a later date or next semester');
  const nextSem = Date.parse('2026-11-15T00:00:00.000+05:30');
  assert.ok(housing.some((item) => item.moveIn && ms(item.moveIn) === nextSem), 'next semester');

  assert.ok(housing.some((item) => item.bedsLeft === 1 && item.status === 'active'));
  assert.ok(housing.some((item) => item.place.roughDistanceM === 1800));
  assert.ok(housing.some((item) => item.status === 'booked'));
  assert.ok(housing.some((item) => /lowered|cut/i.test(`${item.title} ${item.description}`)));
  assert.ok(housing.some((item) => item.status === 'active' && item.confirmedAt && daysAgo(item.confirmedAt) >= 3), 'nudge due');
  assert.ok(housing.filter((item) => item.audience === 'girls').length >= 2);
  for (const item of housing) if (item.audience === 'girls') assert.equal(item.whoCanStay, 'girls');
});

test('utilities: deals, lost and found, blood, games', () => {
  const deals = fixtures.deals.map((doc) => doc.data);
  assert.ok(deals.some((deal) => deal.status === 'active' && deal.validUntil && ms(deal.validUntil) > NOW.getTime()));
  assert.ok(deals.some((deal) => deal.status === 'expired' && deal.validUntil && ms(deal.validUntil) < NOW.getTime()));
  assert.ok(deals.some((deal) => deal.createdBy === SAMPLE_DEAL_CREATOR && /sample/i.test(deal.title)));

  const lost = fixtures.lostFound.map((doc) => doc.data);
  assert.ok(lost.some((item) => item.category === 'id_card' && item.kind === 'found' && item.keptAt));
  assert.ok(lost.some((item) => item.kind === 'lost'));

  assert.ok(fixtures.bloodDonors.length >= 3);
  for (const donor of fixtures.bloodDonors) assert.equal(donor.id, donor.data.userId);
  assert.ok(fixtures.bloodRequests.some((doc) => doc.data.status === 'open'));

  const games = fixtures.games.map((doc) => doc.data);
  assert.ok(games.some((game) => game.status === 'open' && ms(game.startsAt) > NOW.getTime() && game.playerIds.length < game.playersNeeded));
  assert.ok(games.some((game) => game.status === 'full' && game.playerIds.length === game.playersNeeded));
  assert.ok(games.some((game) => game.status === 'done' && ms(game.startsAt) < NOW.getTime()));
});

test('activity points at real listings', () => {
  const ids = new Set([...fixtures.market, ...fixtures.housing].map((doc) => doc.id));
  for (const doc of [...fixtures.contactRequests, ...fixtures.saves, ...fixtures.reports]) assert.ok(ids.has(doc.data.contentId), doc.id);
  for (const doc of fixtures.saves) assert.equal(doc.id, `${doc.data.userId}_${doc.data.contentType}_${doc.data.contentId}`);
});

test('seeding a fresh fake DB fills every collection', async () => {
  const db = new FakeFirestore();
  seedFakeDb(db, NOW);
  for (const name of [...Object.values(CAMPUS_COLLECTIONS), SHOPS_COLLECTION]) {
    const snap = await db.collection(name).get();
    assert.ok(snap.size > 0, `${name} is empty`);
  }
  assert.equal((await db.collection(CAMPUS_COLLECTIONS.market).get()).size, fixtures.market.length);
  assert.equal((await db.collection(CAMPUS_COLLECTIONS.housing).get()).size, fixtures.housing.length);
  assert.equal(
    (await db.collection(CAMPUS_COLLECTIONS.serialReservations).get()).size,
    fixtures.market.length + fixtures.housing.length,
  );
  const metric = await db.collection(CAMPUS_COLLECTIONS.serialMetrics).doc('KJU-M').get();
  assert.equal(metric.data()?.reserved, fixtures.market.length);
  const reservation = await db.collection(CAMPUS_COLLECTIONS.serialReservations).doc('KJU-M0001').get();
  assert.equal(reservation.data()?.contentId, fixtures.market[0].id);

  const listing = await db.collection(CAMPUS_COLLECTIONS.market).doc('mkt-calculator').get();
  assert.ok(listing.data()?.createdAt instanceof Timestamp);
  const kju = await db.collection(CAMPUS_COLLECTIONS.colleges).doc('kju').get();
  assert.deepEqual(kju.data()?.emailDomains, ['kju.test']);
  assert.equal((await db.collection(CAMPUS_COLLECTIONS.memberships).doc('new-user').get()).exists, false);
  assert.equal((await db.collection('users').get()).empty, true);
});
