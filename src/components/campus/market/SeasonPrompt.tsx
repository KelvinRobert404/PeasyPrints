// Seasonal market prompt: moving out (Apr-May) or setting up a room (Jun-Aug).
// The caller picks the prompt with seasonalPrompt(now). No hooks.

import Link from 'next/link';
import type { ComponentType } from 'react';
import { MovingOutArt, SetUpRoomArt, type IllustrationProps } from '@/components/swoop/illustrations';
import type { SeasonalPrompt } from '@/lib/campus/season';
import { cn } from '@/lib/utils/cn';

// Same look as swButton({ size: 'sm' }); primitives is a client module, so its
// cva helper cannot be called while this renders on the server.
const BUTTON =
  'campus-press inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 bg-royal text-white hover:bg-primary-dark';

interface PromptCopy {
  title: string;
  body: string | null;
  action: string;
  href: string;
  art: ComponentType<IllustrationProps>;
}

const COPY: Record<SeasonalPrompt, PromptCopy> = {
  moving_out: {
    title: 'Moving out?',
    body: 'Clear your room in one post.',
    action: 'Post a bundle',
    href: '/marketplace/new?kind=bundle',
    art: MovingOutArt,
  },
  set_up_room: {
    title: 'Set up your room for less.',
    body: 'Room things from students nearby.',
    action: 'See things near you',
    href: '/marketplace/all/near-you',
    art: SetUpRoomArt,
  },
};

/** Renders nothing when `prompt` is null (out of season). */
export function SeasonPrompt({
  prompt,
  href,
  className,
}: {
  prompt: SeasonalPrompt | null;
  /** Overrides where the button goes. */
  href?: string;
  className?: string;
}) {
  if (!prompt) return null;
  const copy = COPY[prompt];
  const Art = copy.art;
  return (
    <section className={cn('relative flex min-h-[96px] items-center gap-2 overflow-hidden rounded-[14px] bg-royal-tint py-2.5 pl-3 pr-1', className)}>
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">{copy.title}</h2>
        {copy.body ? <p className="mt-0.5 text-[11.5px] font-semibold text-text-secondary">{copy.body}</p> : null}
        <Link href={href ?? copy.href} className={cn(BUTTON, 'mt-2')}>
          {copy.action}
        </Link>
      </div>
      <Art width={88} height={81} className="shrink-0" />
    </section>
  );
}
