import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NUDGE_TITLE,
  RESERVE_LAPSED_TITLE,
  contactOpen,
  planMaintenance,
  type MaintenanceDoc,
  type MaintenancePlan,
} from '../../src/lib/campus/maintenance.ts';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function at(offsetMs: number): string {
  return new Date(NOW.getTime() + offsetMs).toISOString();
}

/** A Firestore-like Timestamp: only toMillis, like the Admin SDK class. */
function stamp(offsetMs: number) {
  const ms = NOW.getTime() + offsetMs;
  return { toMillis: () => ms };
}

function listing(id: string, fields: Record<string, unknown> = {}): MaintenanceDoc {
  return {
    id,
    data: {
      authorId: 'seller-1',
      campusId: 'kju-main',
      audience: 'campus',
      kind: 'item',
      status: 'active',
      createdAt: at(-1 * DAY),
      confirmedAt: null,
      availabilityExpiresAt: at(6 * DAY),
      hardExpiresAt: null,
      reservedBy: null,
      reservedUntil: null,
      nudgeSentAt: null,
      details: { kind: 'item', condition: 'good', brand: null },
      ...fields,
    },
  };
}

/** Applies a plan's updates to the docs, like the route does. */
function apply(docs: MaintenanceDoc[], plan: MaintenancePlan): MaintenanceDoc[] {
  return docs.map((doc) => {
    const update = plan.updates.find((item) => item.id === doc.id);
    return update ? { id: doc.id, data: { ...doc.data, ...update.data } } : doc;
  });
}

test('a lapsed reserve goes live again and tells the seller', () => {
  const doc = listing('m-reserved', { status: 'reserved', reservedBy: 'buyer-1', reservedUntil: at(-1 * HOUR) });
  const plan = planMaintenance({ market: [doc] }, NOW);
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.updates[0], {
    collection: 'market',
    id: 'm-reserved',
    data: { status: 'active', reservedUntil: null, reservedBy: null, updatedAt: NOW },
  });
  assert.equal(plan.counts.reservesReleased, 1);
  assert.equal(plan.notifications.length, 1);
  const [notice] = plan.notifications;
  assert.equal(notice.userId, 'seller-1');
  assert.equal(notice.kind, 'reserve_lapsed');
  assert.equal(notice.title, RESERVE_LAPSED_TITLE);
  assert.equal(notice.href, '/marketplace/m-reserved');
  assert.deepEqual(notice.ref, { type: 'market_listing', id: 'm-reserved' });
  assert.equal(notice.campusId, 'kju-main');
});

test('a reserve still holding is left alone', () => {
  const doc = listing('m-held', { status: 'reserved', reservedBy: 'buyer-1', reservedUntil: at(2 * HOUR) });
  const plan = planMaintenance({ market: [doc] }, NOW);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.notifications, []);
});

test('a lapsed reserve past its availability needs confirmation', () => {
  const doc = listing('m-stale', { status: 'reserved', reservedUntil: at(-1 * HOUR), availabilityExpiresAt: at(-2 * HOUR) });
  const plan = planMaintenance({ market: [doc] }, NOW);
  assert.equal(plan.updates[0].data.status, 'needs_confirmation');
  assert.equal(plan.counts.needsConfirmation, 1);
  assert.equal(plan.notifications[0].kind, 'reserve_lapsed');
});

test('tickets, seats and cab splits expire past their end', () => {
  const ticket = listing('m-ticket', { kind: 'ticket', hardExpiresAt: stamp(-1 * HOUR), details: { kind: 'ticket', happensAt: at(-1 * HOUR) } });
  // Stored without hardExpiresAt: the end comes from the details.
  const seat = listing('m-seat', { kind: 'seat', details: { kind: 'seat', startsAt: at(-3 * HOUR), endsAt: at(-1 * HOUR) } });
  const cab = listing('m-cab', { kind: 'cab_split', status: 'reserved', reservedUntil: at(-5 * HOUR), details: { kind: 'cab_split', leavesAt: at(-1) } });
  const future = listing('m-ticket-later', { kind: 'ticket', hardExpiresAt: at(2 * HOUR), details: { kind: 'ticket', happensAt: at(2 * HOUR) } });
  const plan = planMaintenance({ market: [ticket, seat, cab, future] }, NOW);
  const status = Object.fromEntries(plan.updates.map((update) => [update.id, update.data.status]));
  assert.deepEqual(status, { 'm-ticket': 'expired', 'm-seat': 'expired', 'm-cab': 'expired' });
  assert.equal(plan.counts.listingsExpired, 3);
  // An ended post gets no 'open again' notice.
  assert.deepEqual(plan.notifications, []);
});

