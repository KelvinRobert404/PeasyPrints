// Pickup games: open slots for a game on or near campus. Who may join or
// leave, how many slots are left, when a game is over and the 'Today 5:30 pm'
// label. Pure and dependency free so node tests can import it. Times are IST.
import type { DocTime, ListingPlace, VerifiedPoster } from '@/types/campus';
import type { GameDoc, GameSport, GameStatus } from '@/types/utilities';
import { GAME_SPORT_LABELS } from './constants.ts';
import { SLOT_MINUTES, nextSlot } from './notifySlots.ts';

/** Sports a host can pick. Older stored sports show under 'Other'. */
export const SPORTS = ['football', 'cricket', 'badminton', 'basketball', 'volleyball', 'other'] as const satisfies readonly GameSport[];

export type PickupSport = (typeof SPORTS)[number];

export const MIN_CAPACITY = 2;
export const MAX_CAPACITY = 30;
/** A game counts as over this long after it starts. */
export const GAME_LENGTH_MS = 2 * 60 * 60 * 1000;
/** Hosts pick a start at least this far ahead. */
export const MIN_LEAD_MS = 10 * 60 * 1000;
export const MAX_DAYS_AHEAD = 14;
/** The reminder goes at the last notification slot at least this long before start. */
export const REMINDER_LEAD_MS = 30 * 60 * 1000;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const IST_OFFSET_MS = (5 * 60 + 30) * MINUTE_MS;
const CLOSED: readonly GameStatus[] = ['done', 'cancelled', 'removed'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The stored game (collection CAMPUS_COLLECTIONS.games). playersNeeded is the capacity, host included. */
export type GameRecord = GameDoc;

export type TimeLike = DocTime | Date | string | number;

/** The fields the join and leave rules read. */
export type GameState = Pick<GameDoc, 'authorId' | 'status' | 'playersNeeded' | 'playerIds'> & { startsAt: TimeLike };

export type GameFailure =
  | 'unverified'
  | 'closed'
  | 'started'
  | 'full'
  | 'joined'
  | 'not_joined'
  | 'host_leave'
  | 'not_host';

export type GameCheck = { ok: true } | { ok: false; reason: GameFailure; message: string };

/** The fields a join, leave or cancel writes. */
export type GameTransition =
  | { ok: true; playerIds: string[]; status: GameStatus }
  | { ok: false; reason: GameFailure; message: string };

const MESSAGES: Record<GameFailure, string> = {
  unverified: 'Verify your student account first',
  closed: 'This game is over',
  started: 'This game already started',
  full: 'This game is full',
  joined: 'You are already in',
  not_joined: 'You are not in this game',
  host_leave: 'Hosts cancel the game instead',
  not_host: 'Only the host can cancel',
};

/** HTTP status for each failure. */
export const FAILURE_STATUS: Record<GameFailure, number> = {
  unverified: 403,
  closed: 409,
  started: 409,
  full: 409,
  joined: 409,
  not_joined: 409,
  host_leave: 409,
  not_host: 403,
};

function fail(reason: GameFailure): { ok: false; reason: GameFailure; message: string } {
  return { ok: false, reason, message: MESSAGES[reason] };
}

export function toMillis(value: TimeLike): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return value.toMillis();
}

function players(game: Pick<GameState, 'playerIds'>): string[] {
  return [...new Set((Array.isArray(game.playerIds) ? game.playerIds : []).filter((id) => typeof id === 'string' && id))];
}

export function isPickupSport(value: string): value is PickupSport {
  return (SPORTS as readonly string[]).includes(value);
}

/** The chip a stored sport falls under. */
export function sportGroup(sport: GameSport): PickupSport {
  return isPickupSport(sport) ? sport : 'other';
}

export function sportLabel(sport: GameSport): string {
  return GAME_SPORT_LABELS[sport] ?? 'Game';
}

