'use client';

import { useMemo, type ComponentType, type ReactNode } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import type { IconProps } from '@/components/swoop/icons';
import { BoltIcon, MoonIcon } from '@/components/upload/icons';
import { cn } from '@/lib/utils/cn';

function UpgradeTile({
  title,
  icon: Icon,
  description,
  price,
  selected,
  unavailable,
  dimmed,
  disabled,
  onClick
}: {
  title: string;
  icon: ComponentType<IconProps>;
  description: ReactNode;
  price: ReactNode;
  selected: boolean;
  unavailable: boolean;
  dimmed: boolean;
  disabled: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'campus-press flex flex-col rounded-[14px] p-2.5 text-left transition-colors',
        selected ? 'bg-royal-tint ring-2 ring-inset ring-royal' : 'bg-surface',
        dimmed && 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-ink">{title}</span>
        <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', selected ? 'bg-royal text-white' : 'bg-white text-royal')}>
          <Icon size={16} />
        </span>
      </span>
      <span className="mt-1 text-[11px] leading-[1.35] text-slate">{description}</span>
      <span className="mt-2 flex justify-end">
        {unavailable ? (
          <span className="rounded-full bg-market-tint px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.06em] text-market">
            Unavailable
          </span>
        ) : (
          <span className="font-heading text-[14.5px] leading-none text-ink tabular-nums">{price}</span>
        )}
      </span>
    </button>
  );
}

export function PrintUpgrades({ shopTiming }: { shopTiming?: string }) {
  const { settings, setSettings, shopPricing } = useUploadStore();

  const isShopClosed = useMemo(() => {
    if (!shopTiming) return false;
    // shopTiming format: "HH:MM to HH:MM" from register page
    try {
      const [open, close] = shopTiming.split(' to ').map((t) => t.trim());
      if (!open || !close) return false;
      const now = new Date();
      const [oh, om] = open.split(':').map((n) => parseInt(n, 10));
      const [ch, cm] = close.split(':').map((n) => parseInt(n, 10));
      const openDate = new Date(now);
      openDate.setHours(oh, om || 0, 0, 0);
      const closeDate = new Date(now);
      closeDate.setHours(ch, cm || 0, 0, 0);
      return now < openDate || now > closeDate;
    } catch {
      return false;
    }
  }, [shopTiming]);

  const rushPrice = shopPricing?.services.emergency ?? 0;
  const afterDarkPrice = shopPricing?.services.afterDark ?? rushPrice ?? 0;
  const rushUnavailable = shopPricing ? Number(rushPrice ?? 0) <= 0 : false;
  const afterDarkUnavailable = shopPricing ? Number(afterDarkPrice ?? 0) <= 0 : false;

  const toggleRush = () => {
    setSettings({ emergency: !settings.emergency, afterDark: false });
  };
  const toggleAfterDark = () => {
    // Allow turning off even if shop is open; only gate turning on
    if (!settings.afterDark && !isShopClosed) return;
    setSettings({ afterDark: !settings.afterDark, emergency: false });
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <UpgradeTile
        title="Rush"
        icon={BoltIcon}
        description="Jump the queue. Ready in 5 minutes flat, or the extra is refunded."
        price={<>₹{rushPrice}</>}
        selected={Boolean(settings.emergency)}
        unavailable={Boolean(shopPricing && rushUnavailable)}
        dimmed={rushUnavailable}
        disabled={rushUnavailable}
        onClick={rushUnavailable ? undefined : toggleRush}
      />
      <UpgradeTile
        title="After dark"
        icon={MoonIcon}
        description="Order while the shop sleeps. Pick it up first thing, 8:30 to 10 am."
        price={<>₹{afterDarkPrice}</>}
        selected={Boolean(settings.afterDark)}
        unavailable={Boolean(shopPricing && afterDarkUnavailable)}
        dimmed={(!isShopClosed && !settings.afterDark) || afterDarkUnavailable}
        disabled={afterDarkUnavailable || (!isShopClosed && !settings.afterDark)}
        onClick={afterDarkUnavailable ? undefined : toggleAfterDark}
      />
    </div>
  );
}
