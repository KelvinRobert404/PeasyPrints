'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils/cn';
import { useDockStore, type DockSlot } from '@/lib/stores/dockStore';
import {
  CheckIcon,
  ClockIcon,
  HomeIcon,
  HousingIcon,
  MarketIcon,
  OrdersIcon,
  PlusIcon,
  PrintIcon,
  TicketIcon,
  type IconProps
} from '@/components/swoop/icons';

const tabs: { name: string; href: string; icon: ComponentType<IconProps>; match: (p: string) => boolean }[] = [
  { name: 'Home', href: '/', icon: HomeIcon, match: (p) => p === '/' },
  { name: 'Print', href: '/upload', icon: PrintIcon, match: (p) => p.startsWith('/upload') || p.startsWith('/shops') },
  { name: 'Market', href: '/marketplace', icon: MarketIcon, match: (p) => p.startsWith('/marketplace') || p.startsWith('/girls-space/marketplace') },
  { name: 'Housing', href: '/housing', icon: HousingIcon, match: (p) => p.startsWith('/housing') || p.startsWith('/girls-space/housing') },
  { name: 'Orders', href: '/orders', icon: OrdersIcon, match: (p) => p.startsWith('/orders') }
];

const slotIcons: Record<NonNullable<DockSlot['icon']>, ComponentType<IconProps>> = {
  check: CheckIcon,
  plus: PlusIcon,
  tag: MarketIcon,
  print: PrintIcon,
  clock: ClockIcon,
  ticket: TicketIcon
};

const slotTone: Record<NonNullable<DockSlot['tone']>, string> = {
  go: 'bg-go text-ink',
  royal: 'bg-royal text-white',
  white: 'bg-white text-ink'
};

/** Swoop's signature dock: an ink live slot (changes per screen) over a 5-tab bar. */
export function Dock() {
  const pathname = usePathname() ?? '/';
  const slot = useDockStore((s) => s.slot);

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[428px]">
      {slot && <DockLiveSlot slot={slot} />}
      <div className="grid h-[calc(52px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-white px-1 pb-[calc(5px+env(safe-area-inset-bottom))] pt-[3px]">
        {tabs.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn('flex flex-col items-center justify-center gap-px', active ? 'text-royal' : 'text-slate')}
            >
              <Icon size={20} />
              <span className={cn('text-[10px] leading-tight', active ? 'font-bold' : 'font-semibold')}>{t.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DockLiveSlot({ slot }: { slot: DockSlot }) {
  const Icon = slotIcons[slot.icon ?? 'check'];
  const href = slot.href ?? slot.action?.href ?? '#';
  return (
    <Link
      href={href}
      className="campus-press mx-2 mb-1.5 flex items-center gap-[7px] rounded-[13px] bg-ink py-[5px] pl-[7px] pr-[5px] text-white shadow-[0_8px_22px_rgba(16,24,40,0.28)]"
    >
      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-[9px]', slotTone[slot.tone ?? 'go'])}>
        <Icon size={15} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-heading truncate text-[12.5px] leading-[1.15]">{slot.title}</span>
        {slot.subtitle && <span className="truncate text-[10.5px] text-white/72">{slot.subtitle}</span>}
      </span>
      {slot.action && (
        <span className="flex h-[30px] shrink-0 items-center rounded-[9px] bg-royal px-[11px] text-[12px] font-bold">
          {slot.action.label}
        </span>
      )}
    </Link>
  );
}