export function capacityOf(game: Pick<GameState, 'playersNeeded'>): number {
  const value = Math.floor(Number(game.playersNeeded));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function joinedCount(game: Pick<GameState, 'playerIds'>): number {
  return players(game).length;
}

/** Open slots, never negative. */
export function slotsLeft(game: Pick<GameState, 'playersNeeded' | 'playerIds'>): number {
  return Math.max(0, capacityOf(game) - joinedCount(game));
}

export function isFull(game: Pick<GameState, 'playersNeeded' | 'playerIds'>): boolean {
  return slotsLeft(game) === 0;
}

export function hasJoined(game: Pick<GameState, 'playerIds'>, userId: string): boolean {
  return Boolean(userId) && players(game).includes(userId);
}

export function isStarted(game: Pick<GameState, 'startsAt'>, now: Date): boolean {
  return toMillis(game.startsAt) <= now.getTime();
}

/** Cancelled, removed, marked done, or past its start by the game length. */
export function isOver(game: Pick<GameState, 'status' | 'startsAt'>, now: Date): boolean {
  if (CLOSED.includes(game.status)) return true;
  return now.getTime() >= toMillis(game.startsAt) + GAME_LENGTH_MS;
}

export interface JoinContext {
  userId: string;
  verified: boolean;
  now: Date;
}

/** Verified, not in yet, not full, not started, not over. */
export function canJoin(game: GameState, context: JoinContext): GameCheck {
  if (!context.verified || !context.userId) return fail('unverified');
  if (isOver(game, context.now)) return fail('closed');
  if (hasJoined(game, context.userId)) return fail('joined');
  if (isStarted(game, context.now)) return fail('started');
  if (isFull(game)) return fail('full');
  return { ok: true };
}

function statusFor(game: Pick<GameState, 'playersNeeded'>, playerIds: readonly string[]): GameStatus {
  return playerIds.length >= capacityOf(game) ? 'full' : 'open';
}

/** Adds the player. The new status is 'full' once the last slot goes. */
export function joinGame(game: GameState, context: JoinContext): GameTransition {
  const check = canJoin(game, context);
  if (!check.ok) return check;
  const playerIds = [...players(game), context.userId];
  return { ok: true, playerIds, status: statusFor(game, playerIds) };
}

/** Frees the player's slot. The host cannot leave; they cancel. */
export function leaveGame(game: GameState, userId: string, now: Date): GameTransition {
  if (isOver(game, now)) return fail('closed');
  if (!hasJoined(game, userId)) return fail('not_joined');
  if (game.authorId === userId) return fail('host_leave');
  if (isStarted(game, now)) return fail('started');
  const playerIds = players(game).filter((id) => id !== userId);
  return { ok: true, playerIds, status: statusFor(game, playerIds) };
}

/** Host only, before the start. */
export function cancelGame(game: GameState, userId: string, now: Date): GameTransition {
  if (!userId || game.authorId !== userId) return fail('not_host');
  if (isOver(game, now)) return fail('closed');
  if (isStarted(game, now)) return fail('started');
  return { ok: true, playerIds: players(game), status: 'cancelled' };
}

/* Times -------------------------------------------------------------------- */

function istDayIndex(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS);
}

