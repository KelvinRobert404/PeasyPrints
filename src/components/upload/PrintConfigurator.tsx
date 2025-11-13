'use client';

import { useMemo, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';

export function PrintConfigurator() {
  const {
    settings,
    setSettings,
    shopPricing,
    jobType,
    images,
    imagesPages,
    setImagesPages,
    imagesScale,
    setImagesScale
  } = useUploadStore();
  const [customizeOpen, setCustomizeOpen] = useState(false);

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
      {/* Copies (always visible) */}
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

      {/* Customize toggle */}
      <div>
        <button
          type="button"
          className="w-full h-10 rounded-lg border bg-white text-sm font-medium"
          onClick={() => setCustomizeOpen((v) => !v)}
        >
          {customizeOpen ? 'Hide Customize' : 'Customize'}
        </button>
      </div>

      {customizeOpen && (
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

          {/* Format (hidden when images present) */}
          {(images?.length || 0) === 0 && (
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
          )}

          {/* Binding (hidden when images present) */}
          {(images?.length || 0) === 0 && (
            <div className="grid grid-cols-1 gap-3">
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
            </div>
          )}

          {/* Images-only controls (visible when images uploaded) */}
          {images && images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Pages</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 w-8 rounded bg-white border"
                    onClick={() => setImagesPages(Math.max(1, imagesPages - 1))}
                  >
                    −
                  </button>
                  <div className="w-10 text-center text-sm font-semibold">{imagesPages}</div>
                  <button
                    type="button"
                    className="h-8 w-8 rounded bg-white border"
                    onClick={() => setImagesPages(Math.min(5, imagesPages + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Image size</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 w-8 rounded bg-white border"
                    onClick={() => setImagesScale(Math.max(0.5, Math.round((imagesScale - 0.1) * 10) / 10))}
                  >
                    −
                  </button>
                  <div className="w-12 text-center text-sm font-semibold">{Math.round(imagesScale * 100)}%</div>
                  <button
                    type="button"
                    className="h-8 w-8 rounded bg-white border"
                    onClick={() => setImagesScale(Math.min(2.0, Math.round((imagesScale + 0.1) * 10) / 10))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No extra color pages input per new design */}
        </div>
      )}
    </div>
  );
}
