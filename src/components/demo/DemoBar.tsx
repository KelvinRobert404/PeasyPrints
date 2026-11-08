'use client';

// The always-visible demo bar. Under 1024 px: a 36 px ink strip at the very
// top (Demo, student chip, date chip, Reset demo); globals.css pads the body by
// --demo-bar-h so nothing sits under it. From 1024 px: a fixed panel left of
// the centred column instead, and no strip. DemoRoot mounts it, demo only.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ComponentType, type ReactNode } from 'react';
import { resetDemo } from '@/lib/demo/client/reset';
import { DemoSheet, PersonaChoices, PersonaPicker, useDemoStudentLabel } from '@/components/demo/PersonaPicker';
import { DemoDateChips, DemoDatePicker, demoDateLabel, useDemoDate } from '@/components/demo/DemoDatePicker';
import { CaretDownIcon, HomeIcon, HousingIcon, MarketIcon, OrdersIcon, PrintIcon, SparklesIcon, type IconProps } from '@/components/swoop/icons';
import { Tag, swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

type Sheet = 'student' | 'date' | 'reset' | null;

const SCREENS: { label: string; href: string; icon: ComponentType<IconProps>; match: (path: string) => boolean }[] = [
  { label: 'Demo start', href: '/demo', icon: SparklesIcon, match: (p) => p === '/demo' || p.startsWith('/demo/') },
  { label: 'Home', href: '/', icon: HomeIcon, match: (p) => p === '/' },
  { label: 'Print', href: '/upload', icon: PrintIcon, match: (p) => p.startsWith('/upload') || p.startsWith('/shops') },
  { label: 'Market', href: '/marketplace', icon: MarketIcon, match: (p) => p.startsWith('/marketplace') },
  { label: 'Housing', href: '/housing', icon: HousingIcon, match: (p) => p.startsWith('/housing') },
  { label: 'Orders', href: '/orders', icon: OrdersIcon, match: (p) => p.startsWith('/orders') },
];

export function DemoBar() {
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  return (
    <>
      <DemoStrip onOpen={setSheet} />
      <DemoPanel onReset={() => setSheet('reset')} />
      {sheet === 'student' ? <PersonaPicker onClose={close} /> : null}
      {sheet === 'date' ? <DemoDatePicker onClose={close} /> : null}
      {sheet === 'reset' ? <ResetConfirm onClose={close} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Narrow: the top strip

function DemoStrip({ onOpen }: { onOpen: (sheet: Sheet) => void }) {
  const student = useDemoStudentLabel();
  const date = useDemoDate();
  const [now] = useState(() => new Date());

  return (
    <div
      role="region"
      aria-label="Demo controls"
      className="fixed inset-x-0 top-0 z-[45] flex h-9 items-center gap-1.5 bg-ink px-3 text-white lg:hidden"
    >
      <Tag tone="royal" className="shrink-0">
        Demo
      </Tag>
      <StripChip label="Change student" onClick={() => onOpen('student')} className="min-w-0">
        <span className="truncate">{student ?? 'Loading…'}</span>
      </StripChip>
      <StripChip label="Change demo date" onClick={() => onOpen('date')} className="shrink-0">
        {date ? demoDateLabel(date, now) : '…'}
      </StripChip>
      <button
        type="button"
        onClick={() => onOpen('reset')}
        className="campus-press ml-auto h-[26px] shrink-0 whitespace-nowrap rounded-full px-1.5 text-[11.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-soft"
      >
        Reset demo
      </button>
    </div>
  );
}

function StripChip({ label, onClick, className, children }: { label: string; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-haspopup="dialog"
      onClick={onClick}
      className={cn(
        'campus-press flex h-[26px] items-center gap-1 rounded-full bg-white/12 px-2.5 text-[11.5px] font-semibold text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-soft',
        className,
      )}
    >
      {children}
      <CaretDownIcon size={12} aria-hidden="true" className="shrink-0 text-white/70" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Wide: the left panel, outside the centred 428 px column

function DemoPanel({ onReset }: { onReset: () => void }) {
  const pathname = usePathname() ?? '/';

  return (
    <aside
      aria-label="Demo controls"
      className="fixed left-4 top-4 z-[45] hidden max-h-[calc(100dvh-88px)] w-[248px] flex-col overflow-y-auto overflow-x-hidden rounded-[14px] border border-line bg-white p-3 shadow-[0_1px_3px_rgba(16,24,40,0.10)] lg:flex"
    >
      <div className="flex items-center gap-1.5">
        <h2 className="min-w-0 truncate font-heading text-[16px] leading-[1.15] text-ink">Swoop demo</h2>
        <Tag tone="royal">Demo</Tag>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-[1.4] text-slate">Sample data. Nothing is real.</p>

      <PanelLabel>Student</PanelLabel>
      <PersonaChoices compact />

      <PanelLabel>Demo date</PanelLabel>
      <DemoDateChips />

      <PanelLabel>Screens</PanelLabel>
      <nav aria-label="Demo screens">
        <ul className="grid grid-cols-2 gap-1">
          {SCREENS.map((screen) => {
            const active = screen.match(pathname);
            const Icon = screen.icon;
            return (
              <li key={screen.href}>
                <Link
                  href={screen.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'campus-press flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[12px] font-semibold',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40',
                    active ? 'bg-royal-tint text-royal' : 'bg-surface text-ink',
                  )}
                >
                  <Icon size={14} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{screen.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-3 border-t border-line pt-3">
        <button type="button" onClick={onReset} className={swButton({ variant: 'surface', size: 'sm', className: 'w-full' })}>
          Reset demo
        </button>
      </div>
    </aside>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 mt-3 text-[11px] font-bold text-slate">{children}</h3>;
}

// ---------------------------------------------------------------------------
// Reset

function ResetConfirm({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await resetDemo();
      // Success opens /demo; keep the button locked until it loads.
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not reset the demo.');
      setBusy(false);
    }
  };

  return (
    <DemoSheet title="Clear your changes and start over?" line="Back to the sample data, signed out." onClose={busy ? () => undefined : onClose}>
      {error ? (
        <p role="alert" className="mt-2 rounded-[10px] bg-market-tint px-2.5 py-1.5 text-[11.5px] font-semibold text-market">
          {error}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={onClose} disabled={busy} className={swButton({ variant: 'surface', size: 'md' })}>
          Cancel
        </button>
        <button type="button" onClick={() => void reset()} disabled={busy} aria-busy={busy} className={swButton({ variant: 'ink', size: 'md' })}>
          {busy ? 'Resetting…' : 'Reset demo'}
        </button>
      </div>
    </DemoSheet>
  );
}

export default DemoBar;
