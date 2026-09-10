'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type PromoSlide = {
  eyebrow: string;
  title: string;
  sub: string;
  href: string;
};

const AUTO_ADVANCE_MS = 4000;
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

const PROMO_SLIDES: PromoSlide[] = [
  {
    eyebrow: 'print',
    title: 'PRINTS READY IN MINUTES',
    sub: 'Upload PDFs, pick up nearby',
    href: '/upload',
  },
  {
    eyebrow: 'market place',
    title: 'PRE-LOVED FINDS ON CAMPUS',
    sub: 'Books, tech & more',
    href: '/marketplace',
  },
  {
    eyebrow: 'housing',
    title: 'ROOMS & ROOMMATES',
    sub: 'Find your next stay',
    href: '/housing',
  },
];

export function AnnouncementCarousel({ heightClass = 'h-24', outerClassName = 'px-[5px] mt-3', backgroundClass = '' }: { heightClass?: string; outerClassName?: string; backgroundClass?: string }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const touchX = useRef<number | null>(null);
  const count = PROMO_SLIDES.length;

  const go = (d: 1 | -1) => {
    setDir(d);
    setIndex((prev) => (prev + d + count) % count);
  };

  useEffect(() => {
    const id = setInterval(() => {
      setDir(1);
      setIndex((prev) => (prev + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [count]);

  return (
    <div
      className={outerClassName}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className={`relative ${heightClass} w-full overflow-hidden rounded-[24px] ${backgroundClass}`}>
        {PROMO_SLIDES.map((slide, i) => {
          const active = i === index;
          return (
            <Link
              key={slide.title}
              href={slide.href}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
              className={`absolute inset-0 bg-royal overflow-hidden transition-all duration-500 ${EASE} ${active ? 'opacity-100 z-[1] translate-x-0 scale-100' : `opacity-0 pointer-events-none scale-[0.985] ${dir === 1 ? 'translate-x-8' : '-translate-x-8'}`}`}
            >
              {/* soft glow */}
              <span className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-white/15 blur-2xl" aria-hidden />

              <span className="relative flex h-full flex-col justify-between p-5">
                <span className={`font-coolvetica text-[13px] tracking-[0.02em] text-white/70 transition-all duration-500 ${EASE} ${active ? 'opacity-100 translate-y-0 delay-100' : 'opacity-0 translate-y-2'}`}>{slide.eyebrow}</span>
                <span>
                  <span className={`block font-poster text-white text-[30px] leading-[1.0] tracking-[0.01em] transition-all duration-500 ${EASE} ${active ? 'opacity-100 translate-y-0 delay-150' : 'opacity-0 translate-y-3'}`}>{slide.title}</span>
                  <span className={`mt-2 flex items-center gap-2 transition-all duration-500 ${EASE} ${active ? 'opacity-100 translate-y-0 delay-200' : 'opacity-0 translate-y-2'}`}>
                    <span className="text-[12px] font-semibold text-white/75">{slide.sub}</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                      <ArrowRight size={14} strokeWidth={2.5} className="text-white" />
                    </span>
                  </span>
                </span>
              </span>
            </Link>
          );
        })}

        {/* dots */}
        <div className="absolute bottom-3.5 left-5 z-10 flex gap-1.5">
          {PROMO_SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => { setDir(i === index ? dir : i > index ? 1 : -1); setIndex(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default AnnouncementCarousel;
