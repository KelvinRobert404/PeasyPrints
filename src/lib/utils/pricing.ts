import type { PrintSettings, ShopPricing, PricingDetails } from '@/types/models';

type PageTable = { singleBW: number; doubleBW: number; singleColor: number; doubleColor: number };

/**
 * Normalizes a shop document's pricing for both the browser and the server, so
 * the price a customer sees is the price they are charged. Accepts the current
 * `pricing` map (tiers and/or a4/a3 tables) and the legacy flat Flutter fields.
 */
export function normalizeShopPricing(data: any): ShopPricing | undefined {
  const pricing = data?.pricing;
  const hasTables = Boolean(pricing?.a4 && pricing?.a3);
  const hasTiers = Array.isArray(pricing?.tiers) && pricing.tiers.length > 0;
  if (hasTables || hasTiers) return { ...pricing, services: pricing.services ?? {} } as ShopPricing;

  // Legacy flat fields from Flutter/older schema
  const hasLegacy =
    typeof data?.A4SingBlaWh === 'number' ||
    typeof data?.A4SingColor === 'number' ||
    typeof data?.A4DoubBlaWh === 'number' ||
    typeof data?.A4DoubColor === 'number' ||
    typeof data?.A3SingBlaWh === 'number' ||
    typeof data?.A3SingColor === 'number' ||
    typeof data?.A3DoubBlaWh === 'number' ||
    typeof data?.A3DoubColor === 'number';

  if (!hasLegacy) return undefined;

  return {
    a4: {
      singleBW: data.A4SingBlaWh ?? 0,
      doubleBW: data.A4DoubBlaWh ?? 0,
      singleColor: data.A4SingColor ?? 0,
      doubleColor: data.A4DoubColor ?? 0
    },
    a3: {
      singleBW: data.A3SingBlaWh ?? 0,
      doubleBW: data.A3DoubBlaWh ?? 0,
      singleColor: data.A3SingColor ?? 0,
      doubleColor: data.A3DoubColor ?? 0
    },
    services: {
      softBinding: data.SoftBinding ?? data.softBinding ?? 0,
      spiralBinding: data.SpiralBinding ?? data.spiralBinding ?? 0,
      hardBinding: data.HardBinding ?? data.hardBinding ?? 0,
      emergency: data.EmergencyPr ?? data.emergency ?? 0,
      afterDark: data.AfterDarkPr ?? data.afterDark ?? data.afterdark ?? 0
    },
    // Platform fees may have been set on a legacy shop by Godview.
    convenienceFee: pricing?.convenienceFee,
    convenienceFeeTiers: pricing?.convenienceFeeTiers,
  };
}

/**
 * Per-page rates for these settings. The B&W and colour rates come from the same
 * table as the selected rate, so tier-priced shops charge for extra colour pages.
 */
export function resolvePageRates(settings: PrintSettings, pageCount: number, shopPricing: ShopPricing) {
  const isA4 = settings.paperSize === 'A4';
  const applicableTier = shopPricing.tiers?.find(
    tier => pageCount >= tier.minPages && pageCount <= tier.maxPages
  );
  // If no tier matches (e.g. page count out of range), fall back to base pricing if present
  const table: PageTable | undefined = applicableTier
    ? (isA4 ? applicableTier.a4 : applicableTier.a3)
    : (isA4 ? shopPricing.a4 : shopPricing.a3);
  const doubleSided = settings.printFormat === 'Double-Sided';
  const bwPerPage = Number((doubleSided ? table?.doubleBW : table?.singleBW) ?? 0);
  const colorPerPage = Number((doubleSided ? table?.doubleColor : table?.singleColor) ?? 0);
  const perPage = settings.printColor === 'Color' ? colorPerPage : bwPerPage;
  return { perPage, bwPerPage, colorPerPage };
}

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
    commission: 0,
    convenienceFee: 0
  };

  if (!shopPricing) {
    return { total: 0, details: defaults };
  }

  const { perPage, bwPerPage, colorPerPage } = resolvePageRates(settings, pageCount, shopPricing);

  // Treat 0/undefined as unavailable for safety (UI should already disable)
  const safePerPage = Number(perPage ?? 0) <= 0 ? 0 : Number(perPage);

  const extraColorPages = settings.extraColorPages ?? 0;
  const extraColorDelta = Math.max(colorPerPage - bwPerPage, 0) * extraColorPages;

  const services = shopPricing.services ?? {};
  const bindingMap: Record<string, number> = {
    'Soft Binding': services.softBinding ?? 0,
    'Spiral Binding': services.spiralBinding ?? 0,
    'Hard Binding': services.hardBinding ?? 0,
    '': 0
  };

  const bindingUnit = bindingMap[settings.binding ?? ''] ?? 0;
  const bindingCost = Number(bindingUnit ?? 0) <= 0 ? 0 : Number(bindingUnit);
  const emergencyUnit = Number(services.emergency ?? 0) <= 0 ? 0 : Number(services.emergency);
  const afterDarkUnit = Number(services.afterDark ?? emergencyUnit ?? 0) <= 0 ? 0 : Number(services.afterDark ?? emergencyUnit ?? 0);

  const basePagesCost = safePerPage * pageCount;
  const copies = Math.max(settings.copies || 1, 1);

  const base = (basePagesCost + bindingCost + (settings.printColor === 'Black & White' ? extraColorDelta : 0)) * copies;
  const emergencyCost = settings.emergency ? emergencyUnit : 0;
  const afterDarkCost = settings.afterDark ? afterDarkUnit : 0;

  let convenienceFee = Number(shopPricing.convenienceFee ?? 0);

  // Tiered convenience fee logic
  if (shopPricing.convenienceFeeTiers && shopPricing.convenienceFeeTiers.length > 0) {
    const matchingTier = shopPricing.convenienceFeeTiers.find(
      t => pageCount >= t.minPages && pageCount <= t.maxPages
    );
    if (matchingTier) {
      convenienceFee = matchingTier.fee;
    } else {
      // Optional: logic for what to do if page count exceeds all defined tiers (e.g. use highest tier or flat fee)
      // For now, fallback to flat fee if no tier matches
    }
  }

  const total = base + emergencyCost + afterDarkCost + convenienceFee;

  const details: PricingDetails = {
    basePricePerPage: perPage,
    bindingCost,
    emergencyCost,
    afterDarkCost,
    commission: 0,
    convenienceFee
  };

  return { total, details };
}
