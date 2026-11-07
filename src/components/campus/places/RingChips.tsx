'use client';

import { useState } from 'react';
import { DEFAULT_RING, DISTANCE_RINGS, formatDistance, type DistanceRing } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';

const CHIP =
  'campus-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40';

type Props = {
  value?: DistanceRing;
  defaultValue?: DistanceRing;
  onChange?: (ring: DistanceRing) => void;
  label?: string;
  className?: string;
};

/** '500 m / 1 km / 2 km' distance chips. Starts at 1 km. */
export function RingChips({ value, defaultValue = DEFAULT_RING, onChange, label = 'Distance from campus', className }: Props) {
  const [inner, setInner] = useState<DistanceRing>(defaultValue);
  const current = value ?? inner;

  const pick = (ring: DistanceRing) => {
    if (value === undefined) setInner(ring);
    onChange?.(ring);
  };

  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {DISTANCE_RINGS.map((ring) => {
        const selected = ring === current;
        return (
          <button
            key={ring}
            type="button"
            aria-pressed={selected}
            onClick={() => pick(ring)}
            className={cn(CHIP, selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink')}
          >
            {formatDistance(ring)}
          </button>
        );
      })}
    </div>
  );
}
