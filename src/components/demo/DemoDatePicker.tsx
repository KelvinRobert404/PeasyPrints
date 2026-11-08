'use client';

// The demo bar's date picker: 8 Nov (today's exam season), May or July.
// The date moves only the season helpers and the seasonal sample packs.
// setDemoDate saves it and reloads the page.

import { useState, useSyncExternalStore } from 'react';
import { DEMO_DATE_IDS, parseDemoDate, type DemoDateId } from '@/lib/demo/contract';
import { demoInstant, rawDemoDateFrom, setDemoDate } from '@/lib/demo/season';
import { DemoSheet } from '@/components/demo/PersonaPicker';
import { CheckIcon } from '@/components/swoop/icons';
import { Chip } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

const DATE_HINTS: Record<DemoDateId, string> = {
  nov: 'Exam season. Notes get printed.',
  may: 'Term ends. Students sell and move out.',
  july: 'New term. Students set up rooms.',
};

const NOV_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/** '8 Nov' (the demo's November day), 'May' or 'July'. */
export function demoDateLabel(id: DemoDateId, now: Date = new Date()): string {
  if (id === 'may') return 'May';
  if (id === 'july') return 'July';
  return NOV_FORMAT.format(demoInstant('nov', now));
}

// The date cookie changes only through setDemoDate, which reloads the page.
function subscribeNever(): () => void {
  return () => undefined;
}
function readDateCookie(): DemoDateId {
  return parseDemoDate(rawDemoDateFrom(document.cookie));
}
function serverDate(): null {
  return null;
}

/** The demo date from the cookie, or null on the server and during hydration. */
export function useDemoDate(): DemoDateId | null {
  return useSyncExternalStore<DemoDateId | null>(subscribeNever, readDateCookie, serverDate);
}

/** Runs setDemoDate once; the page reloads on success. */
function useDateSwitch() {
  const current = useDemoDate();
  const [busy, setBusy] = useState<DemoDateId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = async (id: DemoDateId) => {
    if (busy || id === current) return;
    setBusy(id);
    setError(null);
    try {
      await setDemoDate(id);
    } catch {
      setError('Could not change the date.');
      setBusy(null);
    }
  };
  return { current, busy, error, pick };
}

/** Date chips with a one-line hint, for the wide demo panel. */
export function DemoDateChips({ className }: { className?: string }) {
  const { current, busy, error, pick } = useDateSwitch();
  const [now] = useState(() => new Date());
  return (
    <div className={className}>
      <div role="group" aria-label="Demo date" className="flex flex-wrap gap-1">
        {DEMO_DATE_IDS.map((id) => (
          <Chip key={id} selected={current === id} onClick={() => void pick(id)}>
            {demoDateLabel(id, now)}
          </Chip>
        ))}
      </div>
      <p role={error ? 'alert' : undefined} className={cn('mt-1 min-h-[15px] text-[11px] leading-[1.35]', error ? 'font-semibold text-market' : 'text-slate')}>
        {error ?? (busy ? 'Changing the date…' : current ? DATE_HINTS[current] : null)}
      </p>
    </div>
  );
}

/** The date picker sheet, opened from the demo bar's date chip. */
export function DemoDatePicker({ onClose }: { onClose: () => void }) {
  const { current, busy, error, pick } = useDateSwitch();
  const [now] = useState(() => new Date());
  return (
    <DemoSheet title="Pick a demo date" line="Moves only the seasonal sample posts." onClose={onClose}>
      {error ? (
        <p role="alert" className="mt-2 rounded-[10px] bg-market-tint px-2.5 py-1.5 text-[11.5px] font-semibold text-market">
          {error}
        </p>
      ) : null}
      <ul className="mt-2.5 flex flex-col gap-1" aria-busy={busy !== null}>
        {DEMO_DATE_IDS.map((id) => {
          const selected = current === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => void pick(id)}
                disabled={busy !== null}
                aria-pressed={selected}
                className={cn(
                  'campus-press flex min-h-12 w-full items-center gap-2 rounded-[12px] px-2.5 py-2 text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 disabled:cursor-default',
                  selected ? 'bg-royal-tint' : 'bg-surface',
                  busy !== null && 'opacity-70',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="truncate text-[12.5px] font-bold text-ink">{demoDateLabel(id, now)}</span>
                  <span className="truncate text-[11px] text-slate">{busy === id ? 'Changing the date…' : DATE_HINTS[id]}</span>
                </span>
                {selected ? <CheckIcon size={14} className="shrink-0 text-royal" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </DemoSheet>
  );
}

export default DemoDatePicker;
