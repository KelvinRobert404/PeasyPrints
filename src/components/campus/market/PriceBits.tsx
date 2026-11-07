// Small price pieces for market cards: the price itself, the terms chip, the
// price-drop pair and the fair-price line. No hooks, so server and client
// components can both use them. Prices always go through formatPrice.

import { PriceDropIcon } from '@/components/swoop/icons';
import { PRICE_TERMS_LABELS } from '@/lib/campus/constants';
import { priceDropActive, type Instant } from '@/lib/campus/listingRules';
import { formatPrice } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';
import type { MarketListing, PriceTerms } from '@/types/market';

export type PriceFields = Pick<MarketListing, 'price' | 'priceTerms'>;
export type DropFields = Pick<MarketListing, 'price' | 'previousPrice' | 'priceDroppedAt'>;

/**
 * What the price reads: 'Rs 1.5k', 'Rs 400 pp', 'Free' or 'Swap'.
 * `open` is used when there is no price, e.g. 'Open budget' on a wanted post.
 */
export function priceText({ price, priceTerms }: PriceFields, open = 'Ask price'): string {
  if (priceTerms === 'free' || price === 0) return 'Free';
  if (price === null || !Number.isFinite(price)) return priceTerms === 'swap' ? 'Swap' : open;
  return priceTerms === 'per_person' ? formatPrice(price, 'pp') : formatPrice(price);
}

/** Terms chip text, or null when the price already says it (Free, Swap, pp). */
export function termsText(terms: PriceTerms, price: number | null): string | null {
  switch (terms) {
    case 'free':
    case 'per_person':
      return null;
    case 'swap':
      return price === null || price === 0 ? null : 'Or swap';
    default:
      return PRICE_TERMS_LABELS[terms];
  }
}

export interface PriceDrop {
  /** Old price, e.g. 'Rs 2.2k'. */
  was: string;
  /** New price, e.g. 'Rs 1.8k'. */
  now: string;
}

/** The old and new price while the 7-day price-drop badge is on, else null. */
export function priceDrop(listing: DropFields, now: Instant): PriceDrop | null {
  if (!priceDropActive(listing, now) || listing.price === null || listing.previousPrice === null) return null;
  return { was: formatPrice(listing.previousPrice), now: formatPrice(listing.price) };
}

/** 'Fair price Rs 1.2k'. */
export function fairPriceText(rupees: number): string {
  return `Fair price ${formatPrice(rupees)}`;
}

/** 'Up to Rs 500' for a wanted budget, 'Open budget' when there is none. */
export function budgetText(budgetMax: number | null): string {
  if (budgetMax === null || !Number.isFinite(budgetMax) || budgetMax <= 0) return 'Open budget';
  return `Up to ${formatPrice(budgetMax)}`;
}

/** The price in heading type. Struck through and greyed when `muted`. */
export function Price({
  listing,
  open,
  muted = false,
  className,
}: {
  listing: PriceFields;
  open?: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('font-heading whitespace-nowrap text-[12.5px] leading-[1.1] tabular-nums', muted ? 'text-slate' : 'text-ink', className)}>
      {priceText(listing, open)}
    </span>
  );
}

/** Old price, struck through. Screen readers hear 'Was Rs 2.2k'. */
export function WasPrice({ was, className }: { was: string; className?: string }) {
  return (
    <s className={cn('whitespace-nowrap text-[10.5px] font-semibold text-slate tabular-nums', className)}>
      <span className="sr-only">Was </span>
      {was}
    </s>
  );
}

/** Small 'Open to offers' style chip. Renders nothing when the price says it. */
export function TermsChip({ terms, price, className }: { terms: PriceTerms; price: number | null; className?: string }) {
  const text = termsText(terms, price);
  if (!text) return null;
  return (
    <span className={cn('inline-flex h-[18px] max-w-full items-center truncate rounded-full bg-surface px-1.5 text-[10px] font-semibold text-text-secondary', className)}>
      {text}
    </span>
  );
}

/** 'Price dropped' tag in green. */
export function DropTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-go-tint px-1.5 py-0.5 text-[9.5px] font-bold text-go-text', className)}>
      <PriceDropIcon size={11} aria-hidden="true" />
      Price dropped
    </span>
  );
}

/** 'Fair price Rs 1.2k' line for passes. */
export function FairPrice({ rupees, className }: { rupees: number; className?: string }) {
  return <span className={cn('whitespace-nowrap text-[10.5px] font-bold text-go-text', className)}>{fairPriceText(rupees)}</span>;
}
