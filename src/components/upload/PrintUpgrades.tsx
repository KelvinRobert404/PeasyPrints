'use client';

import { useMemo } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { Card } from '@/components/ui/card';

const flashIcon = '/figma/3a3d1724c2727a8bfe5104c30b0f9c4f34325e85.png';
const batmanIcon = '/figma/a9df3efab731ab9679d53bf2e350d8ff724a5c4b.png';

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

  const selectRush = () => setSettings({ emergency: true, afterDark: false });
  const selectAfterDark = () => setSettings({ afterDark: true, emergency: false });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={selectRush} className={`rounded-2xl bg-white text-left p-4 border ${settings.emergency ? 'ring-2 ring-blue-600' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="text-lg font-extrabold">rush</div>
            <img src={flashIcon} alt="rush" className="w-6 h-6" />
          </div>
          <div className="mt-2 text-[12px] leading-tight text-gray-700">
            <div>jump the queue.</div>
            <div>ready in 5 mins flat</div>
            <div>or refund of the extras.</div>
          </div>
          <div className="mt-2 text-right font-extrabold lowercase">rs{rushPrice}</div>
        </button>

        <button
          type="button"
          onClick={selectAfterDark}
          disabled={!isShopClosed}
          className={`rounded-2xl bg-white text-left p-4 border ${settings.afterDark ? 'ring-2 ring-blue-600' : 'border-gray-200'} ${!isShopClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="text-lg font-extrabold">afterdark</div>
            <img src={batmanIcon} alt="afterdark" className="w-6 h-6" />
          </div>
          <div className="mt-2 text-[12px] leading-tight text-gray-700">
            <div>place your order while the</div>
            <div>shop snoozes.</div>
            <div>grab it first thing, 8:30–10 am.</div>
          </div>
          <div className="mt-2 text-right font-extrabold lowercase">rs{afterDarkPrice}</div>
        </button>
      </div>
    </div>
  );
}


