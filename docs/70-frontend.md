### Purpose
Frontend structure, UI primitives, PDF integration, and state stores.

### At a glance
- App Router structure, Tailwind + shadcn/ui, PDF.js/pdf-lib usage, Zustand stores.

### App Router map
- `(auth)/login`, `(auth)/register`, `(auth)/otp`
- `/dashboard`, `/shops`, `/shops/[shopId]`, `/upload`, `/orders`, `/profile`
- `/shopfront/*` for shop operations

### Design system
- Tailwind tokens (spacing, color), shadcn/ui components (`button`, `card`, `input`, `dialog`, `skeleton`, `badge`, etc.).
- Performance budget: LCP < 2.5s, CLS < 0.1, TBT < 200ms (mobile).

### PDF.js + pdf-lib integration
```ts
// PdfPreviewer setup
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Count pages with pdf-lib
import { PDFDocument } from 'pdf-lib';
export async function getPageCount(file: File): Promise<number> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}
```

### Zustand stores (shapes)

```ts
// authStore
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  verificationId: string | null;
  recaptchaReady: boolean;
  initialized: boolean;
  initRecaptcha(containerId: string, size?: 'invisible' | 'normal'): void;
  resetRecaptcha(containerId: string): void;
  sendOTP(phone: string): Promise<void>;
  startPhoneLogin(phone: string): Promise<void>;
  startPhoneRegistration(username: string, phone: string): Promise<void>;
  verifyOTP(code: string): Promise<void>;
  loginWithEmail(email: string, password: string): Promise<void>;
  registerWithEmail(email: string, password: string, username: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  logout(): Promise<void>;
}
```

```ts
// shopsStore (conceptual)
interface ShopsStore {
  shops: Shop[];
  subscribe: (userId: string) => () => void;
}
```

```ts
// ordersStore (conceptual)
interface OrdersStore {
  orders: OrderDoc[];
  subscribe: (userId: string) => () => void;
}
```

```ts
// uploadStore (conceptual)
interface UploadStore {
  file: File | null;
  pageCount: number;
  rotations: number[];
  settings: PrintSettings;
  totalCost: number;
  setFile(file: File): void;
  recalc(): void;
}
```

```ts
// shopStore (shopfront)
interface ShopState {
  currentShop: Shop | null;
  orders: OrderDoc[];
  pendingOrders: OrderDoc[];
  historyOrders: OrderDoc[];
  receivableAmount: number;
  fetchShopData(uid: string): Promise<void>;
  fetchOrders(shopId: string): Promise<() => void>;
  updateOrderStatus(orderId: string, status: OrderDoc['status']): Promise<void>;
  completeOrder(orderId: string, order: OrderDoc): Promise<void>;
  cancelOrder(orderId: string, order: OrderDoc): Promise<void>;
  updatePricing(pricing: ShopPricing): Promise<void>;
}
```

### Loading/error states & optimistic updates
- Upload: optimistic page count; pricing recalculates on each edit.
- Orders: server is source-of-truth; no optimistic status flips; wait for Firestore ack.

### Accessibility & performance
- Use semantic elements, focus traps in dialogs, aria-labels on buttons/inputs.
- Lazy-load heavy PDF modules; prefetch critical routes.


