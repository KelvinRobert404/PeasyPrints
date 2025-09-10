'use client';

import { useMemo } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';

export function PrintConfigurator() {
  const { settings, setSettings, pageCount, shopPricing } = useUploadStore();

  const priceTable = useMemo(() => {
    if (!shopPricing) return null;
    return settings.paperSize === 'A4' ? shopPricing.a4 : shopPricing.a3;
  }, [shopPricing, settings.paperSize]);

  const perPageRates = useMemo(() => {
    return {
      a3: shopPricing?.a3,
      a4: shopPricing?.a4,
    } as any;
  }, [shopPricing]);

  const isUnavailablePaper = (size: 'A3' | 'A4') => {
    if (!shopPricing) return false;
    const table = size === 'A4' ? shopPricing?.a4 : shopPricing?.a3;
    if (!table) return true;
    const values = [table.singleBW, table.doubleBW, table.singleColor, table.doubleColor].map((v) => Number(v ?? 0));
    return values.every((v) => v <= 0);
  };

  const isUnavailableColor = (color: 'Black & White' | 'Color') => {
    if (!shopPricing || !priceTable) return false;
    const values = color === 'Color'
      ? [priceTable.singleColor, priceTable.doubleColor]
      : [priceTable.singleBW, priceTable.doubleBW];
    return values.map((v) => Number(v ?? 0)).every((v) => v <= 0);
  };

  const isUnavailableFormat = (format: 'Single-Sided' | 'Double-Sided') => {
    if (!shopPricing || !priceTable) return false;
    if (settings.printColor === 'Color') {
      const v = format === 'Double-Sided' ? priceTable.doubleColor : priceTable.singleColor;
      return Number(v ?? 0) <= 0;
    }
    const v = format === 'Double-Sided' ? priceTable.doubleBW : priceTable.singleBW;
    return Number(v ?? 0) <= 0;
  };

  const toggle = (key: keyof typeof settings, value: any) => () => setSettings({ [key]: value } as any);

  return (
    <div className="space-y-4">
      {/* Paper Size */}
      <div className="grid grid-cols-2 gap-3">
        {(['A3', 'A4'] as const).map((size) => {
          const unavailable = isUnavailablePaper(size);
          return (
          <button
            key={size}
            className={cn(
              'h-16 rounded-2xl border text-xl font-extrabold font-quinn',
              settings.paperSize === size ? 'bg-blue-600 text-white' : 'bg-white text-gray-900',
              unavailable ? 'opacity-60 cursor-not-allowed' : ''
            )}
            onClick={unavailable ? undefined : toggle('paperSize', size)}
            disabled={unavailable}
          >
            <div className="px-3 w-full flex flex-col items-center text-center">
              <div>{size}</div>
              {shopPricing && unavailable && (
                <div className="mt-1">
                  <Badge variant="destructive" className="font-[coolvetica]">UNAVAILABLE</Badge>
                </div>
              )}
            </div>
          </button>
        );})}
      </div>

      {/* Color */}
      <div className="grid grid-cols-2 gap-3">
        {(['Black & White', 'Color'] as const).map((color) => {
          const unavailable = isUnavailableColor(color);
          return (
          <button
            key={color}
            className={cn(
              'h-12 rounded-xl border text-xs font-semibold',
              settings.printColor === color ? 'bg-blue-600 text-white' : 'bg-white text-gray-900',
              unavailable ? 'opacity-60 cursor-not-allowed' : ''
            )}
            onClick={unavailable ? undefined : toggle('printColor', color)}
            disabled={unavailable}
          >
            {color === 'Black & White' ? 'black & white' : 'colour'}
          </button>
        );})}
      </div>

      {/* Format */}
      <div className="grid grid-cols-2 gap-3">
        {(['Single-Sided', 'Double-Sided'] as const).map((format) => {
          const unavailable = isUnavailableFormat(format);
          return (
            <button
              key={format}
              className={cn(
                'h-12 rounded-xl border text-xs font-semibold',
                settings.printFormat === format ? 'bg-blue-600 text-white' : 'bg-white text-gray-900',
                unavailable ? 'opacity-60 cursor-not-allowed' : ''
              )}
              onClick={unavailable ? undefined : toggle('printFormat', format)}
              disabled={unavailable}
            >
              <div className="px-3 w-full flex flex-col items-center text-center">
                <div>{format === 'Single-Sided' ? 'single-sided' : 'double-sided'}</div>
                {shopPricing && unavailable && (
                  <div className="mt-1">
                    <Badge variant="destructive" className="font-[coolvetica]">UNAVAILABLE</Badge>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Copies */}
      <div className="grid grid-cols-3 gap-3 items-center">
        <button
          className="h-12 rounded-xl border bg-white text-xl"
          onClick={() => setSettings({ copies: Math.max(1, settings.copies - 1) })}
        >
          -
        </button>
        <div className="h-12 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center">
          <div className="text-base font-bold">{settings.copies}</div>
          <div className="text-[10px] leading-none">copies</div>
        </div>
        <button
          className="h-12 rounded-xl border bg-white text-xl"
          onClick={() => setSettings({ copies: settings.copies + 1 })}
        >
          +
        </button>
      </div>

      {/* Binding & Sides */}
      <div className="grid grid-cols-2 gap-3">
        <select
          className="border rounded h-12 px-3"
          value={settings.binding}
          onChange={(e) => setSettings({ binding: e.target.value as any })}
        >
          <option value="">No Binding</option>
          {(['Soft Binding','Spiral Binding','Hard Binding'] as const).map((label) => {
            const price = label === 'Soft Binding' ? shopPricing?.services.softBinding
              : label === 'Spiral Binding' ? shopPricing?.services.spiralBinding
              : shopPricing?.services.hardBinding;
            const unavailable = shopPricing ? Number(price ?? 0) <= 0 : false;
            return (
              <option key={label} value={label} disabled={unavailable}>
                {label}{shopPricing && unavailable ? ' — UNAVAILABLE' : ''}
              </option>
            );
          })}
        </select>
        <select
          className="border rounded h-12 px-3"
          value={settings.printFormat}
          onChange={(e) => setSettings({ printFormat: e.target.value as any })}
        >
          <option>Single-Sided</option>
          <option>Double-Sided</option>
        </select>
      </div>

      {/* No extra color pages input per new design */}
    </div>
  );
}
