'use client';

import Link from 'next/link';
import { forwardRef, type ComponentType, type InputHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import { BackIcon, ChevronRightIcon, SearchIcon, type IconProps } from '@/components/swoop/icons';

/* ──────────────────────────────────────────────────────────
   Swoop design system v1 primitives. Mini + dense, white ground.
   Read src/components/swoop/README.md before building screens.
   ────────────────────────────────────────────────────────── */

/* Buttons ------------------------------------------------- */
export const swButton = cva(
  'campus-press inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-bold transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40',
  {
    variants: {
      variant: {
        primary: 'bg-royal text-white hover:bg-primary-dark',
        ink: 'bg-ink text-white hover:bg-ink/90',
        surface: 'bg-surface text-ink hover:bg-line',
        white: 'bg-white text-ink shadow-[0_1px_3px_rgba(16,24,40,0.10)]',
        ghost: 'text-ink hover:bg-surface',
        danger: 'bg-market-tint text-market hover:bg-market/15'
      },
      size: {
        sm: 'h-8 rounded-[9px] px-3 text-[12px]',
        md: 'h-10 rounded-[10px] px-4 text-[13px]',
        lg: 'h-12 rounded-[12px] px-5 text-[14px]',
        pill: 'h-8 rounded-full px-3 text-[12px]',
        icon: 'h-9 w-9 rounded-full'
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);
export type SwButtonVariants = VariantProps<typeof swButton>;

/* Section header: "Print anything ........ See all" -------- */
export function SectionHeader({
  title,
  kicker,
  action,
  className
}: {
  title: ReactNode;
  kicker?: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {kicker && <p className="text-[10.5px] font-semibold text-slate">{kicker}</p>}
        <h2 className="font-heading truncate text-[14.5px] leading-[1.1] text-ink">{title}</h2>
      </div>
      {action &&
        (action.href ? (
          <Link href={action.href} className="flex min-h-6 shrink-0 items-center text-[12px] font-bold text-ink">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="flex min-h-6 shrink-0 items-center text-[12px] font-bold text-ink">
            {action.label}
          </button>
        ))}
    </div>
  );
}

/* Page header for sub screens: back · kicker/title · actions */
export function PageHeader({
  title,
  kicker,
  backHref = '/',
  onBack,
  actions,
  className
}: {
  title: ReactNode;
  kicker?: ReactNode;
  backHref?: string;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
}) {
  const backClass = 'campus-press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-ink';
  return (
    <header className={cn('flex min-h-[44px] items-center gap-2 px-3 pt-1.5', className)}>
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Go back" className={backClass}>
          <BackIcon size={15} />
        </button>
      ) : (
        <Link href={backHref} aria-label="Go back" className={backClass}>
          <BackIcon size={15} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {kicker && <p className="truncate text-[10.5px] font-semibold text-slate">{kicker}</p>}
        <h1 className="font-heading truncate text-[16px] leading-[1.05] text-ink">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}

/* Round icon button (surface) */
export function IconButton({
  label,
  icon: Icon,
  href,
  onClick,
  badge,
  className
}: {
  label: string;
  icon: ComponentType<IconProps>;
  href?: string;
  onClick?: () => void;
  badge?: number;
  className?: string;
}) {
  const inner = (
    <>
      <Icon size={15} />
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-royal px-1 text-center text-[9px] font-extrabold leading-4 text-white tabular-nums">
          {badge}
        </span>
      ) : null}
    </>
  );
  const cls = cn('campus-press relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-ink', className);
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* Search pill ---------------------------------------------- */
export const SearchPill = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { trailing?: ReactNode; big?: boolean; wrapperClassName?: string }
>(function SearchPill({ trailing, big = false, wrapperClassName, className, ...props }, ref) {
  return (
    <label className={cn('flex h-[42px] items-center gap-2 rounded-full bg-surface pl-[13px] pr-[5px]', wrapperClassName)}>
      <SearchIcon size={16} className="shrink-0 text-ink" />
      <input
        ref={ref}
        type="search"
        className={cn(
          'min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink',
          big ? 'font-heading text-[15.5px] placeholder:opacity-100' : 'text-[13px] font-semibold placeholder:font-medium placeholder:text-slate',
          className
        )}
        {...props}
      />
      {trailing}
    </label>
  );
});

/* Chips ----------------------------------------------------- */
export function Chip({
  selected = false,
  children,
  onClick,
  className
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'campus-press flex h-[26px] shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] transition-colors',
        selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink',
        className
      )}
    >
      {children}
    </button>
  );
}

/* Segmented control ---------------------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-0.5 rounded-[10px] bg-surface p-[3px]', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 rounded-lg text-[12px] capitalize transition-colors',
              active ? 'bg-white font-bold text-ink shadow-[0_1px_3px_rgba(16,24,40,0.12)]' : 'font-semibold text-text-secondary'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* Caps tag (SELL / EXAM WEEK) ------------------------------- */
export function Tag({ children, tone = 'ink', className }: { children: ReactNode; tone?: 'ink' | 'royal' | 'white' | 'go'; className?: string }) {
  const tones = {
    ink: 'bg-ink/85 text-white',
    royal: 'bg-royal text-white',
    white: 'bg-white text-ink',
    go: 'bg-go-tint text-go-text'
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.06em]', tones[tone], className)}>
      {children}
    </span>
  );
}

/* Status dot line: ● Open • Ready by 4:30 PM ----------------- */
export function StatusLine({ open, label, detail }: { open: boolean; label: string; detail?: ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-[11.5px] font-bold">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', open ? 'bg-go' : 'bg-text-muted')} />
      <span className={open ? 'text-go-text' : 'text-text-secondary'}>{label}</span>
      {detail && (
        <>
          <span className="text-text-muted">•</span>
          <span className="truncate text-ink">{detail}</span>
        </>
      )}
    </span>
  );
}

/* Icon in a round/square tinted holder ---------------------- */
export function IconTile({
  icon: Icon,
  tone = 'surface',
  shape = 'circle',
  size = 32,
  iconSize,
  className
}: {
  icon: ComponentType<IconProps>;
  tone?: 'surface' | 'royal' | 'go' | 'canteen' | 'market' | 'girls' | 'ink';
  shape?: 'circle' | 'square';
  size?: number;
  iconSize?: number;
  className?: string;
}) {
  const tones = {
    surface: 'bg-surface text-ink',
    royal: 'bg-royal-tint text-royal',
    go: 'bg-go-tint text-go-text',
    canteen: 'bg-canteen-tint text-canteen',
    market: 'bg-market-tint text-market',
    girls: 'bg-girls-tint text-girls',
    ink: 'bg-ink text-white'
  };
  return (
    <span
      className={cn('grid shrink-0 place-items-center', shape === 'circle' ? 'rounded-full' : 'rounded-[10px]', tones[tone], className)}
      style={{ width: size, height: size }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.5)} />
    </span>
  );
}

