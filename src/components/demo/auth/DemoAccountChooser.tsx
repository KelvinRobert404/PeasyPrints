'use client';

// The demo's mocked Google step and sample-student picker: a plain Swoop sheet,
// "Pick a sample account", marked Demo. It never looks like Google's picker.
// openDemoAccountChooser() opens it from anywhere and resolves the pick, or
// null on Cancel. ClerkProvider (the demo stand-in) mounts the host once.

import { useEffect, useId, useRef, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  DEMO_PERSONAS,
  WALKTHROUGH_COLLEGE_EMAIL,
  WALKTHROUGH_PERSONAL_EMAIL,
  type DemoPersonaId,
  type WalkthroughEmailKind,
} from '@/lib/demo/contract';
import { ChevronRightIcon, LandmarkIcon, UserIcon } from '@/components/swoop/icons';
import { IconTile, Tag, swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

/** 'google': Riya's two accounts and the sample students. 'students': students only. */
export type DemoChooserMode = 'google' | 'students';

/** 'college' or 'personal' is Riya through the mocked Google step; otherwise a sample student. */
export type DemoAccountPick = WalkthroughEmailKind | DemoPersonaId;

export interface OpenDemoAccountChooserOptions {
  mode?: DemoChooserMode;
}

export function isWalkthroughPick(pick: DemoAccountPick | null | undefined): pick is WalkthroughEmailKind {
  return pick === 'college' || pick === 'personal';
}

// ---------------------------------------------------------------------------
// Open/settle store

interface ChooserRequest {
  id: number;
  mode: DemoChooserMode;
  resolve: (pick: DemoAccountPick | null) => void;
}

let current: ChooserRequest | null = null;
let sequence = 0;
let hostCount = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function settle(request: ChooserRequest, pick: DemoAccountPick | null): void {
  if (current !== request) return;
  current = null;
  emit();
  request.resolve(pick);
}

/**
 * Opens the sheet. Resolves the pick, or null when the visitor cancels.
 * Opening again cancels the sheet already open.
 */
export function openDemoAccountChooser(options: OpenDemoAccountChooserOptions = {}): Promise<DemoAccountPick | null> {
  if (typeof window === 'undefined' || hostCount === 0) return Promise.resolve(null);
  if (current) settle(current, null);
  return new Promise((resolve) => {
    sequence += 1;
    current = { id: sequence, mode: options.mode ?? 'google', resolve };
    emit();
  });
}

/** Closes an open sheet as if cancelled. */
export function closeDemoAccountChooser(): void {
  if (current) settle(current, null);
}

/** Renders the sheet while one is open. Mount once (the demo ClerkProvider does). */
export function DemoAccountChooserHost() {
  const request = useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );

  useEffect(() => {
    hostCount += 1;
    return () => {
      hostCount -= 1;
      if (hostCount === 0) closeDemoAccountChooser();
    };
  }, []);

  if (!request) return null;
  return <DemoAccountChooser key={request.id} mode={request.mode} onPick={(pick) => settle(request, pick)} />;
}

// ---------------------------------------------------------------------------
// The sheet

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** The sheet itself. Presentational: previews can pass their own onPick. */
export function DemoAccountChooser({
  mode = 'google',
  onPick,
}: {
  mode?: DemoChooserMode;
  onPick: (pick: DemoAccountPick | null) => void;
}) {
  const titleId = useId();
  const lineId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Focus the first choice, lock page scroll, and give focus back on close.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onPickRef.current(null);
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

  const google = mode === 'google';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/45 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onPick(null);
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={lineId}
        onKeyDown={trapTab}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[400px] flex-col overflow-y-auto overflow-x-hidden rounded-[14px] bg-white p-3.5 pb-[max(14px,env(safe-area-inset-bottom))] shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-center gap-1.5">
          <Tag tone="royal">Demo</Tag>
          <h2 id={titleId} className="min-w-0 truncate font-heading text-[16px] leading-[1.15] text-ink">
            Pick a sample account
          </h2>
        </div>
        <p id={lineId} className="mt-1 text-[11.5px] leading-[1.4] text-slate">
          {google ? 'Sample data. No real Google sign-in.' : 'Sample students. Nothing here is real.'}
        </p>

        {google ? (
          <>
            <SectionLabel>Sign in as Riya, a new student</SectionLabel>
            <ul className="flex flex-col gap-1.5">
              <li>
                <ChoiceRow
                  leading={<IconTile icon={LandmarkIcon} tone="royal" size={32} />}
                  title="College account"
                  subtitle={WALKTHROUGH_COLLEGE_EMAIL}
                  onClick={() => onPick('college')}
                />
              </li>
              <li>
                <ChoiceRow
                  leading={<IconTile icon={UserIcon} tone="surface" size={32} className="bg-white" />}
                  title="Personal account"
                  subtitle={WALKTHROUGH_PERSONAL_EMAIL}
                  onClick={() => onPick('personal')}
                />
              </li>
            </ul>
          </>
        ) : null}

        <SectionLabel>{google ? 'Or jump in as a sample student' : 'Sample students'}</SectionLabel>
        <ul className="flex flex-col gap-1.5">
          {DEMO_PERSONAS.map((persona) => (
            <li key={persona.id}>
              <ChoiceRow
                leading={<Initial name={persona.name} />}
                title={persona.name}
                subtitle={`${persona.campusLabel} · ${persona.line}`}
                onClick={() => onPick(persona.id)}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onPick(null)}
          className={swButton({ variant: 'surface', size: 'md', className: 'mt-3 w-full shrink-0' })}
        >
          Cancel
        </button>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 mt-3 text-[11px] font-bold text-slate">{children}</p>;
}

/** A round initial, as the demo avatar menu shows it. */
export function Initial({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded-full bg-royal-tint font-bold text-royal', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {(name.trim().charAt(0) || '?').toLocaleUpperCase()}
    </span>
  );
}

function ChoiceRow({
  leading,
  title,
  subtitle,
  onClick,
}: {
  leading: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="campus-press flex min-h-12 w-full items-center gap-2.5 rounded-[12px] bg-surface px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[12.5px] font-bold text-ink">{title}</span>
        <span className="truncate text-[11px] text-slate">{subtitle}</span>
      </span>
      <ChevronRightIcon size={14} className="shrink-0 text-slate" />
    </button>
  );
}

export default DemoAccountChooser;
