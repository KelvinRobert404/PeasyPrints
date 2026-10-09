'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { ShopPricingTable } from '@/components/shops/ShopPricingTable';
import { ShopThumb } from '@/components/shops/ShopCard';
import { shopHours, shopServices } from '@/components/shops/shopMeta';
import { PageHeader, StatusLine, swButton } from '@/components/swoop/primitives';
import { UploadIcon } from '@/components/swoop/icons';

export default function ShopDetailsPage() {
  const params = useParams();
  const shopId = params?.shopId as string;
  const { shops, subscribe } = useShopsStore();

  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  const shop = shops.find((s) => s.id === shopId);
  const services = shop ? shopServices(shop) : [];

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PageHeader title={shop?.name || 'Shop'} kicker={shop?.address || undefined} backHref="/shops" />
      <main className="flex flex-1 flex-col gap-3 px-3 pt-2 pb-3">
        {shop && (
          <div className="flex items-center gap-2.5">
            <ShopThumb shop={shop} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <StatusLine open={Boolean(shop.isOpen)} label={shop.isOpen ? 'Open' : 'Closed'} detail={shopHours(shop)} />
              {services.length > 0 && <span className="truncate text-[11px] text-slate">{services.join(' · ')}</span>}
            </div>
          </div>
        )}

        <ShopPricingTable pricing={shop?.pricing} />

        <Link href={`/upload/${shopId}`} className={swButton({ variant: 'primary', size: 'lg', className: 'w-full' })}>
          <UploadIcon size={18} />
          Upload a PDF for this shop
        </Link>
      </main>
    </div>
  );
}
