// Chips under the furnish tiles: Vehicles / Tickets / Trips / +.
// No hooks, so it renders on the server too.

import Link from 'next/link';
import type { ComponentType } from 'react';
import { CabIcon, PlusIcon, ScooterIcon, TicketIcon, type IconProps } from '@/components/swoop/icons';
import { ALSO_CHIPS, type AlsoChip, type AlsoChipId } from '@/lib/campus/market';
import { cn } from '@/lib/utils/cn';

const CHIP_ICONS: Record<AlsoChipId, ComponentType<IconProps>> = {
  vehicles: ScooterIcon,
  tickets: TicketIcon,
  trips: CabIcon,
  more: PlusIcon,
};

/** '/marketplace?kind=ticket,pass'. The + chip opens every kind. */
export function alsoChipHref(chip: AlsoChip, basePath = '/marketplace'): string {
  return chip.kinds.length ? `${basePath}?kind=${chip.kinds.join(',')}` : `${basePath}?kind=all`;
}

/** Row of 32 px link chips. `active` marks the chip the list is filtered to. */
export function AlsoChips({
  active,
  basePath = '/marketplace',
  className,
}: {
  active?: AlsoChipId | null;
  basePath?: string;
  className?: string;
}) {
  return (
    <nav aria-label="More kinds of posts" className={cn('flex min-w-0 flex-wrap gap-1.5', className)}>
      {ALSO_CHIPS.map((chip) => {
        const Icon = CHIP_ICONS[chip.id];
        const selected = chip.id === active;
        const symbol = chip.id === 'more';
        return (
          <Link
            key={chip.id}
            href={alsoChipHref(chip, basePath)}
            aria-label={symbol ? chip.ariaLabel : undefined}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'campus-press inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40',
              symbol ? 'w-8' : 'px-3',
              selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink',
            )}
          >
            <Icon size={symbol ? 14 : 15} aria-hidden="true" />
            {symbol ? null : chip.label}
          </Link>
        );
      })}
    </nav>
  );
}
