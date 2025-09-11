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

export interface ShopPricing {
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
  services: {
    softBinding?: number;
    hardBinding?: number;
    emergency?: number;
    afterDark?: number;
    spiralBinding?: number;
  };
}

export interface UserProfile {
  id: string; // uid
  username: string;
  phoneNumber?: string | null;
  email?: string | null;
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
}

export interface Shop {
  id: string;
  name: string;
  address: string;
  timing?: string;
  openingTime?: string;
  closingTime?: string;
  logoUrl?: string;
  pricing?: ShopPricing;
  isOpen?: boolean;
  receivableAmount?: number;
  createdAt?: any;
  updatedAt?: any;
  email?: string;
  phone?: string;
}

export interface PrintSettings {
  paperSize: PaperSize;
  printFormat: PrintFormat;
  printColor: PrintColor;
  orientation: 'Vertical' | 'Horizontal';
  binding?: 'Soft Binding' | 'Spiral Binding' | 'Hard Binding' | '';
  copies: number;
  customMessage?: string;
  vinylColor?: string;
  extraColorPages?: number;
  emergency?: boolean;
  afterDark?: boolean;
}

export interface PricingDetails {
  basePricePerPage: number;
  bindingCost: number;
  emergencyCost: number;
  afterDarkCost?: number;
  commission: number;
}

export interface OrderDoc {
  id?: string;
  userId: string;
  shopId: string;
  shopName: string;
  userName: string;
  fileName: string;
  fileUrl: string;
  totalPages: number;
  totalCost: number;
  status: 'pending' | 'processing' | 'printing' | 'printed' | 'collected' | 'completed' | 'cancelled';
  timestamp: any; // Firestore timestamp
  emergency: boolean;
  afterDark?: boolean;
  printSettings: PrintSettings;
  pricingDetails: PricingDetails;
}

export interface HistoryDoc extends OrderDoc {
  orderId: string;
  historyTimestamp: any;
}

export interface Payout {
  id?: string;
  shopId: string;
  amount: number;
  createdAt: any;
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
    "a4": { "singleBW": 2, "doubleBW": 3, "singleColor": 10, "doubleColor": 18 },
    "a3": { "singleBW": 4, "doubleBW": 6, "singleColor": 20, "doubleColor": 36 },
    "services": { "softBinding": 50, "spiralBinding": 70, "emergency": 30 }
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


