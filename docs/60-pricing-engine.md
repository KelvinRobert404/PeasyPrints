### Purpose
Define pricing contract and deterministic outcomes.

### At a glance
- Inputs: pages, sides, color/BW, size, copies, bindings, emergency/afterDark, shop overrides.
- Currency: INR; rounding to nearest paise.

### Contract
```ts
export interface PricingInput {
  totalPages: number;
  copies: number;
  paperSize: 'A4' | 'A3';
  printFormat: 'Single-Sided' | 'Double-Sided';
  printColor: 'Black & White' | 'Color';
  binding?: 'Soft Binding' | 'Spiral Binding' | 'Hard Binding' | '';
  emergency?: boolean;
  afterDark?: boolean; // mutually exclusive with emergency in UI
  extraColorPages?: number;
  shopPricing?: ShopPricing; // overrides defaults
}

export interface PricingOutput {
  basePricePerPage: number;
  pagesPriced: number; // adjusted for double-sided, extras
  bindingCost: number;
  emergencyCost: number;
  afterDarkCost?: number;
  subtotal: number;
  total: number; // rounded to 2 decimals (paise)
}
```

### Deterministic examples
| Case | Input | Expected total |
| --- | --- | --- |
| A4 BW double, 120 pages, 1 copy, spiral | pages=120, tier match (100-200), price=1.5 | 120/2 sides × 1.5 + 70 = 70 + 90 = 160.00 |
| A4 Color single, 5 pages, 2 copies | pages=5, tier match (1-10), price=10 | 20×10=200.00 |

Note: Numbers assume sample shop pricing with Unified Tiers. The engine prioritizes finding a matching tier for the page count. If found, it uses the specific price for that configuration (Size/Color/Format) defined in that tier. Fallback to base pricing occurs only if no tier matches.

### Rounding and tax
- Totals rounded to 2 decimals using bankers rounding.
- Tax inclusive within per-page/service rates (Assumption).
- TODO: Confirm GST handling and receipt breakdown.

### Implementation notes
- Client: `useUploadStore.recalc()` calls `calculateTotalCost(settings, pageCount, shopPricing)` to show a preview total.
- Server: `/api/orders/create` recomputes totals from `shops/{id}.pricing` and persists `pricingDetails`; client totals are not trusted.
- UI guarantees `emergency` and `afterDark` are mutually exclusive, and `afterDark` is only enabled when the shop is closed.


