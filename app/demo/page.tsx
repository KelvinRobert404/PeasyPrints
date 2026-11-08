'use client';

// /demo: the demo's front door. Three ways in (new student, sample student,
// signed out) and the demo date. Demo only: a 404 everywhere else.

import { notFound } from 'next/navigation';
import { use, useState, useSyncExternalStore, type ReactNode } from 'react';
import { isDemoMode } from '@/lib/demo/mode';
import { DEMO_DATE_IDS, DEMO_PERSONAS, demoPersonaByUid, parseDemoDate, type DemoDateId, type DemoPersonaId } from '@/lib/demo/contract';
import { signInAs, signOut, useDemoSession } from '@/lib/demo/client/session';
import { rawDemoDateFrom, setDemoDate } from '@/lib/demo/season';
import { resetDemo } from '@/lib/demo/client/reset';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';
import { Initial } from '@/components/demo/auth/DemoAccountChooser';
import { SwoopLogo } from '@/components/swoop/Logo';
import { Chip, IconTile, Tag, swButton } from '@/components/swoop/primitives';
import { ChevronRightIcon, LandmarkIcon, SearchIcon } from '@/components/swoop/icons';
import { cn } from '@/lib/utils/cn';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DATE_LABELS: Record<DemoDateId, { label: string; hint: string }> = {
  nov: { label: 'Nov', hint: 'Exam season. Notes get printed.' },
  may: { label: 'May', hint: 'Term ends. Students sell and move out.' },
  july: { label: 'July', hint: 'New term. Students set up rooms.' },
};

/** Which action is running: one at a time, so nothing races a page load. */
type Busy = 'new' | 'signed-out' | 'reset' | DemoPersonaId | DemoDateId | null;

export default function DemoPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isDemoMode()) notFound();
  return <DemoStart searchParams={searchParams} />;
}

