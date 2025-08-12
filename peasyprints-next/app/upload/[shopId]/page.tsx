'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { FileDropzone } from '@/components/upload/FileDropzone';
import { PrintConfigurator } from '@/components/upload/PrintConfigurator';
import { PriceSummary } from '@/components/upload/PriceSummary';
import { CheckoutButton } from '@/components/upload/CheckoutButton';
import { PdfPreviewer } from '@/components/upload/PdfPreviewer';
import { useShopsStore } from '@/lib/stores/shopsStore';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function UploadPage() {
  const params = useParams();
  const shopId = params?.shopId as string;
  const { shops, subscribe } = useShopsStore();
  const { setShopPricing } = useUploadStore();

  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  const shop = shops.find((s) => s.id === shopId);

  useEffect(() => {
    setShopPricing(shop?.pricing);
  }, [shop, setShopPricing]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Upload</h1>
        <div className="text-xs text-gray-600">Shop: {shop?.name || shopId}</div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <FileDropzone />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview & Rotate</CardTitle>
          </CardHeader>
          <CardContent>
            <PdfPreviewer />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Print Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <PrintConfigurator />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PriceSummary />
            <CheckoutButton shopId={shopId} shopName={shop?.name} />
          </CardContent>
        </Card>
      </main>
      <BottomNavigation />
    </div>
  );
}