/** '5:30 pm', or '6 pm' on the hour. IST. */
export function timeLabel(startsAt: TimeLike): string {
  const shifted = new Date(toMillis(startsAt) + IST_OFFSET_MS);
  const hours = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();
  const hour = hours % 12 || 12;
  const suffix = hours < 12 ? 'am' : 'pm';
  return minutes === 0 ? `${hour} ${suffix}` : `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** 'Today 5:30 pm', 'Tomorrow 7 am', 'Sat 6 pm', else '21 Nov 6 pm'. IST. */
export function slotLabel(startsAt: TimeLike, now: Date): string {
  const ms = toMillis(startsAt);
  if (!Number.isFinite(ms)) return '';
  const days = istDayIndex(ms) - istDayIndex(now.getTime());
  const shifted = new Date(ms + IST_OFFSET_MS);
  let day: string;
  if (days === 0) day = 'Today';
  else if (days === 1) day = 'Tomorrow';
  else if (days === -1) day = 'Yesterday';
  else if (days > 1 && days < 7) day = WEEKDAYS[shifted.getUTCDay()];
  else day = `${shifted.getUTCDate()} ${MONTHS[shifted.getUTCMonth()]}`;
  return `${day} ${timeLabel(ms)}`;
}

/** Checks a host's start time: at least 10 minutes away and within two weeks. */
export function checkStartsAt(startsAt: TimeLike, now: Date): { ok: true } | { ok: false; message: string } {
  const ms = toMillis(startsAt);
  if (!Number.isFinite(ms)) return { ok: false, message: 'Pick a start time' };
  if (ms < now.getTime() + MIN_LEAD_MS) return { ok: false, message: 'Pick a time at least 10 min away' };
  if (ms > now.getTime() + MAX_DAYS_AHEAD * DAY_MS) return { ok: false, message: 'Pick a time in the next two weeks' };
  return { ok: true };
}

/** The last notification slot (12:30 or 19:30 IST) at least 30 min before the start. */
export function reminderSlot(startsAt: TimeLike): Date {
  const start = toMillis(startsAt);
  const latest = start - REMINDER_LEAD_MS;
  const midnight = istDayIndex(start) * DAY_MS - IST_OFFSET_MS;
  let best = Number.NEGATIVE_INFINITY;
  for (const dayStart of [midnight - DAY_MS, midnight]) {
    for (const minutes of SLOT_MINUTES) {
      const at = dayStart + minutes * MINUTE_MS;
      if (at <= latest && at > best) best = at;
    }
  }
  return new Date(best);
}

/**
 * When to remind a player who joins now: the slot before the start, or
 * straight away (urgent) when that slot has passed. Null when even an urgent
 * send would land after the start.
 */
export function reminderPlan(startsAt: TimeLike, now: Date): { at: Date; urgent: boolean } | null {
  const start = toMillis(startsAt);
  if (!Number.isFinite(start) || start <= now.getTime()) return null;
  const slot = reminderSlot(start);
  if (slot.getTime() > now.getTime()) return { at: slot, urgent: false };
  const urgentAt = nextSlot(now, { urgent: true });
  if (urgentAt.getTime() >= start) return null;
  return { at: urgentAt, urgent: true };
}

/** 'Your football game starts at 5:30 pm'. */
export function reminderTitle(sport: GameSport, startsAt: TimeLike): string {
  return `Your ${sportLabel(sport).toLowerCase()} game starts at ${timeLabel(startsAt)}`;
}

/** 'Your football game was cancelled'. */
export function cancelledTitle(sport: GameSport): string {
  return `Your ${sportLabel(sport).toLowerCase()} game was cancelled`;
}

/* Views -------------------------------------------------------------------- */

/** A game as one viewer sees it. Player ids never leave the server. */
export interface GameView {
  id: string;
  sport: GameSport;
  group: PickupSport;
  sportLabel: string;
  status: GameStatus;
  startsAt: string;
  /** 'Today 5:30 pm' when the server built the view. */
  label: string;
  capacity: number;
  joinedCount: number;
  slotsLeft: number;
  full: boolean;
  started: boolean;
  over: boolean;
  place: Omit<ListingPlace, 'lat' | 'lng'> | null;
  note: string | null;
  host: VerifiedPoster;
  isHost: boolean;
  joined: boolean;
  canJoin: boolean;
}

export function toGameView(id: string, game: GameRecord, viewerId: string, now: Date, verified = true): GameView {
  const place = game.place
    ? {
        landmarkId: game.place.landmarkId,
        label: game.place.label,
        area: game.place.area,
        campusId: game.place.campusId,
        roughDistanceM: game.place.roughDistanceM,
      }
    : null;
  const startMs = toMillis(game.startsAt);
  return {
    id,
    sport: game.sport,
    group: sportGroup(game.sport),
    sportLabel: sportLabel(game.sport),
    status: game.status,
    startsAt: Number.isFinite(startMs) ? new Date(startMs).toISOString() : new Date(0).toISOString(),
    label: slotLabel(startMs, now),
    capacity: capacityOf(game),
    joinedCount: joinedCount(game),
    slotsLeft: slotsLeft(game),
    full: isFull(game),
    started: isStarted(game, now),
    over: isOver(game, now),
    place,
    note: game.note ?? null,
    host: { displayName: game.posterDisplayName || 'Student', verified: true },
    isHost: Boolean(viewerId) && game.authorId === viewerId,
    joined: hasJoined(game, viewerId),
    canJoin: canJoin(game, { userId: viewerId, verified, now }).ok,
  };
}

/** Soonest first. */
export function soonestFirst<T extends { startsAt: string }>(games: readonly T[]): T[] {
  return [...games].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** 'Football · Today 5:30 pm · 3 of 10 left', or '... · Full'. */
export function gameLine(game: Pick<GameView, 'sportLabel' | 'label' | 'slotsLeft' | 'capacity' | 'full'>): string {
  const slots = game.full ? 'Full' : `${game.slotsLeft} of ${game.capacity} left`;
  return `${game.sportLabel} · ${game.label} · ${slots}`;
}

/** Stored title, e.g. 'Football at Sports Arena'. */
export function gameTitle(sport: GameSport, placeLabel: string | null | undefined): string {
  const where = placeLabel?.trim();
  return where ? `${sportLabel(sport)} at ${where}` : sportLabel(sport);
}
