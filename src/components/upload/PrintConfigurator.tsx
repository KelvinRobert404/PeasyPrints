'use client';

import { useMemo, type ReactNode } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { cn } from '@/lib/utils/cn';
import { CaretDownIcon, MinusIcon, PlusIcon } from '@/components/swoop/icons';

/* Segmented-style option group that supports per-option unavailability. */
type OptionItem<T extends string> = { value: T; label: string; unavailable?: boolean; showTag?: boolean };

function OptionGroup<T extends string>({
  title,
  options,
  value,
  onSelect
}: {
  title: string;
  options: OptionItem<T>[];
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-bold text-ink">{title}</p>
      <div
        role="group"
        aria-label={title}
        className="grid gap-0.5 rounded-[10px] bg-surface p-[3px]"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              disabled={o.unavailable}
              onClick={o.unavailable ? undefined : () => onSelect(o.value)}
              className={cn(
                'flex min-h-7 flex-col items-center justify-center rounded-lg px-1 py-1 text-[12px] leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                active ? 'bg-white font-bold text-ink shadow-[0_1px_3px_rgba(16,24,40,0.12)]' : 'font-semibold text-text-secondary'
              )}
            >
              {o.label}
              {o.showTag && (
                <span className="mt-1 text-[8.5px] font-extrabold uppercase tracking-[0.06em] text-market">Unavailable</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Row title + meta on the left, round surface stepper on the right. */
function StepperRow({
  title,
  meta,
  value,
  onDecrement,
  onIncrement,
  incrementDisabled
}: {
  title: string;
  meta?: ReactNode;
  value: ReactNode;
  onDecrement: () => void;
  onIncrement: () => void;
  incrementDisabled?: boolean;
}) {
  const btn = 'campus-press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-line disabled:pointer-events-none disabled:opacity-45';
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold text-ink">{title}</p>
        {meta && <p className="text-[11px] text-slate">{meta}</p>}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Decrease ${title.toLowerCase()}`} className={btn} onClick={onDecrement}>
          <MinusIcon size={14} />
        </button>
        <span aria-live="polite" className="min-w-10 text-center text-[13px] font-bold tabular-nums text-ink">
          {value}
        </span>
        <button type="button" aria-label={`Increase ${title.toLowerCase()}`} className={btn} onClick={onIncrement} disabled={incrementDisabled}>
          <PlusIcon size={14} />
        </button>
      </div>
    </div>
  );
}

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
    <div className="flex flex-col gap-3">
      {/* Copies */}
      <StepperRow
        title="Copies"
        meta="Up to 50"
        value={settings.copies}
        onDecrement={() => setSettings({ copies: Math.max(1, settings.copies - 1) })}
        onIncrement={() => setSettings({ copies: Math.min(settings.copies + 1, 50) })}
        incrementDisabled={settings.copies >= 50}
      />

      {/* Paper Size */}
      <OptionGroup
        title="Paper size"
        value={settings.paperSize}
        onSelect={(size) => toggle('paperSize', size)()}
        options={(['A3', 'A4'] as const).map((size) => {
          const unavailable = isUnavailablePaper(size);
          return { value: size, label: size, unavailable, showTag: Boolean(shopPricing && unavailable) };
        })}
      />

      {/* Color */}
      <OptionGroup
        title="Colour"
        value={settings.printColor}
        onSelect={(color) => toggle('printColor', color)()}
        options={(['Black & White', 'Color'] as const).map((color) => ({
          value: color,
          label: color === 'Black & White' ? 'Black & white' : 'Colour',
          unavailable: isUnavailableColor(color)
        }))}
      />

      {/* Format (hidden when images present) */}
      {(images?.length || 0) === 0 && (
        <OptionGroup
          title="Sides"
          value={settings.printFormat}
          onSelect={(format) => toggle('printFormat', format)()}
          options={(['Single-Sided', 'Double-Sided'] as const).map((format) => {
            const unavailable = isUnavailableFormat(format);
            return {
              value: format,
              label: format === 'Single-Sided' ? 'Single-sided' : 'Double-sided',
              unavailable,
              showTag: Boolean(shopPricing && unavailable)
            };
          })}
        />
      )}

      {/* Binding (hidden when images present) */}
      {(images?.length || 0) === 0 && (
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-bold text-ink">Binding</span>
          <span className="relative block">
            <select
              className="h-10 w-full appearance-none rounded-[10px] bg-surface pl-3 pr-9 text-[12.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
              value={settings.binding}
              onChange={(e) => setSettings({ binding: e.target.value as any })}
            >
              <option value="">No binding</option>
              {(['Soft Binding', 'Spiral Binding', 'Hard Binding'] as const).map((label) => {
                const price = label === 'Soft Binding' ? shopPricing?.services.softBinding
                  : label === 'Spiral Binding' ? shopPricing?.services.spiralBinding
                    : shopPricing?.services.hardBinding;
                const unavailable = shopPricing ? Number(price ?? 0) <= 0 : false;
                const text = label === 'Soft Binding' ? 'Soft binding' : label === 'Spiral Binding' ? 'Spiral binding' : 'Hard binding';
                return (
                  <option key={label} value={label} disabled={unavailable}>
                    {text}{shopPricing && unavailable ? ' (unavailable)' : ''}
                  </option>
                );
              })}
            </select>
            <CaretDownIcon size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink" />
          </span>
        </label>
      )}

      {/* Images-only controls (visible when images uploaded) */}
      {images && images.length > 0 && (
        <>
          <StepperRow
            title="Pages"
            meta="Spread images over 1 to 5 pages"
            value={imagesPages}
            onDecrement={() => setImagesPages(Math.max(1, imagesPages - 1))}
            onIncrement={() => setImagesPages(Math.min(5, imagesPages + 1))}
          />
          <StepperRow
            title="Image size"
            meta="50% to 200%"
            value={`${Math.round(imagesScale * 100)}%`}
            onDecrement={() => setImagesScale(Math.max(0.5, Math.round((imagesScale - 0.1) * 10) / 10))}
            onIncrement={() => setImagesScale(Math.min(2.0, Math.round((imagesScale + 0.1) * 10) / 10))}
          />
        </>
      )}

      {/* No extra color pages input per new design */}
    </div>
  );
}
