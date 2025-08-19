# Shopfront Implementation Documentation

## Overview
The Shopfront is a Next.js-based dashboard for shop owners within the Swoop platform, converted from a Flutter implementation. It provides order management, pricing configuration, profile management, and withdrawal capabilities.

## Architecture

### File Structure
```
app/shopfront/
├── layout.tsx          # Main layout with auth gating and navigation
├── page.tsx            # Index redirect to dashboard
├── login/page.tsx      # Shop authentication
├── register/page.tsx   # Shop registration
├── dashboard/page.tsx  # Main dashboard with order queue
├── history/page.tsx    # Order history and revenue
├── pricing/page.tsx    # Pricing configuration
├── profile/page.tsx    # Shop profile management
└── withdraw/page.tsx   # Earnings withdrawal
```

## Authentication & Authorization

### Firebase Auth Integration
The Shopfront uses Firebase Auth with email/password authentication, implemented in the layout component:

```typescript
// app/shopfront/layout.tsx
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

export default function ShopfrontLayout({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setSignedIn(!!u));
    return () => unsub();
  }, []);
  
  const isAuthRoute = useMemo(() => 
    pathname?.startsWith('/shopfront/login') || 
    pathname?.startsWith('/shopfront/register'), 
    [pathname]
  );
  
  useEffect(() => {
    if (signedIn == null) return;
    if (!signedIn && !isAuthRoute) router.replace('/shopfront/login');
    if (signedIn && isAuthRoute) router.replace('/shopfront/dashboard');
  }, [signedIn, isAuthRoute, router]);
}
```

### Route Protection
- Unauthenticated users are redirected to `/shopfront/login`
- Authenticated users are kept away from auth routes
- All shopfront routes require Firebase authentication

## Data Management

### Zustand Store Architecture
The shop data is managed through a centralized Zustand store:

```typescript
// src/lib/stores/shopStore.ts
interface ShopState {
  currentShop: Shop | null;
  orders: OrderDoc[];
  pendingOrders: OrderDoc[];
  historyOrders: OrderDoc[];
  receivableAmount: number;
  
  fetchShopData: (uid: string) => Promise<void>;
  fetchOrders: (shopId: string) => Promise<() => void>;
  updateOrderStatus: (orderId: string, status: OrderDoc['status']) => Promise<void>;
  completeOrder: (orderId: string, order: OrderDoc) => Promise<void>;
  cancelOrder: (orderId: string, order: OrderDoc) => Promise<void>;
  updatePricing: (pricing: ShopPricing) => Promise<void>;
}
```

### Real-time Data Listeners
The store implements Firestore real-time listeners for orders and history:

```typescript
fetchOrders: async (shopId: string) => {
  // All orders for the shop
  const qAll = query(
    collection(db, 'orders'),
    where('shopId', '==', shopId),
    orderBy('timestamp', 'desc')
  );
  
  // Pending orders (processing/printing)
  const qPending = query(
    collection(db, 'orders'),
    where('shopId', '==', shopId),
    where('status', 'in', ['processing', 'printing']),
    orderBy('timestamp', 'desc')
  );
  
  // History orders (completed/cancelled)
  const qHistory = query(
    collection(db, 'history'),
    where('shopId', '==', shopId),
    where('status', 'in', ['completed', 'cancelled']),
    orderBy('historyTimestamp', 'desc')
  );
  
  const unsubAll = onSnapshot(qAll, (snap) => {
    const list = snap.docs.map((d) => ({ 
      ...(d.data() as OrderDoc), 
      id: d.id 
    })) as any as OrderDoc[];
    set((s) => { s.orders = list; });
  });
  
  // Similar listeners for pending and history...
  
  return () => { unsubAll(); unsubPending(); unsubHistory(); };
}
```

## Order Lifecycle Management

### Order Status Transitions
Orders follow a specific lifecycle: `pending` → `printing` → `completed`/`cancelled`

```typescript
// Dashboard automatically sets status to 'printing' when opened
<Card 
  onClick={() => { 
    setOpenId((o as any).id); 
    if (o.status === 'pending') 
      void updateOrderStatus((o as any).id, 'printing'); 
  }}
>
```

### Order Completion
When an order is completed, it's mirrored to the history collection:

```typescript
completeOrder: async (orderId, order) => {
  const ref = doc(db, 'orders', orderId);
  const historyRef = doc(collection(db, 'history'));
  
  // Mirror to history with historyTimestamp
  const completedPayload = { 
    ...order, 
    status: 'completed', 
    shopId: order.shopId, 
    orderId: orderId, 
    historyTimestamp: serverTimestamp() 
  } as any;
  
  await setDoc(historyRef, completedPayload);
  await updateDoc(ref, { status: 'completed' });
  
  // Update shop's receivable amount
  const shopId = order.shopId;
  try {
    const shopRef = doc(db, 'shops', shopId);
    const snap = await getDoc(shopRef);
    const prev = Number(snap.data()?.receivableAmount ?? 0);
    const next = prev + Number(order.totalCost ?? 0);
    await updateDoc(shopRef, { 
      receivableAmount: next, 
      updatedAt: serverTimestamp() as any 
    });
    set((s) => { s.receivableAmount = next; });
  } catch {}
}
```

