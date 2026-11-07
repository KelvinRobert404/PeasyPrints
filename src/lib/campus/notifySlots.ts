// Notification timing: batched sends at 12:30 and 19:30 IST, nothing during
// quiet hours (22:00-07:00 IST), urgent sends go straight away outside quiet
// hours. Pure and dependency free so node tests can import it. IST is +05:30.

export type Instant = Date | string | number;

export interface SlotOptions {
  urgent?: boolean;
}

export interface DedupeKeyInput {
  userId: string;
  type: string;
  targetId?: string | null;
  /** The scheduled send time. Omit for a once-ever key. */
  slot?: Instant | null;
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Slot times as minutes after IST midnight. */
export const SLOT_MINUTES: readonly number[] = [12 * 60 + 30, 19 * 60 + 30];
export const QUIET_START_MINUTES = 22 * 60;
export const QUIET_END_MINUTES = 7 * 60;

function toMs(value: Instant): number {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError('Invalid date');
  return ms;
}

/** Epoch ms of IST midnight for the IST day containing `ms`, and minutes past it. */
function istClock(ms: number): { midnight: number; minutes: number } {
  const shifted = ms + IST_OFFSET_MS;
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  return { midnight: dayStart - IST_OFFSET_MS, minutes: (shifted - dayStart) / MINUTE_MS };
}

export function isQuietHours(now: Instant): boolean {
  const { minutes } = istClock(toMs(now));
  return minutes >= QUIET_START_MINUTES || minutes < QUIET_END_MINUTES;
}

/**
 * When a notification should go out. Normal: the next 12:30 or 19:30 IST slot
 * (exactly on a slot counts as that slot), else 12:30 the next day. Urgent: now,
 * unless it is quiet hours, then 07:00 IST.
 */
export function nextSlot(now: Instant, options: SlotOptions = {}): Date {
  const at = toMs(now);
  const { midnight, minutes } = istClock(at);
  if (options.urgent) {
    if (!isQuietHours(at)) return new Date(at);
    const dayOffset = minutes >= QUIET_START_MINUTES ? DAY_MS : 0;
    return new Date(midnight + dayOffset + QUIET_END_MINUTES * MINUTE_MS);
  }
  for (const slot of SLOT_MINUTES) {
    if (minutes <= slot) return new Date(midnight + slot * MINUTE_MS);
  }
  return new Date(midnight + DAY_MS + SLOT_MINUTES[0] * MINUTE_MS);
}

function keyPart(value: string): string {
  return encodeURIComponent(value.trim());
}

/**
 * Idempotency key for a notification: one per user, type, target and slot.
 * Without a slot the key is once-ever, which suits one-time nudges.
 */
export function dedupeKey(input: DedupeKeyInput): string {
  if (!input.userId.trim() || !input.type.trim()) throw new Error('dedupeKey needs userId and type');
  const parts = [keyPart(input.type), keyPart(input.userId), input.targetId ? keyPart(input.targetId) : '-'];
  if (input.slot != null) {
    const shifted = new Date(toMs(input.slot) + IST_OFFSET_MS).toISOString();
    parts.push(`${shifted.slice(0, 10)}T${shifted.slice(11, 16)}`);
  }
  return parts.join(':');
}
