import type { PricingDetails, ShopPricing } from '@/types/models';
import { calculateTotalCost } from '@/lib/utils/pricing';
import type { CheckoutQuoteInput } from './schema';

function finiteMoney(value: unknown, label: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    throw new Error(`Invalid ${label}`);
  }
  return Math.round(amount * 100) / 100;
}

export function createServerQuote(input: CheckoutQuoteInput, pricing: ShopPricing) {
  const { total, details } = calculateTotalCost(input.printSettings, input.totalPages, pricing);
  const safeDetails: PricingDetails = {
    basePricePerPage: finiteMoney(details.basePricePerPage, 'page price'),
    bindingCost: finiteMoney(details.bindingCost, 'binding price'),
    emergencyCost: finiteMoney(details.emergencyCost, 'emergency price'),
    afterDarkCost: finiteMoney(details.afterDarkCost ?? 0, 'after-dark price'),
    commission: finiteMoney(details.commission, 'commission'),
    convenienceFee: finiteMoney(details.convenienceFee ?? 0, 'convenience fee'),
  };
  const amount = finiteMoney(total, 'order total');
  if (amount < 1) throw new Error('Order total must be at least INR 1');
  return { amount, amountPaise: Math.round(amount * 100), currency: 'INR' as const, pricingDetails: safeDetails };
}

