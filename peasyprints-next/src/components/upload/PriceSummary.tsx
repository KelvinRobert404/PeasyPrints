'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';

export function PriceSummary() {
  const { totalCost, pageCount, settings } = useUploadStore();
  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm text-gray-700">Pages: {pageCount}</div>
      <div className="text-sm text-gray-700">Copies: {settings.copies}</div>
      <div className="text-base font-semibold mt-2">Total: ₹{totalCost}</div>
    </div>
  );
}
