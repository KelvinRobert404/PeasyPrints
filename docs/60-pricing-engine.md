### Purpose
Define pricing contract and deterministic outcomes.

### At a glance
- Inputs: pages, sides, color/BW, size, copies, bindings, emergency, shop overrides.
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
  afterDark?: boolean;
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
| A4 BW double, 120 pages, 1 copy, spiral | pages=120, A4, Double, BW, copies=1, binding=Spiral | 120/2 sides × 3 + 70 = 70 + (60×3)= 250 → 250.00 |
| A4 Color single, 10 pages, 2 copies, no binding | pages=10, A4, Single, Color, copies=2 | 20×10=200.00 |
| A3 BW single, 5 pages, emergency | pages=5, A3, Single, BW, emergency | (5×4)+30=50.00 |

Note: numbers assume sample shop pricing: A4 Double BW=3, A4 Spiral=70, A4 Single Color=10, A3 Single BW=4, emergency=30.

### Rounding and tax
- Totals rounded to 2 decimals using bankers rounding.
- Tax inclusive within per-page/service rates (Assumption).
- TODO: Confirm GST handling and receipt breakdown.


