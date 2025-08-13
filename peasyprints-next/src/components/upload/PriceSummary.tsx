'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';

export function PriceSummary() {
  const { totalCost, pageCount, settings } = useUploadStore();
  return (
    <div className="rounded-2xl bg-gray-100 p-4">
      <div className="space-y-1 text-gray-800">
        <div className="text-sm">Total Pages = {pageCount} Pages</div>
        <div className="text-sm">Price / Page = 1 Rs</div>
      </div>
      <div className="mt-4 text-gray-900 font-semibold">Total Payable = {totalCost} Rs</div>
    </div>
  );
}
