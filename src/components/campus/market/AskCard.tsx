// 'Any {q} available?' card with an 'Ask KJU' button, for a search with no
// hits. No hooks, so it renders on the server too.

import Link from 'next/link';
import { HandIcon } from '@/components/swoop/icons';
import { cn } from '@/lib/utils/cn';
import { RowIconTile } from './PassRow';

// Same look as swButton({ size: 'sm' }); primitives is a client module, so its
// cva helper cannot be called while this renders on the server.
const BUTTON =
  'campus-press inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 bg-royal text-white hover:bg-primary-dark';

/** Default place 'Ask' goes: a new wanted post with the search as its title. */
export function askHref(q: string): string {
  const title = q.trim();
  return title ? `/marketplace/new?kind=wanted&q=${encodeURIComponent(title)}` : '/marketplace/new?kind=wanted';
}

/**
 * One-tap ask. `code` is the college code from the session, e.g. 'KJU',
 * so the button reads 'Ask KJU'.
 */
export function AskCard({
  q,
  code,
  href,
  className,
}: {
  /** What the student searched for, e.g. 'mini fridge'. */
  q: string;
  code: string;
  /** Defaults to askHref(q). */
  href?: string;
  className?: string;
}) {
  const thing = q.trim().replace(/\s+/g, ' ').replace(/\?+$/, '');
  return (
    <article className={cn('flex min-w-0 items-center gap-2.5 rounded-[14px] bg-surface p-2.5', className)}>
      <RowIconTile icon={HandIcon} />
      <div className="min-w-0 flex-1">
        <p className="font-heading line-clamp-2 text-[13px] leading-[1.15] text-ink">{thing ? `Any ${thing} available?` : 'Need something?'}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-slate">Students near you will see it.</p>
      </div>
      <Link href={href ?? askHref(thing)} className={cn(BUTTON, 'shrink-0')}>
        Ask {code}
      </Link>
    </article>
  );
}
