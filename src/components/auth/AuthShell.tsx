import Link from 'next/link';
import type { ReactNode } from 'react';
import { SwoopLogo } from '@/components/swoop/Logo';
import { cn } from '@/lib/utils/cn';

/**
 * Full-screen white auth layout (no app header or dock): tape logo on top, then an optional
 * Bricolage hero title + one-line slate subtitle, the form, and a small legal footer.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer = true,
  className
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: boolean;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
      <div className="self-start">
        <SwoopLogo size={28} />
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

      {footer && (
        <p className="pt-6 text-[11px] leading-[1.45] text-slate">
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
  );
}