test('an expiry exactly at now counts as ended', () => {
  const ticket = listing('m-ticket', { kind: 'ticket', hardExpiresAt: at(0), details: { kind: 'ticket', happensAt: at(0) } });
  assert.equal(planMaintenance({ market: [ticket] }, NOW).updates[0].data.status, 'expired');
});

test('a bundle past its available-until day needs confirmation', () => {
  const bundle = listing('m-bundle', { kind: 'bundle', details: { kind: 'bundle', parts: [], splitOk: true, availableUntil: at(-1 * HOUR) } });
  const window = listing('m-window', { availabilityExpiresAt: at(-1) });
  const plan = planMaintenance({ market: [bundle, window] }, NOW);
  assert.deepEqual(plan.updates.map((update) => [update.id, update.data.status]), [
    ['m-bundle', 'needs_confirmation'],
    ['m-window', 'needs_confirmation'],
  ]);
  assert.equal(plan.counts.needsConfirmation, 2);
});

test('closed posts and posts already waiting for confirmation are not touched', () => {
  const docs = ['sold', 'booked', 'expired', 'closed', 'removed', 'needs_confirmation'].map((status) =>
    listing(`m-${status}`, { status, availabilityExpiresAt: at(-3 * DAY), createdAt: at(-10 * DAY) }),
  );
  const plan = planMaintenance({ market: docs }, NOW);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.notifications, []);
});

test('the day-3 nudge goes once and never repeats', () => {
  const docs = [listing('m-old', { createdAt: at(-3 * DAY), availabilityExpiresAt: at(4 * DAY) })];
  const first = planMaintenance({ market: docs }, NOW);
  assert.equal(first.counts.nudgesSent, 1);
  assert.deepEqual(first.updates[0].data, { nudgeSentAt: NOW, updatedAt: NOW });
  assert.equal(first.notifications[0].kind, 'listing_nudge');
  assert.equal(first.notifications[0].title, NUDGE_TITLE);

  const after = apply(docs, first);
  for (const later of [HOUR, DAY, 3 * DAY]) {
    const plan = planMaintenance({ market: after }, new Date(NOW.getTime() + later));
    assert.equal(plan.counts.nudgesSent, 0, `no repeat after ${later / HOUR} h`);
    assert.ok(plan.notifications.every((item) => item.kind !== 'listing_nudge'));
  }
});

test('the nudge waits 72 h and re-arms only after a confirmation', () => {
  const young = listing('m-young', { createdAt: at(-71 * HOUR) });
  assert.equal(planMaintenance({ market: [young] }, NOW).counts.nudgesSent, 0);

  // Confirmed a day ago: the confirm cleared nudgeSentAt, so the next nudge is 72 h after it.
  const confirmed = listing('m-confirmed', { createdAt: at(-10 * DAY), confirmedAt: at(-1 * DAY), nudgeSentAt: null });
  assert.equal(planMaintenance({ market: [confirmed] }, NOW).counts.nudgesSent, 0);
  assert.equal(planMaintenance({ market: [confirmed] }, new Date(NOW.getTime() + 2 * DAY)).counts.nudgesSent, 1);
});

test('reserved posts are not nudged, and a lapsed reserve sends one notice per run', () => {
  const reserved = listing('m-r', { status: 'reserved', reservedUntil: at(HOUR), createdAt: at(-5 * DAY) });
  assert.equal(planMaintenance({ market: [reserved] }, NOW).counts.nudgesSent, 0);
  const lapsed = listing('m-l', { status: 'reserved', reservedUntil: at(-HOUR), createdAt: at(-5 * DAY) });
  const plan = planMaintenance({ market: [lapsed] }, NOW);
  assert.deepEqual(plan.notifications.map((item) => item.kind), ['reserve_lapsed']);
  // The next run nudges.
  const next = planMaintenance({ market: apply([lapsed], plan) }, new Date(NOW.getTime() + HOUR));
  assert.deepEqual(next.notifications.map((item) => item.kind), ['listing_nudge']);
});

test('housing uses stillAvailableNudgedAt and the girls space link', () => {
  const doc: MaintenanceDoc = {
    id: 'h-1',
    data: {
      authorId: 'tenant-1',
      campusId: 'kju-main',
      audience: 'girls',
      status: 'active',
      createdAt: stamp(-4 * DAY),
      confirmedAt: null,
      stillAvailableNudgedAt: null,
      availabilityExpiresAt: stamp(3 * DAY),
    },
  };
  const plan = planMaintenance({ housing: [doc] }, NOW);
  assert.deepEqual(plan.updates[0], { collection: 'housing', id: 'h-1', data: { stillAvailableNudgedAt: NOW, updatedAt: NOW } });
  assert.equal(plan.notifications[0].href, '/girls-space/housing/h-1');
  assert.deepEqual(plan.notifications[0].ref, { type: 'housing_listing', id: 'h-1' });
  assert.equal(planMaintenance({ housing: apply([doc], plan) }, new Date(NOW.getTime() + DAY)).counts.nudgesSent, 0);
});