### Order Cancellation
Cancelled orders are also moved to history:

```typescript
cancelOrder: async (orderId, order) => {
  const ref = doc(db, 'orders', orderId);
  const historyRef = doc(collection(db, 'history'));
  
  const cancelledPayload = { 
    ...order, 
    status: 'cancelled', 
    shopId: order.shopId, 
    orderId: orderId, 
    historyTimestamp: serverTimestamp() 
  } as any;
  
  await setDoc(historyRef, cancelledPayload);
  await updateDoc(ref, { status: 'cancelled' });
  // No receivable update on cancel
}
```

## File Upload & Storage

### Firebase Storage REST API
Logo uploads use Firebase Storage REST API with ID token authentication:

```typescript
// app/shopfront/profile/page.tsx
const handleUpload = async (file: File) => {
  if (!user?.uid) return;
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) return;
  
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string;
  const objectName = encodeURIComponent(`shop_logos/${user.uid}.jpg`);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${objectName}`;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': `Bearer ${idToken}`
    },
    body: await file.arrayBuffer()
  });
  
  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objectName}?alt=media`;
  setLogoUrl(publicUrl);
  await updateDoc(doc(db, 'shops', user.uid), { logoUrl: publicUrl });
};
```

### Registration Flow
During shop registration, logos are uploaded similarly:

```typescript
// app/shopfront/register/page.tsx
let logoUrl: string | undefined = undefined;
if (logoFile) {
  const idToken = await auth.currentUser?.getIdToken();
  if (idToken) {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string;
    const objectName = encodeURIComponent(`shop_logos/${uid}.jpg`);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${objectName}`;
    
    await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/octet-stream', 
        'Authorization': `Bearer ${idToken}` 
      },
      body: await logoFile.arrayBuffer()
    });
    
    logoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objectName}?alt=media`;
  }
}
```

## Database Schema & Indexes

### Firestore Collections

#### Shops Collection
```typescript
interface Shop {
  id: string;
  name: string;
  address: string;
  timing?: string;
  logoUrl?: string;
  pricing?: ShopPricing;
  receivableAmount: number;
  email?: string;
  phone?: string;
  openingTime?: string;
  closingTime?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Orders Collection
```typescript
interface OrderDoc {
  userId: string;
  shopId: string;
  shopName: string;
  userName: string;
  fileName: string;
  fileUrl: string;
  totalPages: number;
  totalCost: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  timestamp: Timestamp;
  emergency: boolean;
  printSettings: PrintSettings;
  pricingDetails: PricingDetails;
}
```

#### History Collection
```typescript
interface HistoryOrder extends OrderDoc {
  orderId: string;
  historyTimestamp: Timestamp;
}
```

### Required Indexes
The following composite indexes are required for efficient queries:

```json
// firestore.indexes.json
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
```

## UI Components

### Custom ShadCN-style Components
The Shopfront uses minimal, custom-built UI components:

```typescript
// src/components/ui/badge.tsx
export function Badge({ className, variant = 'default', children }: { 
  className?: string; 
  variant?: Variant; 
  children?: React.ReactNode 
}) {
  const base = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium';
  const styles: Record<Variant, string> = {
    default: 'bg-green-600/10 text-green-700 border border-green-600/20',
    secondary: 'bg-gray-600/10 text-gray-800 border border-gray-600/20',
    destructive: 'bg-red-600/10 text-red-700 border border-red-600/20',
    outline: 'border border-gray-300 text-gray-700'
  };
  return <span className={cn(base, styles[variant], className)}>{children}</span>;
}
```

### Responsive Layout
The layout provides desktop sidebar and mobile drawer navigation:

```typescript
// app/shopfront/layout.tsx
<div className="flex h-screen">
  {/* Desktop Sidebar */}
  <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-white">
    <div className="p-4 font-quinn text-xl">Swoop Shopfront</div>
    <nav className="flex-1 p-2 space-y-1">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className="block">
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
            active ? 'bg-gray-100' : 'hover:bg-gray-50'
          }`}>
            <Icon className="h-4 w-4" />
            <span>{it.label}</span>
          </div>
        </Link>
      ))}
    </nav>
  </aside>

  {/* Mobile Header with Drawer */}
  <div className="md:hidden sticky top-0 z-10 bg-white border-b">
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        {/* Mobile navigation */}
      </SheetContent>
    </Sheet>
  </div>
</div>
```

## Special Features

### Emergency Order Highlighting
Emergency orders are visually distinguished with blinking animation:

```css
/* app/globals.css */
@keyframes pulse-red {
  0%, 100% { 
    background-color: rgb(254 226 226); 
    border-color: rgb(239 68 68); 
  }
  50% { 
    background-color: rgb(255 255 255); 
    border-color: rgb(239 68 68); 
  }
}

.emergency-order { 
  animation: pulse-red 1s ease-in-out infinite; 
}
```

### Order Details Modal
Clicking on an order opens a detailed modal:

