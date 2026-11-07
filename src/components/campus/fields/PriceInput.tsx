'use client';

import { useId, useState } from 'react';
import { formatPrice, parsePriceInput, type PriceSuffix } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';

type Props = {
  /** Whole rupees, or null when empty. Leave undefined to let the field keep its own value. */
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (price: number | null) => void;
  /** Shown after the preview: 'Rs 8.5k pp', 'Rs 1.2L dep'. */
  suffix?: PriceSuffix;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
};

function toText(price: number | null | undefined): string {
  return typeof price === 'number' && Number.isFinite(price) ? String(price) : '';
}

/**
 * Price box that reads '1.5k', '12,000' or '1L' and shows the live
 * 'Rs 1.5k' preview under it. Never shows the rupee sign.
 */
export function PriceInput({
  value,
  defaultValue = null,
  onChange,
  suffix,
  label = 'Price',
  placeholder = '1.5k',
  disabled = false,
  name,
  className,
}: Props) {
  const id = useId();
  const controlled = value !== undefined;
  const [text, setText] = useState(() => toText(controlled ? value : defaultValue));
  const [seen, setSeen] = useState<number | null | undefined>(value);

  // A parent can reset the price (Free sets it to null): follow it unless the text already means that.
  if (controlled && value !== seen) {
    setSeen(value);
    if (parsePriceInput(text) !== value) setText(toText(value));
  }

  const trimmed = text.trim();
  const parsed = trimmed ? parsePriceInput(trimmed) : null;
  const invalid = trimmed !== '' && parsed === null;

  const update = (next: string) => {
    setText(next);
    const price = next.trim() ? parsePriceInput(next) : null;
    if (controlled) setSeen(price);
    onChange?.(price);
  };

  let preview: string;
  if (disabled) preview = 'No price needed';
  else if (!trimmed) preview = 'Type 1.5k, 900 or 1L';
  else if (invalid) preview = 'Try 1.5k, 900 or 1L';
  else preview = formatPrice(parsed ?? 0, suffix);

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="block text-[11.5px] font-bold text-ink">
        {label}
      </label>
      <div
        className={cn(
          'mt-1 flex h-11 items-center gap-1.5 rounded-[12px] border bg-surface px-3 focus-within:bg-white',
          invalid ? 'border-market' : 'border-transparent focus-within:border-royal',
          disabled && 'opacity-45',
        )}
      >
        <span className="shrink-0 text-[13px] font-bold text-slate" aria-hidden="true">
          Rs
        </span>
        <input
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          enterKeyHint="next"
          value={disabled ? '' : text}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-preview`}
          onChange={(event) => update(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate"
        />
        {suffix && !disabled ? (
          <span className="shrink-0 text-[12px] font-bold text-slate" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
      </div>
      <p
        id={`${id}-preview`}
        aria-live="polite"
        className={cn(
          'mt-1 text-[11.5px] font-bold tabular-nums',
          invalid ? 'text-market' : trimmed && !disabled ? 'text-ink' : 'text-slate',
        )}
      >
        {preview}
      </p>
    </div>
  );
}
