'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { useRouter } from 'next/navigation';
import { ShopCard } from '@/components/shops/ShopCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ShopsPage() {
  const { shops, subscribe, loading, error } = useShopsStore();
  const router = useRouter();

  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Shops</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nearby Print Shops</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div className="text-sm text-gray-500">Loading...</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} onSelect={(id) => router.push(`/upload/${id}`)} />
            ))}
            {!loading && shops.length === 0 && <div className="text-sm text-gray-500">No shops available</div>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