/* List row with inset divider -------------------------------- */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  divider = true,
  className
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  divider?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {leading && <span className="grid place-items-center py-1.5">{leading}</span>}
      <span className={cn('flex min-h-12 min-w-0 flex-1 items-center gap-1.5', divider && 'border-b border-line')}>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[12.5px] font-bold text-ink">{title}</span>
          {subtitle && <span className="truncate text-[11px] text-slate">{subtitle}</span>}
        </span>
        {trailing ?? (href || onClick ? <ChevronRightIcon size={12} className="shrink-0 text-text-muted" /> : null)}
      </span>
    </>
  );
  const cls = cn('flex items-stretch gap-2.5 text-left text-ink', className);
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'w-full')}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/* Service tiles --------------------------------------------- */
export function ServiceTile({
  title,
  subtitle,
  href,
  tone = 'surface',
  art,
  className
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href: string;
  tone?: 'royal' | 'surface';
  art?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'campus-press relative flex h-[74px] flex-col gap-px overflow-hidden rounded-[14px] px-2.5 py-[9px]',
        tone === 'royal' ? 'bg-royal text-white' : 'bg-surface text-ink',
        className
      )}
    >
      <span className="font-heading text-[14.5px] leading-[1.05]">{title}</span>
      {subtitle && (
        <span className={cn('text-[10.5px] font-semibold', tone === 'royal' ? 'text-white/80' : 'text-slate')}>{subtitle}</span>
      )}
      {art && <span className="pointer-events-none absolute bottom-1.5 right-2">{art}</span>}
    </Link>
  );
}

export function SmallTile({
  label,
  href,
  icon: Icon,
  tone = 'ink',
  badge,
  className
}: {
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
  tone?: 'ink' | 'royal' | 'canteen' | 'market' | 'girls';
  badge?: string;
  className?: string;
}) {
  const tones = { ink: 'text-ink', royal: 'text-royal', canteen: 'text-canteen', market: 'text-market', girls: 'text-girls' };
  return (
    <Link href={href} className={cn('campus-press relative flex flex-col items-center gap-1 text-ink', className)}>
      <span className={cn('grid h-[52px] w-full place-items-center rounded-[12px] bg-surface', tones[tone])}>
        <Icon size={24} />
      </span>
      {badge && (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-royal px-1.5 text-[9px] font-extrabold leading-[15px] text-white">
          {badge}
        </span>
      )}
      <span className="whitespace-nowrap text-[11px] font-bold">{label}</span>
    </Link>
  );
}

/* Empty state ------------------------------------------------ */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className
}: {
  icon: ComponentType<IconProps>;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-[14px] bg-surface px-5 py-7 text-center', className)}>
      <Icon size={28} className="text-text-muted" />
      <p className="font-heading text-[14px] text-ink">{title}</p>
      {body && <p className="max-w-[260px] text-[11.5px] leading-[1.45] text-slate">{body}</p>}
      {action}
    </div>
  );
}

/* Card shell (white, line border) --------------------------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-[14px] border border-line bg-white', className)}>{children}</div>;
}
