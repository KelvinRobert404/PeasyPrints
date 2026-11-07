import Link from 'next/link';
import type { ReactNode } from 'react';
import { SwoopLogo } from '@/components/swoop/Logo';
import { BackIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { IconButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

/** Where the student is in a multi-step flow. `current` is 0-based. */
export type AuthSteps = { current: number; total: number };

/**
 * Full-screen white auth layout (no app header or dock): an optional back button, the tape
 * logo and step dots on top, then an optional Bricolage hero title + one-line slate subtitle,
 * the form, the trust line and a small legal footer. Content keeps a phone-width column.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  onBack,
  steps,
  footer = true,
  className
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Shows a back button before the logo. */
  onBack?: () => void;
  /** Shows step dots on the right of the top row. */
  steps?: AuthSteps;
  footer?: boolean;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
        <div className="flex min-h-8 items-center gap-2.5">
          {onBack && <IconButton label="Back" icon={BackIcon} onClick={onBack} />}
          <SwoopLogo size={28} />
          {steps && steps.total > 1 && <StepDots steps={steps} />}
        </div>

        <main className={cn('flex w-full flex-1 flex-col pt-9', className)}>
          {(title || subtitle) && (
            <div className="mb-5">
              {title && <h1 className="font-heading text-[20px] leading-[1.1] text-ink">{title}</h1>}
              {subtitle && <p className="mt-1 text-[12.5px] leading-[1.4] text-slate">{subtitle}</p>}
            </div>
          )}
          {children}
        </main>

        <p className="flex items-center gap-1.5 pt-6 text-[11.5px] font-bold text-ink">
          <ShieldCheckIcon size={14} className="shrink-0 text-royal" />
          Only verified students. Never a fee.
        </p>

        {footer && (
          <p className="pt-1.5 text-[11px] leading-[1.45] text-slate">
            By continuing you agree to our{' '}
            <Link href="/terms" className="font-bold text-ink underline-offset-2 hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-bold text-ink underline-offset-2 hover:underline">
              Privacy policy
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function StepDots({ steps }: { steps: AuthSteps }) {
  const current = Math.min(Math.max(steps.current, 0), steps.total - 1);
  return (
    <div className="ml-auto flex items-center gap-1">
      <span className="sr-only">
        Step {current + 1} of {steps.total}
      </span>
      {Array.from({ length: steps.total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'h-1.5 rounded-full transition-all',
            i === current ? 'w-4 bg-royal' : i < current ? 'w-1.5 bg-royal/40' : 'w-1.5 bg-line'
          )}
        />
      ))}
    </div>
  );
}
