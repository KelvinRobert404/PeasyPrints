import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPORTS,
  canJoin,
  cancelGame,
  checkStartsAt,
  gameLine,
  isOver,
  joinGame,
  leaveGame,
  reminderPlan,
  reminderSlot,
  slotLabel,
  slotsLeft,
  sportGroup,
  toGameView,
  type GameRecord,
} from '../../src/lib/campus/games.ts';
import { buildGames } from '../../src/lib/campus/fixtures/utilities.ts';

const time = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) });

// 10:00 IST on Sat 7 Nov 2026.
const NOW = new Date('2026-11-07T10:00:00+05:30');

function game(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    authorId: 'host',
    campusId: 'kju-main',
    sport: 'football',
    level: 'casual',
    status: 'open',
    title: 'Football at Sports Arena',
    note: null,
    place: null,
    startsAt: time('2026-11-07T17:30:00+05:30'),
    playersNeeded: 4,
    playerIds: ['host', 'a'],
    posterDisplayName: 'Host',
    createdAt: time('2026-11-06T10:00:00+05:30'),
    updatedAt: time('2026-11-06T10:00:00+05:30'),
    ...overrides,
  };
}

const ctx = (userId: string, now: Date = NOW) => ({ userId, verified: true, now });

test('sports list is the pickup set', () => {
  assert.deepEqual([...SPORTS], ['football', 'cricket', 'badminton', 'basketball', 'volleyball', 'other']);
  assert.equal(sportGroup('chess'), 'other');
  assert.equal(sportGroup('cricket'), 'cricket');
});

test('slotsLeft counts unique players and never goes negative', () => {
  assert.equal(slotsLeft(game()), 2);
  assert.equal(slotsLeft(game({ playerIds: ['host', 'a', 'a'] })), 2);
  assert.equal(slotsLeft(game({ playersNeeded: 2, playerIds: ['host', 'a', 'b', 'c'] })), 0);
});

test('join adds the player and drops the count', () => {
  const result = joinGame(game(), ctx('b'));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.playerIds, ['host', 'a', 'b']);
  assert.equal(result.status, 'open');
  assert.equal(slotsLeft({ playersNeeded: 4, playerIds: result.playerIds }), 1);
});

test('taking the last slot marks the game full', () => {
  const result = joinGame(game({ playerIds: ['host', 'a', 'b'] }), ctx('c'));
  assert.equal(result.ok && result.status, 'full');
});

test("can't join a full game", () => {
  const full = game({ status: 'full', playerIds: ['host', 'a', 'b', 'c'] });
  const result = joinGame(full, ctx('d'));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, 'full');
  // Full by count even if the status was not updated.
  assert.equal(canJoin(game({ playerIds: ['host', 'a', 'b', 'c'] }), ctx('d')).ok, false);
});

test("can't join a started game", () => {
  const started = game({ startsAt: time('2026-11-07T09:30:00+05:30') });
  const result = joinGame(started, ctx('b'));
  assert.equal(!result.ok && result.reason, 'started');
});

test('no double join', () => {
  const result = joinGame(game(), ctx('a'));
  assert.equal(!result.ok && result.reason, 'joined');
  assert.equal(!joinGame(game(), ctx('host')).ok, true);
});

test('unverified students cannot join', () => {
  const result = canJoin(game(), { userId: 'b', verified: false, now: NOW });
  assert.equal(!result.ok && result.reason, 'unverified');
});

test('cancelled or long past games are over and closed to joins', () => {
  assert.equal(isOver(game({ status: 'cancelled' }), NOW), true);
  assert.equal(isOver(game({ startsAt: time('2026-11-07T07:00:00+05:30') }), NOW), true);
  assert.equal(isOver(game(), NOW), false);
  assert.equal(!joinGame(game({ status: 'cancelled' }), ctx('b')).ok, true);
});

test('leave frees a slot and reopens a full game', () => {
  const full = game({ status: 'full', playerIds: ['host', 'a', 'b', 'c'] });
  const result = leaveGame(full, 'b', NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.playerIds, ['host', 'a', 'c']);
  assert.equal(result.status, 'open');
  assert.equal(slotsLeft({ playersNeeded: 4, playerIds: result.playerIds }), 1);
  // The freed slot can be taken again.
  assert.equal(joinGame({ ...full, ...result }, ctx('d')).ok, true);
});

