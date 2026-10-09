'use client';

import { useMemo } from 'react';
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
    <div className="space-y-2">
      {/* Copies */}
      <div className="grid grid-cols-3 gap-2 items-center">
        <button
          className="h-10 rounded-lg border border-black/10 bg-white text-lg font-bold"
          onClick={() => setSettings({ copies: Math.max(1, settings.copies - 1) })}
        >
          -
        </button>
        <div className="h-10 rounded-lg bg-royal text-white flex items-center justify-center gap-1.5">
          <div className="text-[15px] font-extrabold tabular-nums">{settings.copies}</div>
          <div className="text-[10px] font-semibold text-white/70">copies</div>
        </div>
        <button
          className="h-10 rounded-lg border border-black/10 bg-white text-lg font-bold"
          onClick={() => setSettings({ copies: Math.min(settings.copies + 1, 50) })}
          disabled={settings.copies >= 50}
        >
          +
        </button>
      </div>

      {/* Paper Size */}
      <div className="grid grid-cols-2 gap-2">
        {(['A3', 'A4'] as const).map((size) => {
          const unavailable = isUnavailablePaper(size);
          return (
            <button
              key={size}
              className={cn(
                'h-12 rounded-xl border text-lg font-extrabold font-quinn',
                settings.paperSize === size ? 'bg-royal text-white border-transparent' : 'bg-white text-ink border-black/10',
                unavailable ? 'opacity-60 cursor-not-allowed' : ''
              )}
              onClick={unavailable ? undefined : toggle('paperSize', size)}
              disabled={unavailable}
            >
              <div className="px-3 w-full flex flex-col items-center text-center">
                <div>{size}</div>
                {shopPricing && unavailable && (
                  <div className="mt-0.5">
                    <Badge variant="destructive" className="text-[9px]">UNAVAILABLE</Badge>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Color */}
      <div className="grid grid-cols-2 gap-2">
        {(['Black & White', 'Color'] as const).map((color) => {
          const unavailable = isUnavailableColor(color);
          return (
            <button
              key={color}
              className={cn(
                'h-10 rounded-lg border border-black/10 text-xs font-bold',
                settings.printColor === color ? 'bg-royal text-white border-transparent' : 'bg-white text-ink',
                unavailable ? 'opacity-60 cursor-not-allowed' : ''
              )}
              onClick={unavailable ? undefined : toggle('printColor', color)}
              disabled={unavailable}
            >
              {color === 'Black & White' ? 'black & white' : 'colour'}
            </button>
          );
        })}
      </div>

      {/* Format (hidden when images present) */}
      {(images?.length || 0) === 0 && (
        <div className="grid grid-cols-2 gap-2">
          {(['Single-Sided', 'Double-Sided'] as const).map((format) => {
            const unavailable = isUnavailableFormat(format);
            return (
              <button
                key={format}
                className={cn(
                  'h-10 rounded-lg border border-black/10 text-xs font-bold',
                  settings.printFormat === format ? 'bg-royal text-white border-transparent' : 'bg-white text-ink',
                  unavailable ? 'opacity-60 cursor-not-allowed' : ''
                )}
                onClick={unavailable ? undefined : toggle('printFormat', format)}
                disabled={unavailable}
              >
                <div className="px-3 w-full flex flex-col items-center text-center">
                  <div>{format === 'Single-Sided' ? 'single-sided' : 'double-sided'}</div>
                  {shopPricing && unavailable && (
                    <div className="mt-0.5">
                      <Badge variant="destructive" className="text-[9px]">UNAVAILABLE</Badge>
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
        <div className="grid grid-cols-1 gap-2">
          <select
            className="border border-black/10 rounded-lg h-10 px-3 text-[13px] font-semibold bg-white"
            value={settings.binding}
            onChange={(e) => setSettings({ binding: e.target.value as any })}
          >
            <option value="">No Binding</option>
            {(['Soft Binding', 'Spiral Binding', 'Hard Binding'] as const).map((label) => {
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-bold">Pages</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-white border border-black/10 font-bold"
                onClick={() => setImagesPages(Math.max(1, imagesPages - 1))}
              >
                −
              </button>
              <div className="w-10 text-center text-sm font-bold tabular-nums">{imagesPages}</div>
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-white border border-black/10 font-bold"
                onClick={() => setImagesPages(Math.min(5, imagesPages + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[13px] font-bold">Image size</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-white border border-black/10 font-bold"
                onClick={() => setImagesScale(Math.max(0.5, Math.round((imagesScale - 0.1) * 10) / 10))}
              >
                −
              </button>
              <div className="w-12 text-center text-sm font-bold tabular-nums">{Math.round(imagesScale * 100)}%</div>
              <button
                type="button"
                className="h-8 w-8 rounded-lg bg-white border border-black/10 font-bold"
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
  );
}
