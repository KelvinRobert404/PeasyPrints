'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { FileDropzone } from '@/components/upload/FileDropzone';
import { PrintConfigurator } from '@/components/upload/PrintConfigurator';
import { PriceSummary } from '@/components/upload/PriceSummary';
import { CheckoutButton } from '@/components/upload/CheckoutButton';
import { PdfPreviewer } from '@/components/upload/PdfPreviewer';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function UploadEntryPage() {
  const { shops, subscribe } = useShopsStore();
  const { setShopPricing } = useUploadStore();
  const [selectedShopId, setSelectedShopId] = useState<string>('');

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
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Upload</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Shop</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
            >
              <option value="" disabled>
                Choose a shop
              </option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
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
            <CardTitle className="text-base">Preview & Rotate</CardTitle>
          </CardHeader>
          <CardContent>
            <PdfPreviewer />
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
            <CardTitle className="text-base">Price Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PriceSummary />
            <CheckoutButton shopId={selectedShopId} shopName={selectedShop?.name} />
          </CardContent>
        </Card>
      </main>
      <BottomNavigation />
    </div>
  );
}


