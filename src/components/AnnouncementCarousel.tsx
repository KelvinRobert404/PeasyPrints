'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils/cn';
import { ArrowRightIcon } from '@/components/swoop/icons';
import {
  ExamPrintArt,
  HousingArt,
  MarketArt,
  MovingOutArt,
  NextSemRoomArt,
  PrinterArt,
  SetUpRoomArt,
  type IllustrationProps
} from '@/components/swoop/illustrations';
import type { HomeSeasonalSlot, HomeSeasonalSlotId } from '@/lib/campus/season';

type Slide = {
  key: string;
  title: string;
  sub: string;
  href: string;
  /** Art block colour. Swoop draws its own art: no photos. */
  tone: 'royal' | 'surface' | 'tint';
  art: ComponentType<IllustrationProps>;
};

const PROMO_SLIDES: readonly Slide[] = [
  {
    key: 'print',
    title: 'Prints ready in minutes',
    sub: 'Upload, pick up nearby',
    href: '/upload',
    tone: 'royal',
    art: PrinterArt
  },
  {
    key: 'market',
    title: 'Pre-loved finds on campus',
    sub: 'Books, tech and more',
    href: '/marketplace',
    tone: 'surface',
    art: MarketArt
  },
  {
    key: 'housing',
    title: 'Rooms and roommates',
    sub: 'Find your next stay',
    href: '/housing',
    tone: 'tint',
    art: HousingArt
  }
];

/** Art and second line for each seasonal slot; the title and link come from season.ts. */
const SEASONAL: Record<HomeSeasonalSlotId, { sub: string; tone: Slide['tone']; art: ComponentType<IllustrationProps> }> = {
  exams: { sub: 'Upload, pick up nearby', tone: 'tint', art: ExamPrintArt },
  moving_out: { sub: 'One post for all your stuff', tone: 'surface', art: MovingOutArt },
  set_up_room: { sub: 'Second-hand finds near you', tone: 'tint', art: SetUpRoomArt },
  next_sem_room: { sub: 'Rooms near campus', tone: 'surface', art: NextSemRoomArt }
};

const TONES: Record<Slide['tone'], string> = {
  royal: 'bg-royal',
  surface: 'bg-surface',
  tint: 'bg-royal-tint'
};

function seasonalSlide(slot: HomeSeasonalSlot): Slide {
  const meta = SEASONAL[slot.id];
  return { key: `season-${slot.id}`, title: slot.title, sub: meta.sub, href: slot.href, tone: meta.tone, art: meta.art };
}

/** Horizontally scrolling 200px cards on Home: the seasonal card first, then the promos. */
export function AnnouncementCarousel({ seasonal, className }: { seasonal?: HomeSeasonalSlot | null; className?: string }) {
  const slides = seasonal ? [seasonalSlide(seasonal), ...PROMO_SLIDES] : PROMO_SLIDES;
  return (
    <div className={cn('no-scrollbar flex snap-x gap-2 overflow-x-auto scroll-px-3 px-3', className)}>
      {slides.map((slide) => {
        const Art = slide.art;
        return (
          <Link
            key={slide.key}
            href={slide.href}
            data-slide={slide.key}
            className="campus-press flex w-[200px] shrink-0 snap-start flex-col gap-0.5 text-ink"
          >
            <span className={cn('relative mb-1 block h-[88px] overflow-hidden rounded-[14px]', TONES[slide.tone])}>
              <Art width={96} height={88} className="absolute bottom-0 right-2" />
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
