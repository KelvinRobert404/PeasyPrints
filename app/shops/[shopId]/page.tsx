'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { ShopPricingTable } from '@/components/shops/ShopPricingTable';

export default function ShopDetailsPage() {
  const params = useParams();
  const shopId = params?.shopId as string;
  const router = useRouter();
  const { shops, subscribe } = useShopsStore();

  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  const shop = shops.find((s) => s.id === shopId);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{shop?.name || 'Shop'}</h1>
        <div className="text-xs text-gray-600">{shop?.address}</div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <ShopPricingTable pricing={shop?.pricing} />
        <button className="w-full h-12 bg-blue-600 text-white rounded" onClick={() => router.push(`/upload/${shopId}`)}>
          Upload PDF for this Shop
        </button>
      </main>
    </div>
  );
}
