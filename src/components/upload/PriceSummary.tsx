'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';
import { useMemo } from 'react';

export function PriceSummary() {
  const { totalCost, pageCount, settings, shopPricing } = useUploadStore();

  const breakdown = useMemo(() => {
    if (!shopPricing) {
      return {
        perPage: 0,
        basePagesCost: 0,
        bindingCostTotal: 0,
        extraColorSurcharge: 0,
        rushCost: 0,
        afterDarkCost: 0,
        copies: settings.copies || 1
      };
    }

    const isA4 = settings.paperSize === 'A4';
    const table = isA4 ? shopPricing.a4 : shopPricing.a3;

    const perPage = settings.printColor === 'Color'
      ? (settings.printFormat === 'Double-Sided' ? table.doubleColor : table.singleColor)
      : (settings.printFormat === 'Double-Sided' ? table.doubleBW : table.singleBW);

    const bwPerPage = (settings.printFormat === 'Double-Sided' ? table.doubleBW : table.singleBW);
    const colorPerPage = (settings.printFormat === 'Double-Sided' ? table.doubleColor : table.singleColor);

    const copies = Math.max(settings.copies || 1, 1);
    const basePagesCostSingle = perPage * pageCount;

    const bindingMap: Record<string, number> = {
      'Soft Binding': shopPricing.services.softBinding ?? 0,
      'Spiral Binding': shopPricing.services.spiralBinding ?? 0,
      'Hard Binding': shopPricing.services.hardBinding ?? 0,
      '': 0
    };
    const bindingCost = bindingMap[settings.binding || ''] || 0;
    const bindingCostTotal = bindingCost * copies;

    const extraColorPages = settings.extraColorPages || 0;
    const extraColorDelta = Math.max(colorPerPage - bwPerPage, 0) * extraColorPages;
    const extraColorSurcharge = (settings.printColor === 'Black & White' ? extraColorDelta : 0) * copies;

    const rushUnit = shopPricing.services.emergency ?? 0;
    const afterDarkUnit = shopPricing.services.afterDark ?? rushUnit ?? 0;
    const rushCost = settings.emergency ? rushUnit : 0;
    const afterDarkCost = settings.afterDark ? afterDarkUnit : 0;

    const basePagesCost = basePagesCostSingle * copies;

    return { perPage, basePagesCost, bindingCostTotal, extraColorSurcharge, rushCost, afterDarkCost, copies };
  }, [shopPricing, settings, pageCount]);

  return (
    <div className="rounded-2xl bg-gray-100 p-4">
      <div className="space-y-1 text-gray-800">
        <div className="text-sm">Total Pages = {pageCount} pages</div>
        <div className="text-sm">Price / page = Rs{breakdown.perPage}</div>
        {breakdown.copies > 1 && (
          <div className="text-sm">Copies = x{breakdown.copies}</div>
        )}
        <div className="text-sm">Base pages = Rs{breakdown.basePagesCost}</div>
        {breakdown.bindingCostTotal > 0 && (
          <div className="text-sm">Binding = Rs{breakdown.bindingCostTotal}</div>
        )}
        {breakdown.extraColorSurcharge > 0 && (
          <div className="text-sm">Extra color pages = Rs{breakdown.extraColorSurcharge}</div>
        )}
        {breakdown.rushCost > 0 && (
          <div className="text-sm">Rush = Rs{breakdown.rushCost}</div>
        )}
        {breakdown.afterDarkCost > 0 && (
          <div className="text-sm">Afterdark = Rs{breakdown.afterDarkCost}</div>
        )}
      </div>
      <div className="mt-4 text-gray-900 font-semibold">Total Payable = Rs{totalCost}</div>
    </div>
  );
}
