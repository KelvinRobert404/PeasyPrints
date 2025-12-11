import type { ShopPricing } from '@/types/models';
import { Badge } from '@/components/ui/badge';

export function ShopPricingTable({ pricing }: { pricing?: ShopPricing }) {
  if (!pricing) return <div className="text-sm text-gray-500">Pricing not available</div>;
  const PriceCell = ({ value }: { value?: number }) => {
    const v = Number(value ?? 0);
    if (v <= 0) return <Badge variant="destructive" className="font-[coolvetica]">UNAVAILABLE</Badge>;
    return <>₹{v}</>;
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 text-sm font-medium">A4</div>
      <div className="px-4 py-2 text-sm grid grid-cols-2 gap-y-1">
        <div>Single B/W</div><div><PriceCell value={pricing.a4?.singleBW} /></div>
        <div>Double B/W</div><div><PriceCell value={pricing.a4?.doubleBW} /></div>
        <div>Single Color</div><div><PriceCell value={pricing.a4?.singleColor} /></div>
        <div>Double Color</div><div><PriceCell value={pricing.a4?.doubleColor} /></div>
      </div>
      <div className="bg-gray-50 px-4 py-2 text-sm font-medium border-t">A3</div>
      <div className="px-4 py-2 text-sm grid grid-cols-2 gap-y-1">
        <div>Single B/W</div><div><PriceCell value={pricing.a3?.singleBW} /></div>
        <div>Double B/W</div><div><PriceCell value={pricing.a3?.doubleBW} /></div>
        <div>Single Color</div><div><PriceCell value={pricing.a3?.singleColor} /></div>
        <div>Double Color</div><div><PriceCell value={pricing.a3?.doubleColor} /></div>
      </div>
      <div className="bg-gray-50 px-4 py-2 text-sm font-medium border-t">Services</div>
      <div className="px-4 py-2 text-sm grid grid-cols-2 gap-y-1">
        <div>Soft Binding</div><div><PriceCell value={pricing.services.softBinding} /></div>
        <div>Spiral Binding</div><div><PriceCell value={pricing.services.spiralBinding} /></div>
        <div>Hard Binding</div><div><PriceCell value={pricing.services.hardBinding} /></div>
        <div>Emergency</div><div><PriceCell value={pricing.services.emergency} /></div>
      </div>
    </div>
  );
}