/** ?next= as a same-origin path, or null. Demo pages never count as a target. */
function readNext(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const path = safeRedirectPath(raw, '');
  if (!path || path === '/' || path === '/demo' || path.startsWith('/demo/') || path.startsWith('/demo?')) return null;
  return path;
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

/** Clears the pre-sign-in college pick, so /login and Home start fresh. */
function clearCollegePick(): void {
  useCollegeStore.getState().clearPick();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function DemoStart({ searchParams }: { searchParams: SearchParams }) {
  const next = readNext(use(searchParams).next);
  const session = useDemoSession();
  const currentUid = session.isLoaded ? session.session?.uid ?? null : null;
  const currentPersona = demoPersonaByUid(currentUid)?.id ?? null;
  const date = useSyncExternalStore<DemoDateId | null>(subscribeNever, readDateCookie, serverDate);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: Exclude<Busy, null>, action: () => Promise<void>, fallback: string) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await action();
      // Success loads another page; keep the buttons locked until it does.
    } catch (err) {
      setError(errorMessage(err, fallback));
      setBusy(null);
    }
  };

  const startAsNewStudent = () =>
    run(
      'new',
      async () => {
        await signOut(null);
        clearCollegePick();
        window.location.assign(next ? `/login?redirect_url=${encodeURIComponent(next)}` : '/login');
      },
      'Could not open sign-in.',
    );

  const lookAround = () =>
    run(
      'signed-out',
      async () => {
        await signOut(null);
        clearCollegePick();
        window.location.assign('/');
      },
      'Could not sign out.',
    );

  const pickPersona = (id: DemoPersonaId) => run(id, () => signInAs(id, next ?? '/'), 'Could not sign in.');

  const pickDate = (id: DemoDateId) => {
    if (id === date) return;
    void run(id, () => setDemoDate(id), 'Could not change the date.');
  };

  const reset = () => run('reset', resetDemo, 'Could not reset the demo.');

  const locked = busy !== null;

  return (
    <main className="flex flex-1 flex-col px-3 pb-4 pt-3" aria-busy={locked}>
      <div className="flex items-center gap-1.5">
        <SwoopLogo size={15} />
        <Tag tone="royal">Demo</Tag>
      </div>

      <h1 className="mt-3 font-heading text-[16px] leading-[1.15] text-ink">Hey, this is the Swoop demo</h1>
      <p className="mt-0.5 text-[12px] leading-[1.4] text-slate">Sample students, shops and posts. Nothing is real.</p>

      {error ? (
        <p role="alert" className="mt-2 rounded-[10px] bg-market-tint px-2.5 py-2 text-[11.5px] font-semibold text-market">
          {error}
        </p>
      ) : null}

      <SectionLabel>Start fresh</SectionLabel>
      <ChoiceButton
        leading={<IconTile icon={LandmarkIcon} tone="royal" size={34} />}
        title="Sign in like a new student"
        subtitle="Pick a college, then sign in as Riya."
        busy={busy === 'new'}
        disabled={locked}
        onClick={startAsNewStudent}
      />

      <SectionLabel>Jump in as a sample student</SectionLabel>
      <ul className="flex flex-col gap-1.5">
        {DEMO_PERSONAS.map((persona) => (
          <li key={persona.id}>
            <ChoiceButton
              leading={<Initial name={persona.name} size={34} />}
              title={persona.name}
              badge={
                <>
                  <span className="truncate rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-bold text-ink">{persona.campusLabel}</span>
                  {currentPersona === persona.id ? <Tag tone="go">Signed in</Tag> : null}
                </>
              }
              subtitle={persona.line}
              busy={busy === persona.id}
              disabled={locked}
              onClick={() => void pickPersona(persona.id)}
            />
          </li>
        ))}
      </ul>

      <SectionLabel>Or just browse</SectionLabel>
      <ChoiceButton
        leading={<IconTile icon={SearchIcon} tone="surface" size={34} className="bg-white" />}
        title="Look around signed out"
        subtitle="See Swoop before you sign in."
        busy={busy === 'signed-out'}
        disabled={locked}
        onClick={lookAround}
      />

      <SectionLabel>Demo date</SectionLabel>
      <div role="group" aria-label="Demo date" className="flex flex-wrap gap-1.5">
        {DEMO_DATE_IDS.map((id) => (
          <Chip key={id} selected={date === id} onClick={() => (locked ? undefined : pickDate(id))}>
            {DATE_LABELS[id].label}
          </Chip>
        ))}
      </div>
      <p className="mt-1.5 min-h-[16px] text-[11px] text-slate">
        {busy === 'nov' || busy === 'may' || busy === 'july' ? 'Changing the date…' : date ? DATE_LABELS[date].hint : null}
      </p>

      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="min-w-0 text-[11px] leading-[1.4] text-slate">Your changes stay in this browser. Reset any time.</p>
        <button
          type="button"
          onClick={() => void reset()}
          disabled={locked}
          className={swButton({ variant: 'surface', size: 'sm', className: 'shrink-0' })}
        >
          {busy === 'reset' ? 'Resetting…' : 'Reset'}
        </button>
      </footer>
    </main>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-1.5 mt-4 font-heading text-[14.5px] leading-[1.1] text-ink">{children}</h2>;
}

function ChoiceButton({
  leading,
  title,
  badge,
  subtitle,
  busy,
  disabled,
  onClick,
}: {
  leading: ReactNode;
  title: string;
  badge?: ReactNode;
  subtitle: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className={cn(
        'campus-press flex min-h-[52px] w-full items-center gap-2.5 rounded-[12px] bg-surface px-2.5 py-2 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 disabled:cursor-default',
        disabled && !busy && 'opacity-60',
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-bold text-ink">{title}</span>
          {badge}
        </span>
        <span className="truncate text-[11px] text-slate">{busy ? 'Opening…' : subtitle}</span>
      </span>
      <ChevronRightIcon size={14} className="shrink-0 text-slate" />
    </button>
  );
}
