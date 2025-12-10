### Purpose
Canonical types, example documents, and indexes.

### At a glance
- Strongly-typed models for shops, orders, history, payouts.
- Example docs to seed environments.
- Complete indexes for core queries.

### TypeScript interfaces
```ts
// types/data-models.ts
export type PrintFormat = 'Single-Sided' | 'Double-Sided';
export type PrintColor = 'Black & White' | 'Color';
export type PaperSize = 'A3' | 'A4';

export interface PricingTier {
  minPages: number;
  maxPages: number;
  a4: {
    singleBW: number;
    doubleBW: number;
    singleColor: number;
    doubleColor: number;
  };
  a3: {
    singleBW: number;
    doubleBW: number;
    singleColor: number;
    doubleColor: number;
  };
}

export interface ShopPricing {
  // Legacy base pricing (optional/fallback)
  a4?: {
    singleBW: number;
    // ...
  };
  a3?: {
    singleBW: number;
    // ...
  };
  services: {
    softBinding?: number;
    hardBinding?: number;
    emergency?: number;
    afterDark?: number;
    spiralBinding?: number;
  };
  tiers?: PricingTier[]; // Unified pricing system
}
```

### Example documents

```json
// users/{uid}
{
  "username": "Asha",
  "phoneNumber": "+919876543210",
  "email": "asha@example.com",
  "createdAt": { "_seconds": 1710000000, "_nanoseconds": 0 },
  "updatedAt": { "_seconds": 1710000000, "_nanoseconds": 0 }
}
```

```json
// shops/{shopId}
{
  "name": "Campus Print Hub",
  "address": "Block A, IIT Main Road",
  "openingTime": "08:00",
  "closingTime": "20:00",
  "isOpen": true,
  "logoUrl": "https://.../shop_logos/abc.jpg",
  "pricing": {
    "services": { "softBinding": 50, "spiralBinding": 70, "emergency": 30 },
    "tiers": [
      {
        "minPages": 1,
        "maxPages": 10,
        "a4": { "singleBW": 2, "doubleBW": 3, "singleColor": 10, "doubleColor": 18 },
        "a3": { "singleBW": 4, "doubleBW": 6, "singleColor": 20, "doubleColor": 36 }
      },
      {
        "minPages": 11,
        "maxPages": 100,
        "a4": { "singleBW": 1.5, "doubleBW": 2.5, "singleColor": 9, "doubleColor": 16 },
        "a3": { "singleBW": 3, "doubleBW": 5, "singleColor": 18, "doubleColor": 32 }
      }
    ]
  },
  "receivableAmount": 1200,
  "createdAt": { "_seconds": 1710001000, "_nanoseconds": 0 },
  "updatedAt": { "_seconds": 1710001000, "_nanoseconds": 0 }
}
```

```json
// orders/{orderId}
{
  "userId": "u_123",
  "shopId": "s_123",
  "shopName": "Campus Print Hub",
  "userName": "Asha",
  "fileName": "thesis.pdf",
  "fileUrl": "https://.../uploads/u_123/1709999999-thesis.pdf",
  "totalPages": 120,
  "totalCost": 860,
  "status": "pending",
  "timestamp": { "_seconds": 1710002000, "_nanoseconds": 0 },
  "emergency": false,
  "afterDark": false,
  "printSettings": {
    "paperSize": "A4",
    "printFormat": "Double-Sided",
    "printColor": "Black & White",
    "orientation": "Vertical",
    "binding": "Spiral Binding",
    "copies": 1
  },
  "pricingDetails": {
    "basePricePerPage": 3,
    "bindingCost": 70,
    "emergencyCost": 0,
    "commission": 0
  }
}
```

```json
// history/{historyId}
{
  "orderId": "abc123",
  "userId": "u_123",
  "shopId": "s_123",
  "shopName": "Campus Print Hub",
  "userName": "Asha",
  "fileName": "thesis.pdf",
  "fileUrl": "https://.../uploads/u_123/1709999999-thesis.pdf",
  "totalPages": 120,
  "totalCost": 860,
  "status": "completed",
  "timestamp": { "_seconds": 1710002000, "_nanoseconds": 0 },
  "historyTimestamp": { "_seconds": 1710005000, "_nanoseconds": 0 },
  "emergency": false,
  "printSettings": { "paperSize": "A4", "printFormat": "Double-Sided", "printColor": "Black & White", "orientation": "Vertical", "copies": 1 },
  "pricingDetails": { "basePricePerPage": 3, "bindingCost": 70, "emergencyCost": 0, "commission": 0 }
}
```

```json
// payouts/{id}
{
  "shopId": "s_123",
  "amount": 1200,
  "createdAt": { "_seconds": 1710008000, "_nanoseconds": 0 }
}
```

### Indexes (complete example)
```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "shopId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "shopId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "historyTimestamp", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### Data retention & mirroring
- Orders mirrored to `history` upon completion/cancellation with `orderId` and `historyTimestamp`.
- Retain `orders` 90 days; archive to `history` only after terminal status.
- Payouts persist audit trail.

### TODO
- Define TTL/archive policy for large `history` collections (BigQuery export or scheduled archive).


