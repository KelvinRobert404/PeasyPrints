'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { FileDropzone } from '@/components/upload/FileDropzone';
import { PrintConfigurator } from '@/components/upload/PrintConfigurator';
import { PriceSummary } from '@/components/upload/PriceSummary';
import { CheckoutButton } from '@/components/upload/CheckoutButton';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store } from 'lucide-react';
import { useCollegeStore, COLLEGES } from '@/lib/stores/collegeStore';

export default function UploadEntryPage() {
  const { shops, subscribe } = useShopsStore();
  const { setShopPricing } = useUploadStore();
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  const selectedShop = useMemo(() => shops.find((s) => s.id === selectedShopId), [shops, selectedShopId]);

  useEffect(() => {
    setShopPricing(selectedShop?.pricing);
  }, [selectedShop, setShopPricing]);

  const disabled = !selectedShopId;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Shop</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShopOpen((v) => !v)}
                className="w-full rounded-2xl bg-gray-100 flex items-center px-3 h-12 text-sm text-gray-800"
              >
                <Store className="w-4 h-4 text-gray-500 mr-2" />
                <span className="truncate">
                  {selectedShopId ? (shops.find((s) => s.id === selectedShopId)?.name ?? 'Choose a store') : 'Choose a store'}
                </span>
              </button>
              {shopOpen && (
                <div className="absolute left-0 right-0 mt-2 z-20 rounded-xl border bg-white shadow">
                  <ul className="max-h-56 overflow-auto py-1 text-sm">
                    {shops.map((s) => (
                      <li key={s.id}>
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-gray-100"
                          onClick={() => {
                            setSelectedShopId(s.id);
                            setShopOpen(false);
                          }}
                        >
                          {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CardHeader>
            <CardTitle className="text-base">Select PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <FileDropzone />
          </CardContent>
        </Card>

        <Card className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CardHeader>
            <CardTitle className="text-base">Print Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <PrintConfigurator />
          </CardContent>
        </Card>

        <Card className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceSummary />
          </CardContent>
        </Card>

        {/* Checkout CTA separated */}
        <div className={disabled ? 'opacity-60 pointer-events-none select-none' : ''}>
          <CheckoutButton shopId={selectedShopId} shopName={selectedShop?.name} />
        </div>
      </main>
      <BottomNavigation />
    </div>
  );
}


function CollegePill() {
  const { selectedCollege } = useCollegeStore();
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/90 text-blue-900 px-3 py-1 text-xs">
      <span className="inline-block w-2 h-2 rounded-full bg-blue-900" />
      <span className="truncate max-w-[180px]">{selectedCollege}</span>
    </div>
  );
}
