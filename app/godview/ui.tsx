import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Tag } from '@/components/swoop/primitives';
import type { IconProps } from '@/components/swoop/icons';

/* ──────────────────────────────────────────────────────────
   Godview presentation helpers (desktop admin, dense).
   Built on the Swoop v1 tokens: white ground, line dividers,
   surface inputs/headers, royal for action, ink text.
   ────────────────────────────────────────────────────────── */

/** Surface input, 36px, for dense admin forms. Add `bg-white` when the input sits on a surface tile. */
export const gvInput =
  'h-9 w-full rounded-[10px] border border-transparent bg-surface px-3 text-[12.5px] font-semibold text-ink outline-none transition-[border-color,background-color,box-shadow] placeholder:font-medium placeholder:text-slate focus-visible:border-royal focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-royal/15 disabled:opacity-50';

export const gvTextarea =
  'w-full rounded-[10px] border border-transparent bg-surface p-3 text-[12px] font-medium text-ink outline-none transition-[border-color,background-color,box-shadow] placeholder:text-slate focus-visible:border-royal focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-royal/15';

export const gvLabel = 'mb-1 block text-[11px] font-bold text-text-secondary';

/** Card shell. */
export const gvCard = 'rounded-[14px] border border-line bg-white';

/** Table header row cells (apply to the header row container). */
export const gvTableHead = 'border-b border-line bg-surface text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-slate';

/** Table body row (apply to each row container). */
export const gvRow = 'border-b border-line text-[12.5px] text-ink last:border-b-0';

/** Small square icon-only button used inside rows. Always pair with aria-label. */
export const gvIconBtn =
  'campus-press grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-slate transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 disabled:pointer-events-none disabled:opacity-35';

/** Dropdown menu surface + items (shared ui menu has no popover token). */
export const gvMenu = 'rounded-[12px] border border-line bg-white p-1 text-ink shadow-[0_8px_24px_rgba(16,24,40,0.12)]';
export const gvMenuItem = 'gap-2 rounded-[8px] px-2 py-1.5 text-[12px] font-semibold text-ink focus:bg-surface focus:text-ink';

/* Page heading -------------------------------------------- */
export function PageHead({
  title,
  kicker,
  description,
  actions,
  className
}: {
  title: ReactNode;
  kicker?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3 pb-3', className)}>
      <div className="min-w-0">
        {kicker && <p className="text-[10.5px] font-semibold text-slate">{kicker}</p>}
        <h1 className="font-heading text-[16px] leading-[1.1] text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-[12px] text-slate">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* Section title (14.5px) ---------------------------------- */
export function SectionTitle({ children, meta, className }: { children: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <h2 className={cn('flex items-baseline gap-1.5 font-heading text-[14.5px] leading-[1.1] text-ink', className)}>
      {children}
      {meta !== undefined && <span className="font-sans text-[12px] font-bold text-slate tabular-nums">{meta}</span>}
    </h2>
  );
}

/* Spinner -------------------------------------------------- */
export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-royal', className)}
    />
  );
}

/* Loading / empty block inside a table card ---------------- */
export function TableState({
  icon: Icon,
  title,
  body,
  loading,
  className
}: {
  icon?: ComponentType<IconProps>;
  title?: ReactNode;
  body?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex h-40 flex-col items-center justify-center gap-1.5 px-4 text-center', className)}>
      {loading ? (
        <Spinner />
      ) : (
        <>
          {Icon && <Icon size={24} className="text-text-muted" />}
          {title && <p className="text-[12.5px] font-bold text-ink">{title}</p>}
          {body && <p className="text-[11.5px] text-slate">{body}</p>}
        </>
      )}
    </div>
  );
}

/* Status tag ----------------------------------------------- */
export type StatusTone = 'go' | 'slate' | 'market' | 'royal' | 'girls';

const STATUS_TONES: Record<StatusTone, string> = {
  go: 'bg-go-tint text-go-text',
  slate: 'bg-surface text-slate',
  market: 'bg-market-tint text-market',
  royal: 'bg-royal-tint text-royal',
  girls: 'bg-girls-tint text-girls'
};

export function StatusTag({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <Tag tone="go" className={cn('gap-1 px-2 py-[3px] text-[9.5px]', STATUS_TONES[tone], className)}>
      {children}
    </Tag>
  );
}

/* Stat tile (admin exception: big heading number) ---------- */
export function StatTile({
  label,
  value,
  dot,
  className
}: {
  label: ReactNode;
  value: ReactNode;
  dot?: 'royal' | 'market' | 'go';
  className?: string;
}) {
  const dots = { royal: 'bg-royal', market: 'bg-market', go: 'bg-go' };
  return (
    <div className={cn(gvCard, 'px-3.5 py-3', className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate">
        {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[dot])} />}
        {label}
      </p>
      <p className="mt-1 font-heading text-[22px] leading-none text-ink tabular-nums">{value}</p>
    </div>
  );
}
