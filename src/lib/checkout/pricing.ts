import type { PricingDetails, ShopPricing } from '@/types/models';
import { calculateTotalCost, resolvePageRates } from '@/lib/utils/pricing';
import type { CheckoutQuoteInput } from './schema';

function finiteMoney(value: unknown, label: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    throw new Error(`Invalid ${label}`);
  }
  return Math.round(amount * 100) / 100;
}

/** A customer-facing reason the selected options can't be priced. */
export class QuoteError extends Error {}

// A price of 0 means the shop doesn't offer the option; never charge nothing for it.
function assertOptionsOffered(input: CheckoutQuoteInput, pricing: ShopPricing) {
  const settings = input.printSettings;
  const services = pricing.services ?? {};
  const rates = resolvePageRates(settings, input.totalPages, pricing);
  if (!(rates.perPage > 0)) throw new QuoteError('This shop does not offer the selected paper, colour or sides option');
  if (settings.extraColorPages > 0 && !(rates.colorPerPage > 0)) throw new QuoteError('This shop does not offer colour printing');
  const bindingPrice = { 'Soft Binding': services.softBinding, 'Spiral Binding': services.spiralBinding, 'Hard Binding': services.hardBinding, '': 1 }[settings.binding];
  if (!(Number(bindingPrice) > 0)) throw new QuoteError('This shop does not offer the selected binding');
  if (settings.emergency && !(Number(services.emergency) > 0)) throw new QuoteError('This shop does not offer rush printing');
  if (settings.afterDark && !(Number(services.afterDark ?? services.emergency) > 0)) throw new QuoteError('This shop does not offer After Dark printing');
}

export function createServerQuote(input: CheckoutQuoteInput, pricing: ShopPricing) {
  assertOptionsOffered(input, pricing);
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
