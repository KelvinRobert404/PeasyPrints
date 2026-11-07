// Campus calendar rules: seasonal prompts, the home seasonal slot, peak housing
// season and move-in dates. Pure and dependency free so node tests can import it.
// All calendar maths runs in IST, a fixed +05:30 offset (India has no DST).

export type Instant = Date | string | number;

export type SeasonalPrompt = 'moving_out' | 'set_up_room';

export type HomeSeasonalSlotId = 'exams' | 'moving_out' | 'set_up_room' | 'next_sem_room';

export interface HomeSeasonalSlot {
  id: HomeSeasonalSlotId;
  title: string;
  href: string;
}

/** 'now', 'next_sem' or an IST calendar date 'YYYY-MM-DD'. */
export type MoveInChoice = 'now' | 'next_sem' | string;

export const DEFAULT_SEM_STARTS: readonly string[] = ['06-01', '11-15'];

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface IstDate {
  year: number;
  month: number; // 1-12
  day: number;
}

function toMs(value: Instant): number {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError('Invalid date');
  return ms;
}

function istDate(value: Instant): IstDate {
  const shifted = new Date(toMs(value) + IST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function dateKey(date: IstDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function parseDateKey(key: string): IstDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Day number (days since epoch) of an IST calendar date, for day differences. */
function dayNumber(date: IstDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / DAY_MS);
}

/** Month-day as a comparable number, e.g. 15 Oct -> 1015. */
function monthDay(date: IstDate): number {
  return date.month * 100 + date.day;
}

/** IST calendar date 'YYYY-MM-DD' for an instant. */
export function istDateKey(value: Instant): string {
  return dateKey(istDate(value));
}

export function seasonalPrompt(date: Instant): SeasonalPrompt | null {
  const { month } = istDate(date);
  if (month === 4 || month === 5) return 'moving_out';
  if (month >= 6 && month <= 8) return 'set_up_room';
  return null;
}

export function isExamSeason(date: Instant): boolean {
  const md = monthDay(istDate(date));
  return (md >= 1015 && md <= 1130) || (md >= 315 && md <= 331);
}

export function homeSeasonalSlot(date: Instant): HomeSeasonalSlot | null {
  if (isExamSeason(date)) return { id: 'exams', title: 'Exams soon? Print your notes', href: '/upload' };
  const { month } = istDate(date);
  if (month === 4 || month === 5) return { id: 'moving_out', title: 'Moving out? Sell it as a bundle', href: '/marketplace/new?kind=bundle' };
  if (month >= 6 && month <= 8) return { id: 'set_up_room', title: 'Set up your room for less', href: '/marketplace/all/near-you' };
  if (month === 12 || month === 1) return { id: 'next_sem_room', title: 'Next sem room?', href: '/housing' };
  return null;
}

export function isPeakHousingSeason(date: Instant): boolean {
  const { month } = istDate(date);
  return month >= 4 && month <= 8;
}

/**
 * The next semester start on or after today (IST), as 'YYYY-MM-DD'.
 * `starts` are month-day strings 'MM-DD'; invalid entries are ignored.
 */
export function nextSemStart(now: Instant, starts: readonly string[] = DEFAULT_SEM_STARTS): string {
  const today = istDate(now);
  const todayNumber = dayNumber(today);
  let best: IstDate | null = null;
  for (const start of starts) {
    const match = /^(\d{2})-(\d{2})$/.exec(start);
    if (!match) continue;
    for (const year of [today.year, today.year + 1]) {
      const candidate = parseDateKey(`${year}-${match[1]}-${match[2]}`);
      if (!candidate || dayNumber(candidate) < todayNumber) continue;
      if (!best || dayNumber(candidate) < dayNumber(best)) best = candidate;
      break;
    }
  }
  if (!best) throw new RangeError('No valid semester start');
  return dateKey(best);
}

/**
 * Resolves a move-in choice to an IST date 'YYYY-MM-DD'. 'now', a missing value,
 * an unreadable date or a date in the past all resolve to today.
 */
export function resolveMoveIn(choice: MoveInChoice | null | undefined, now: Instant, starts: readonly string[] = DEFAULT_SEM_STARTS): string {
  const today = istDate(now);
  if (choice === 'next_sem') return nextSemStart(now, starts);
  const date = choice ? parseDateKey(choice) : null;
  if (!date || dayNumber(date) <= dayNumber(today)) return dateKey(today);
  return dateKey(date);
}

/** Short label for a move-in choice: 'Move in now', 'From tomorrow', 'From 1 Jun', 'From 15 Jan 2028'. */
export function moveInLabel(choice: MoveInChoice | null | undefined, now: Instant, starts: readonly string[] = DEFAULT_SEM_STARTS): string {
  const today = istDate(now);
  const date = parseDateKey(resolveMoveIn(choice, now, starts))!;
  const diff = dayNumber(date) - dayNumber(today);
  if (diff <= 0) return 'Move in now';
  if (diff === 1) return 'From tomorrow';
  const base = `From ${date.day} ${MONTHS[date.month - 1]}`;
  return date.year === today.year ? base : `${base} ${date.year}`;
}