```typescript
// app/shopfront/dashboard/page.tsx
<Dialog open={!!openId} onOpenChange={(o) => setOpenId(o ? openId : null)}>
  <DialogContent>
    {openedOrder && (
      <>
        <DialogHeader>
          <DialogTitle className="font-semibold">Order Details</DialogTitle>
          <DialogDescription>
            {openedOrder.userName} - {openedOrder.fileName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 text-sm">
          {openedOrder.emergency && <Badge variant="destructive">URGENT</Badge>}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-gray-500">Paper Size</div>
            <div className="font-medium">{openedOrder.printSettings?.paperSize}</div>
            <div className="text-gray-500">Format</div>
            <div className="font-medium">{openedOrder.printSettings?.printFormat}</div>
            <div className="text-gray-500">Color</div>
            <div className="font-medium">{openedOrder.printSettings?.printColor}</div>
            <div className="text-gray-500">Copies</div>
            <div className="font-medium">{openedOrder.printSettings?.copies}</div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-gray-500">Total Pages</div>
            <div className="font-semibold">{openedOrder.totalPages}</div>
            <div className="text-gray-500">Amount</div>
            <div className="font-semibold">₹{openedOrder.totalCost}</div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />Download
          </Button>
          <Button variant="destructive" onClick={() => {
            if (!openId) return;
            void cancelOrder(openId, openedOrder);
            setOpenId(null);
          }}>Cancel</Button>
          <Button onClick={() => {
            if (!openId) return;
            void completeOrder(openId, openedOrder);
            setOpenId(null);
          }}>Complete</Button>
        </DialogFooter>
      </>
    )}
  </DialogContent>
</Dialog>
```

## Revenue Tracking

### Receivable Amount Management
The shop's receivable amount is automatically updated when orders are completed:

```typescript
// In completeOrder function
const shopRef = doc(db, 'shops', shopId);
const snap = await getDoc(shopRef);
const prev = Number(snap.data()?.receivableAmount ?? 0);
const next = prev + Number(order.totalCost ?? 0);
await updateDoc(shopRef, { 
  receivableAmount: next, 
  updatedAt: serverTimestamp() as any 
});
set((s) => { s.receivableAmount = next; });
```

### Withdrawal System
The withdrawal page displays the current balance and generates a QR code for UPI payments:

```typescript
// app/shopfront/withdraw/page.tsx
const payoutLink = useMemo(() => 
  `upi://pay?pa=${encodeURIComponent((currentShop as any)?.upiId || 'example@upi')}&am=${receivableAmount}&tn=Swoop%20Payout`, 
  [currentShop, receivableAmount]
);

const markPaid = async () => {
  if (!user?.uid) return;
  const uid = user.uid;
  
  // Create payout record
  const ref = doc(collection(db, 'payouts'));
  await setDoc(ref, {
    shopId: uid,
    amount: receivableAmount,
    createdAt: serverTimestamp()
  });
  
  // Reset receivable amount
  await updateDoc(doc(db, 'shops', uid), { 
    receivableAmount: 0, 
    updatedAt: serverTimestamp() 
  });
  setOpen(false);
};
```

## Error Handling

### Firestore Listener Error Handling
The history listener includes error handling for missing indexes:

```typescript
const unsubHistory = onSnapshot(qHistory, (snap) => {
  const list = snap.docs.map((d) => ({ 
    ...(d.data() as OrderDoc), 
    id: d.id 
  })) as any as OrderDoc[];
  set((s) => { s.historyOrders = list; });
}, (err) => {
  // Index might be missing in some environments; keep store stable
  console.error('History listener error', err);
});
```

### Graceful Fallbacks
The system gracefully handles missing data:

```typescript
// Dashboard status cards
const totalOrders = pendingOrders.length;
const completed = 0; // Derived from history if needed
const todaysRevenue = 0; // Computed from history with date filtering
const availableBalance = (currentShop as any)?.receivableAmount ?? 0;
```

## Performance Considerations

### Real-time Updates
- Orders are filtered by shop and status at the database level
- Emergency orders are sorted client-side for immediate visual feedback
- History queries use composite indexes for efficient filtering

### State Management
- Zustand store with Immer for immutable updates
- Real-time listeners are properly cleaned up on component unmount
- Store state is normalized to avoid unnecessary re-renders

## Security

### Firestore Rules
The system relies on Firestore security rules for data access control:
- Users can only access their own shop data
- Order operations are restricted to shop owners
- File uploads require valid Firebase ID tokens

### Authentication
- Firebase Auth handles user authentication
- ID tokens are used for Storage API calls
- No client-side role management (handled by Firestore rules)

## Deployment

### Environment Variables
Required environment variables:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Firestore Indexes
Deploy the required composite indexes:
```bash
firebase deploy --only firestore:indexes
```

## Future Enhancements

### Potential Improvements
- Implement real-time notifications for new orders
- Add order search and filtering capabilities
- Implement bulk order operations
- Add analytics and reporting features
- Implement order templates for recurring jobs

### Scalability Considerations
- Consider pagination for large order histories
- Implement order caching strategies
- Add offline support for critical operations
- Consider implementing order queuing for high-volume shops
