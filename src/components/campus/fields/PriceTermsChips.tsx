'use client';

import { useState } from 'react';
import { PRICE_TERMS_LABELS } from '@/lib/campus/constants';
import { cn } from '@/lib/utils/cn';
import type { PriceTerms } from '@/types/market';

/** Rent can only be fixed or open to a little haggling. */
export type RentPriceTerms = 'fixed' | 'negotiable' | 'slightly_negotiable';

export const MARKET_PRICE_TERMS: readonly PriceTerms[] = ['fixed', 'negotiable', 'free', 'swap', 'per_person'];
export const RENT_PRICE_TERMS: readonly RentPriceTerms[] = ['fixed', 'negotiable', 'slightly_negotiable'];

export const RENT_PRICE_TERMS_LABELS: Record<RentPriceTerms, string> = {
  fixed: 'Fixed rent',
  negotiable: 'Open to offers',
  slightly_negotiable: 'Slightly negotiable',
};

type Shared = {
  /** Called with null when Free is picked, so the price box clears. */
  onPriceChange?: (price: number | null) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

type MarketProps = Shared & {
  mode?: 'market';
  value?: PriceTerms;
  defaultValue?: PriceTerms;
  onChange?: (terms: PriceTerms) => void;
  /** Limit the five terms, e.g. a wanted post has no swap. */
  options?: readonly PriceTerms[];
};

type RentProps = Shared & {
  mode: 'rent';
  value?: RentPriceTerms;
  defaultValue?: RentPriceTerms;
  onChange?: (terms: RentPriceTerms) => void;
  options?: readonly RentPriceTerms[];
};

export type PriceTermsChipsProps = MarketProps | RentProps;

const CHIP =
  'campus-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 disabled:pointer-events-none disabled:opacity-45';

/** Price terms as chips. Market mode has five terms; rent mode three. */
export function PriceTermsChips(props: PriceTermsChipsProps) {
  const { label = 'Price terms', disabled = false, className, onPriceChange } = props;
  const rent = props.mode === 'rent';
  const options: readonly string[] = props.options ?? (rent ? RENT_PRICE_TERMS : MARKET_PRICE_TERMS);
  const labels: Record<string, string> = rent ? RENT_PRICE_TERMS_LABELS : PRICE_TERMS_LABELS;

  const [inner, setInner] = useState<string>(props.defaultValue ?? options[0] ?? 'fixed');
  const current: string = props.value ?? inner;

  const pick = (next: string) => {
    if (props.value === undefined) setInner(next);
    if (props.mode === 'rent') props.onChange?.(next as RentPriceTerms);
    else props.onChange?.(next as PriceTerms);
    if (!rent && next === 'free') onPriceChange?.(null);
  };

  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((option) => {
        const selected = option === current;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => pick(option)}
            className={cn(CHIP, selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink')}
          >
            {labels[option] ?? option}
          </button>
        );
      })}
    </div>
  );
}
