'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils/cn';
import { Tag } from '@/components/swoop/primitives';
import { ArrowRightIcon, HousingIcon, MarketIcon, PrintIcon, type IconProps } from '@/components/swoop/icons';

type PromoSlide = {
  eyebrow: string;
  title: string;
  sub: string;
  href: string;
  /** Art block colour; there are no photos for these promos yet. */
  tone: 'royal' | 'ink' | 'surface';
  icon: ComponentType<IconProps>;
};

const PROMO_SLIDES: PromoSlide[] = [
  {
    eyebrow: 'Print',
    title: 'Prints ready in minutes',
    sub: 'Upload PDFs, pick up nearby',
    href: '/upload',
    tone: 'royal',
    icon: PrintIcon
  },
  {
    eyebrow: 'Marketplace',
    title: 'Pre-loved finds on campus',
    sub: 'Books, tech & more',
    href: '/marketplace',
    tone: 'ink',
    icon: MarketIcon
  },
  {
    eyebrow: 'Housing',
    title: 'Rooms & roommates',
    sub: 'Find your next stay',
    href: '/housing',
    tone: 'surface',
    icon: HousingIcon
  }
];

const TONES = {
  royal: { block: 'bg-royal', icon: 'text-white/90', tag: 'white' },
  ink: { block: 'bg-ink', icon: 'text-royal-soft', tag: 'royal' },
  surface: { block: 'bg-surface', icon: 'text-royal', tag: 'ink' }
} as const;

/** Horizontally scrolling 200px announcement cards (Home). */
export function AnnouncementCarousel({ className }: { className?: string }) {
  return (
    <div className={cn('no-scrollbar flex snap-x gap-2 overflow-x-auto scroll-px-3 px-3', className)}>
      {PROMO_SLIDES.map((slide) => {
        const tone = TONES[slide.tone];
        const Icon = slide.icon;
        return (
          <Link key={slide.href} href={slide.href} className="campus-press flex w-[200px] shrink-0 snap-start flex-col gap-0.5 text-ink">
            <span className={cn('relative mb-1 block h-[88px] overflow-hidden rounded-[14px]', tone.block)}>
              <Tag tone={tone.tag} className="absolute left-2 top-2">
                {slide.eyebrow}
              </Tag>
              <Icon size={44} className={cn('absolute bottom-2 right-2.5', tone.icon)} />
            </span>
            <span className="flex min-w-0 items-center gap-[3px]">
              <span className="font-heading truncate text-[12.5px] leading-[1.15]">{slide.title}</span>
              <ArrowRightIcon size={12} className="shrink-0" />
            </span>
            <span className="truncate text-[11px] text-slate">{slide.sub}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default AnnouncementCarousel;
