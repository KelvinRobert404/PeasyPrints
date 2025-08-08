import type { ShopPricing } from '@/types/models';

export function ShopPricingTable({ pricing }: { pricing?: ShopPricing }) {
  if (!pricing) return <div className="text-sm text-gray-500">Pricing not available</div>;
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 text-sm font-medium">A4</div>
      <div className="px-4 py-2 text-sm grid grid-cols-2 gap-y-1">
        <div>Single B/W</div><div>₹{pricing.a4.singleBW}</div>
        <div>Double B/W</div><div>₹{pricing.a4.doubleBW}</div>
        <div>Single Color</div><div>₹{pricing.a4.singleColor}</div>
        <div>Double Color</div><div>₹{pricing.a4.doubleColor}</div>
      </div>
      <div className="bg-gray-50 px-4 py-2 text-sm font-medium border-t">A3</div>
      <div className="px-4 py-2 text-sm grid grid-cols-2 gap-y-1">
        <div>Single B/W</div><div>₹{pricing.a3.singleBW}</div>
        <div>Double B/W</div><div>₹{pricing.a3.doubleBW}</div>
        <div>Single Color</div><div>₹{pricing.a3.singleColor}</div>
        <div>Double Color</div><div>₹{pricing.a3.doubleColor}</div>
      </div>
      <div className="bg-gray-50 px-4 py-2 text-sm font-medium border-t">Services</div>
      <div className="px-4 py-2 text-sm grid grid-cols-2 gap-y-1">
        <div>Soft Binding</div><div>₹{pricing.services.softBinding ?? 0}</div>
        <div>Spiral Binding</div><div>₹{pricing.services.spiralBinding ?? 0}</div>
        <div>Hard Binding</div><div>₹{pricing.services.hardBinding ?? 0}</div>
        <div>Emergency</div><div>₹{pricing.services.emergency ?? 0}</div>
      </div>
    </div>
  );
}