test('leave rules: not in, host, started', () => {
  assert.equal((leaveGame(game(), 'z', NOW) as { reason?: string }).reason, 'not_joined');
  assert.equal((leaveGame(game(), 'host', NOW) as { reason?: string }).reason, 'host_leave');
  const started = game({ startsAt: time('2026-11-07T09:30:00+05:30') });
  assert.equal((leaveGame(started, 'a', NOW) as { reason?: string }).reason, 'started');
});

test('only the host cancels, before the start', () => {
  assert.equal((cancelGame(game(), 'a', NOW) as { reason?: string }).reason, 'not_host');
  const result = cancelGame(game(), 'host', NOW);
  assert.equal(result.ok && result.status, 'cancelled');
  assert.equal((cancelGame(game({ status: 'cancelled' }), 'host', NOW) as { reason?: string }).reason, 'closed');
});

test('slotLabel reads in IST', () => {
  assert.equal(slotLabel('2026-11-07T17:30:00+05:30', NOW), 'Today 5:30 pm');
  assert.equal(slotLabel('2026-11-08T07:00:00+05:30', NOW), 'Tomorrow 7 am');
  assert.equal(slotLabel('2026-11-10T18:00:00+05:30', NOW), 'Tue 6 pm');
  assert.equal(slotLabel('2026-11-21T12:05:00+05:30', NOW), '21 Nov 12:05 pm');
  // 04:30 IST tomorrow is still today in UTC; the label follows IST.
  assert.equal(slotLabel('2026-11-08T04:30:00+05:30', NOW), 'Tomorrow 4:30 am');
});

test('start time must be soon but not too soon', () => {
  assert.equal(checkStartsAt('2026-11-07T10:05:00+05:30', NOW).ok, false);
  assert.equal(checkStartsAt('2026-11-07T17:30:00+05:30', NOW).ok, true);
  assert.equal(checkStartsAt('2026-11-25T17:30:00+05:30', NOW).ok, false);
  assert.equal(checkStartsAt('nope', NOW).ok, false);
});

test('reminder goes at the slot before the start', () => {
  assert.equal(reminderSlot('2026-11-07T17:30:00+05:30').toISOString(), new Date('2026-11-07T12:30:00+05:30').toISOString());
  assert.equal(reminderSlot('2026-11-07T20:30:00+05:30').toISOString(), new Date('2026-11-07T19:30:00+05:30').toISOString());
  assert.equal(reminderSlot('2026-11-08T07:00:00+05:30').toISOString(), new Date('2026-11-07T19:30:00+05:30').toISOString());

  const plan = reminderPlan('2026-11-07T17:30:00+05:30', NOW);
  assert.deepEqual(plan, { at: new Date('2026-11-07T12:30:00+05:30'), urgent: false });

  // The 12:30 slot has passed: remind now.
  const late = new Date('2026-11-07T14:00:00+05:30');
  assert.deepEqual(reminderPlan('2026-11-07T17:30:00+05:30', late), { at: late, urgent: true });
  // Started: nothing to remind.
  assert.equal(reminderPlan('2026-11-07T09:00:00+05:30', NOW), null);
});

test('view hides player ids and reads the row line', () => {
  const view = toGameView('g1', game({ playersNeeded: 10, playerIds: ['host', 'a', 'b', 'c', 'd', 'e', 'f'] }), 'a', NOW);
  assert.equal(gameLine(view), 'Football · Today 5:30 pm · 3 of 10 left');
  assert.equal(view.joined, true);
  assert.equal(view.canJoin, false);
  assert.equal('playerIds' in view, false);
  const full = toGameView('g2', game({ status: 'full', playerIds: ['host', 'a', 'b', 'c'] }), 'z', NOW);
  assert.equal(gameLine(full), 'Football · Today 5:30 pm · Full');
  assert.equal(full.canJoin, false);
});

test('seeded games: open one is joinable, full one is not', () => {
  const now = new Date();
  const games = buildGames(now);
  const open = games.find((item) => item.id === 'game-football-open');
  const full = games.find((item) => item.id === 'game-badminton-full');
  assert.ok(open && full);
  const before = slotsLeft(open.data);
  const joined = joinGame(open.data, ctx('student-new', now));
  assert.equal(joined.ok, true);
  if (joined.ok) assert.equal(slotsLeft({ playersNeeded: open.data.playersNeeded, playerIds: joined.playerIds }), before - 1);
  assert.equal(toGameView(full.id, full.data, 'student-new', now).full, true);
  assert.equal(joinGame(full.data, ctx('student-new', now)).ok, false);
});