test('games are done 2 h after they start', () => {
  const game = (id: string, startOffset: number, status = 'open'): MaintenanceDoc => ({
    id,
    data: { authorId: 'host', status, startsAt: stamp(startOffset), playerIds: ['host'] },
  });
  const plan = planMaintenance(
    {
      games: [
        game('g-done', -2 * HOUR),
        game('g-full', -3 * HOUR, 'full'),
        game('g-playing', -2 * HOUR + 1),
        game('g-later', 3 * HOUR),
        game('g-cancelled', -5 * HOUR, 'cancelled'),
      ],
    },
    NOW,
  );
  assert.deepEqual(plan.updates, [
    { collection: 'games', id: 'g-done', data: { status: 'done', updatedAt: NOW } },
    { collection: 'games', id: 'g-full', data: { status: 'done', updatedAt: NOW } },
  ]);
  assert.equal(plan.counts.gamesDone, 2);
});

test('lost and found closes after 30 days open', () => {
  const item = (id: string, ageDays: number, status = 'open'): MaintenanceDoc => ({ id, data: { status, createdAt: at(-ageDays * DAY) } });
  const plan = planMaintenance({ lostFound: [item('lf-old', 30), item('lf-new', 29), item('lf-returned', 60, 'returned')] }, NOW);
  assert.deepEqual(plan.updates, [{ collection: 'lostFound', id: 'lf-old', data: { status: 'closed', updatedAt: NOW } }]);
  assert.equal(plan.counts.lostFoundClosed, 1);
});

test('blood requests close past neededBy', () => {
  const request = (id: string, neededBy: string | null, status = 'open'): MaintenanceDoc => ({ id, data: { status, neededBy } });
  const plan = planMaintenance(
    { bloodRequests: [request('b-past', at(-1)), request('b-soon', at(HOUR)), request('b-none', null), request('b-done', at(-DAY), 'fulfilled')] },
    NOW,
  );
  assert.deepEqual(plan.updates, [{ collection: 'bloodRequests', id: 'b-past', data: { status: 'closed', updatedAt: NOW } }]);
  assert.equal(plan.counts.bloodRequestsClosed, 1);
});

test('delivered notifications are deleted after 30 days', () => {
  const note = (id: string, data: Record<string, unknown>): MaintenanceDoc => ({ id, data: { userId: 'u', ...data } });
  const plan = planMaintenance(
    {
      notifications: [
        note('n-old', { createdAt: at(-31 * DAY), deliverAfter: at(-31 * DAY) }),
        note('n-exact', { createdAt: at(-30 * DAY), deliverAfter: stamp(-30 * DAY) }),
        note('n-fresh', { createdAt: at(-29 * DAY), deliverAfter: at(-29 * DAY) }),
        note('n-legacy', { createdAt: at(-40 * DAY) }),
      ],
    },
    NOW,
  );
  assert.deepEqual(plan.deletes, [
    { collection: 'notifications', id: 'n-old' },
    { collection: 'notifications', id: 'n-exact' },
    { collection: 'notifications', id: 'n-legacy' },
  ]);
  assert.equal(plan.counts.notificationsDeleted, 3);
});

test('an up-to-date set of docs plans nothing, and a bad now throws', () => {
  const plan = planMaintenance({ market: [listing('m-fresh')], housing: [], games: [], lostFound: [], bloodRequests: [], notifications: [] }, NOW);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.deletes, []);
  assert.deepEqual(plan.notifications, []);
  assert.throws(() => planMaintenance({}, Number.NaN), RangeError);
});

test('contactOpen follows the status after maintenance', () => {
  assert.equal(contactOpen('market', listing('a').data, NOW), true);
  assert.equal(contactOpen('market', listing('b', { status: 'reserved', reservedUntil: at(HOUR) }).data, NOW), true);
  assert.equal(contactOpen('market', listing('c', { availabilityExpiresAt: at(-1) }).data, NOW), false);
  assert.equal(contactOpen('market', listing('d', { status: 'sold' }).data, NOW), false);
  assert.equal(contactOpen('housing', { status: 'booked' }, NOW), false);
});
