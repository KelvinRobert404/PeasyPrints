import type { PrintSettings, ShopPricing, PricingDetails } from '@/types/models';

export function calculateTotalCost(
  settings: PrintSettings,
  pageCount: number,
  shopPricing?: ShopPricing
): { total: number; details: PricingDetails } {
  const defaults: PricingDetails = {
    basePricePerPage: 0,
    bindingCost: 0,
    emergencyCost: 0,
    afterDarkCost: 0,
    commission: 0
  };

  if (!shopPricing) {
    return { total: 0, details: defaults };
  }

  const isA4 = settings.paperSize === 'A4';
  const priceTable = isA4 ? shopPricing.a4 : shopPricing.a3;

  const perPage = settings.printColor === 'Color'
    ? (settings.printFormat === 'Double-Sided' ? priceTable.doubleColor : priceTable.singleColor)
    : (settings.printFormat === 'Double-Sided' ? priceTable.doubleBW : priceTable.singleBW);

  const bwPerPage = (settings.printFormat === 'Double-Sided' ? priceTable.doubleBW : priceTable.singleBW);
  const colorPerPage = (settings.printFormat === 'Double-Sided' ? priceTable.doubleColor : priceTable.singleColor);

  const extraColorPages = settings.extraColorPages ?? 0;
  const extraColorDelta = Math.max(colorPerPage - bwPerPage, 0) * extraColorPages;

  const bindingMap: Record<string, number> = {
    'Soft Binding': shopPricing.services.softBinding ?? 0,
    'Spiral Binding': shopPricing.services.spiralBinding ?? 0,
    'Hard Binding': shopPricing.services.hardBinding ?? 0,
    '': 0
  };

  const bindingCost = bindingMap[settings.binding ?? ''] ?? 0;
  const emergencyUnit = shopPricing.services.emergency ?? 0;
  const afterDarkUnit = shopPricing.services.afterDark ?? emergencyUnit ?? 0;

  const basePagesCost = perPage * pageCount;
  const copies = Math.max(settings.copies || 1, 1);

  const base = (basePagesCost + bindingCost + (settings.printColor === 'Black & White' ? extraColorDelta : 0)) * copies;
  const emergencyCost = settings.emergency ? emergencyUnit : 0;
  const afterDarkCost = settings.afterDark ? afterDarkUnit : 0;

  const total = base + emergencyCost + afterDarkCost;

  const details: PricingDetails = {
    basePricePerPage: perPage,
    bindingCost,
    emergencyCost,
    afterDarkCost,
    commission: 0
  };

  return { total, details };
}
