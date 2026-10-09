'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo } from 'react';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { ShopCard } from '@/components/shops/ShopCard';
import { EmptyState, PageHeader } from '@/components/swoop/primitives';
import { StoreIcon } from '@/components/swoop/icons';

export default function ShopsPage() {
  const { shops, subscribe, loading, error } = useShopsStore();

  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  // Open shops first (display order only).
  const sorted = useMemo(
    () => [...shops].sort((a, b) => Number(Boolean(b.isOpen)) - Number(Boolean(a.isOpen))),
    [shops]
  );

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PageHeader title="Print shops" kicker="Pick a shop to print at" backHref="/" />
      <main className="flex-1 px-3 pt-2 pb-3">
        {error && <p className="mb-2 rounded-[10px] bg-market-tint px-3 py-2 text-[11.5px] font-semibold text-market">{error}</p>}

        {loading && shops.length === 0 && (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading shops">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-surface" />
                <span className="h-8 flex-1 animate-pulse rounded-[8px] bg-surface" />
              </div>
            ))}
          </div>
        )}

        {sorted.length > 0 && (
          <div className="flex flex-col">
            {sorted.map((shop, i) => (
              <ShopCard key={shop.id} shop={shop} href={`/upload/${shop.id}`} showAddress divider={i < sorted.length - 1} />
            ))}
          </div>
        )}

        {!loading && !error && shops.length === 0 && (
          <EmptyState icon={StoreIcon} title="No shops yet" body="Print shops on your campus will show up here." />
        )}
      </main>
    </div>
  );
}
