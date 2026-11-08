// The demo date. It moves only the season helpers (src/lib/campus/season.ts)
// and the seasonal sample packs; every other date stays on the real clock.
//
//   nov  = today if it is between 15 Oct and 30 Nov, else the next 10 Nov
//   may  = the next 20 May
//   july = the next 10 Jul
//
// Each instant keeps today's IST time of day. With demo off, real time is used.
// Node tests import this file, so runtime imports are relative with .ts.
// Never touches window at import.

// Namespace import on purpose: server code (the date route, the world's season
// pack, the housing posts route) imports this file too, and Next refuses named
// client-hook imports from 'react' in the server graph. The hooks run only in the browser.
import * as React from 'react';
import { DEMO_DATE_COOKIE, parseDemoDate } from './contract.ts';
import type { DemoDateId } from './contract.ts';
import { isDemoMode } from './mode.ts';

type Instant = Date | string | number;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_API = '/api/demo/date';

/** Month and day each demo date jumps to. 'nov' stays on today inside its window. */
const TARGETS: Record<DemoDateId, { month: number; day: number }> = {
  nov: { month: 11, day: 10 },
  may: { month: 5, day: 20 },
  july: { month: 7, day: 10 },
};

/** Exam season window kept as is for 'nov': 15 Oct to 30 Nov. */
const NOV_WINDOW = { from: 1015, to: 1130 };

function toMs(value: Instant): number {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError('Invalid date');
  return ms;
}

/**
 * The demo instant for a demo date: the next matching IST calendar day (today
 * counts), at today's IST time of day.
 */
export function demoInstant(id: DemoDateId, now: Instant = Date.now()): Date {
  const ms = toMs(now);
  const shifted = new Date(ms + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const monthDay = (shifted.getUTCMonth() + 1) * 100 + shifted.getUTCDate();
  if (id === 'nov' && monthDay >= NOV_WINDOW.from && monthDay <= NOV_WINDOW.to) return new Date(ms);

  const target = TARGETS[id];
  const targetMonthDay = target.month * 100 + target.day;
  const targetYear = monthDay <= targetMonthDay ? year : year + 1;
  const timeOfDay = ((ms + IST_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS;
  return new Date(Date.UTC(targetYear, target.month - 1, target.day) - IST_OFFSET_MS + timeOfDay);
}

/**
 * The clock the season helpers read: the demo instant for the swoop_demo_date
 * value in demo mode, else real now. A missing or bad value means 'nov'.
 */
export function seasonInstant(rawDateCookie: string | null | undefined, now: Instant = Date.now()): Date {
  if (!isDemoMode()) return new Date(toMs(now));
  return demoInstant(parseDemoDate(rawDateCookie), now);
}

/** The raw swoop_demo_date value from a cookie string, or null. */
export function rawDemoDateFrom(cookieString: string | null | undefined): string | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(';')) {
    const index = part.indexOf('=');
    if (index < 0 || part.slice(0, index).trim() !== DEMO_DATE_COOKIE) continue;
    const value = part.slice(index + 1).trim();
    return value || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook

/** The cookie only changes through setDemoDate, which reloads the page. */
function subscribeNever(): () => void {
  return () => undefined;
}

function readDateCookie(): DemoDateId {
  return parseDemoDate(typeof document === 'undefined' ? null : rawDemoDateFrom(document.cookie));
}

function serverDateSnapshot(): null {
  return null;
}

function useRealSeasonNow(): Date {
  const [now] = React.useState(() => new Date());
  return now;
}

/** Real now on the server and during hydration, then the demo instant. */
function useDemoSeasonNow(): Date {
  const [now] = React.useState(() => new Date());
  const dateId = React.useSyncExternalStore<DemoDateId | null>(subscribeNever, readDateCookie, serverDateSnapshot);
  return React.useMemo(() => (dateId === null ? now : demoInstant(dateId, now)), [dateId, now]);
}

/** The instant for season helpers (home slot, market prompt, peak housing, move-in labels). */
export const useSeasonNow: () => Date = isDemoMode() ? useDemoSeasonNow : useRealSeasonNow;

// ---------------------------------------------------------------------------
// Switching

/** Moves the demo to another date, then reloads so every page reads it. */
export async function setDemoDate(id: DemoDateId): Promise<void> {
  if (!isDemoMode()) throw new Error('Not in the demo: setDemoDate');
  const response = await fetch(DATE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: id }),
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Could not change the demo date');
  window.location.reload();
}
