'use client';

// The demo bar's student picker: the sample students, Signed out, and the
// new-student sign-in. Every pick does a full page load (session.ts helpers),
// so each client store starts fresh for the new account.
// Also exports DemoSheet, the plain Swoop sheet the demo bar opens.

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  DEMO_PERSONAS,
  WALKTHROUGH_NAME,
  WALKTHROUGH_UID,
  demoPersonaByUid,
  type DemoPersonaId,
  type DemoSession,
} from '@/lib/demo/contract';
import { demoClerkUser } from '@/lib/demo/server/identity';
import { currentDemoPath, signInAs, signOut, useDemoSession } from '@/lib/demo/client/session';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import { Initial } from '@/components/demo/auth/DemoAccountChooser';
import { CheckIcon, CloseIcon, LandmarkIcon, UserIcon } from '@/components/swoop/icons';
import { IconTile, Tag } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Labels

/** 'Sana · KJU Main', 'Riya · New student', or 'Signed out'. */
export function demoStudentLabel(session: DemoSession | null | undefined): string {
  if (!session) return 'Signed out';
  const persona = demoPersonaByUid(session.uid);
  if (persona) return `${persona.name} · ${persona.campusLabel}`;
  if (session.uid === WALKTHROUGH_UID) return `${WALKTHROUGH_NAME} · New student`;
  return demoClerkUser(session).fullName;
}

/** The signed-in student's label, or null while the session loads. */
export function useDemoStudentLabel(): string | null {
  const state = useDemoSession();
  return state.isLoaded ? demoStudentLabel(state.session) : null;
}

// ---------------------------------------------------------------------------
// Sheet

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** A plain Swoop sheet marked Demo. Escape, the backdrop and Close all call onClose. */
export function DemoSheet({ title, line, onClose, children }: { title: string; line?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus the first choice, lock page scroll, and give focus back on close.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (items?.[1] ?? items?.[0])?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // Keep Tab inside the sheet.
  const trapTab = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/45 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapTab}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[400px] flex-col overflow-y-auto overflow-x-hidden rounded-[14px] bg-white p-3.5 pb-[max(14px,env(safe-area-inset-bottom))] shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-center gap-1.5">
          <Tag tone="royal">Demo</Tag>
          <h2 id={titleId} className="min-w-0 flex-1 font-heading text-[16px] leading-[1.15] text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
          >
            <CloseIcon size={14} />
          </button>
        </div>
        {line ? <p className="mt-1 text-[11.5px] leading-[1.4] text-slate">{line}</p> : null}
        {children}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Choices

type Pick = DemoPersonaId | 'signed-out' | 'new';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** The student rows, used inline in the wide panel and inside the sheet. */
export function PersonaChoices({ compact = false, className }: { compact?: boolean; className?: string }) {
  const state = useDemoSession();
  const session = state.isLoaded ? state.session : undefined;
  const currentPersona = session ? demoPersonaByUid(session.uid)?.id ?? null : null;
  const signedOut = state.isLoaded && !session;
  const [busy, setBusy] = useState<Pick | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: Pick, action: () => Promise<void>, fallback: string) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await action();
      // Success loads another page; keep the rows locked until it does.
    } catch (err) {
      setError(errorMessage(err, fallback));
      setBusy(null);
    }
  };

  const pickPersona = (id: DemoPersonaId) => {
    if (id === currentPersona) return;
    void run(id, () => signInAs(id, currentDemoPath()), 'Could not switch student.');
  };

  const pickSignedOut = () => {
    if (signedOut) return;
    void run('signed-out', () => signOut(currentDemoPath()), 'Could not sign out.');
  };

  const pickNewStudent = () =>
    void run(
      'new',
      async () => {
        await signOut(null);
        useCollegeStore.getState().clearPick();
        window.location.assign('/login');
      },
      'Could not open sign-in.',
    );

  const locked = busy !== null;
  const avatar = compact ? 26 : 30;

  return (
    <div className={className} aria-busy={locked}>
      {error ? (
        <p role="alert" className="mb-1.5 rounded-[10px] bg-market-tint px-2.5 py-1.5 text-[11.5px] font-semibold text-market">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {DEMO_PERSONAS.map((persona) => (
          <li key={persona.id}>
            <ChoiceRow
              compact={compact}
              leading={<Initial name={persona.name} size={avatar} />}
              title={persona.name}
              meta={persona.campusLabel}
              subtitle={busy === persona.id ? 'Switching…' : persona.line}
              current={currentPersona === persona.id}
              disabled={locked}
              onClick={() => pickPersona(persona.id)}
            />
          </li>
        ))}
        <li>
          <ChoiceRow
            compact={compact}
            leading={<IconTile icon={UserIcon} tone="surface" size={avatar} className="bg-white" />}
            title="Signed out"
            subtitle={busy === 'signed-out' ? 'Signing out…' : 'Browse before you sign in'}
            current={signedOut}
            disabled={locked}
            onClick={pickSignedOut}
          />
        </li>
        <li>
          <ChoiceRow
            compact={compact}
            leading={<IconTile icon={LandmarkIcon} tone="royal" size={avatar} />}
            title="Try sign-in as a new student"
            subtitle={busy === 'new' ? 'Opening…' : `Sign in as ${WALKTHROUGH_NAME}`}
            current={false}
            disabled={locked}
            onClick={pickNewStudent}
          />
        </li>
      </ul>
    </div>
  );
}

function ChoiceRow({
  compact,
  leading,
  title,
  meta,
  subtitle,
  current,
  disabled,
  onClick,
}: {
  compact: boolean;
  leading: ReactNode;
  title: string;
  meta?: string;
  subtitle: string;
  current: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={current ? 'true' : undefined}
      className={cn(
        'campus-press flex w-full items-center gap-2 rounded-[12px] px-2 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 disabled:cursor-default',
        compact ? 'min-h-[42px] py-1.5' : 'min-h-12 py-2',
        current ? 'bg-royal-tint' : 'bg-surface',
        disabled && 'opacity-70',
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-bold text-ink">{title}</span>
          {meta ? <span className="shrink-0 truncate text-[10.5px] font-semibold text-slate">{meta}</span> : null}
        </span>
        <span className="truncate text-[11px] text-slate">{subtitle}</span>
      </span>
      {current ? <CheckIcon size={14} aria-hidden="true" className="shrink-0 text-royal" /> : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Picker

/** The student picker sheet, opened from the demo bar's student chip. */
export function PersonaPicker({ onClose }: { onClose: () => void }) {
  return (
    <DemoSheet title="Pick a student" line="Sample students. Nothing here is real." onClose={onClose}>
      <PersonaChoices className="mt-2.5" />
    </DemoSheet>
  );
}

export default PersonaPicker;
