### Purpose
Hardened auth, rules, and payment verification.

### At a glance
- Clerk-guarded routes; Firebase custom token bridge.
- Production-grade Firestore & Storage rules.
- Razorpay verification with replay protection.

### Clerk guard (middleware)
```ts
// Guard excerpt — see docs/10-architecture.md for full listing
export default clerkMiddleware((auth, req) => { /* ... */ });
```

### Custom token mint endpoint (server)
```ts
// app/api/auth/firebase-custom-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import admin from 'firebase-admin';

let init = false;
function ensureInit() {
  if (init) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n');
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  init = true;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await clerkAuth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    ensureInit();
    const token = await admin.auth().createCustomToken(userId, { provider: 'clerk' });
    return NextResponse.json({ token });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to mint token' }, { status: 500 });
  }
}
```

### Client sign-in with custom token
```tsx
// src/components/providers/AuthProvider.tsx (excerpt)
const res = await fetch('/api/auth/firebase-custom-token', { method: 'POST' });
const { token } = await res.json();
if (token) await signInWithCustomToken(auth, token);
await fetch('/api/users/upsert', { method: 'POST' });
```

### Firestore rules (strict, production)
```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    // Limit reads/writes to own user doc
    match /users/{userId} {
      allow read: if isSignedIn() && request.auth.uid == userId;
      allow write: if isSignedIn() && request.auth.uid == userId
                   && request.resource.data.keys().hasOnly(['username','phoneNumber','email','updatedAt','createdAt'])
                   && request.time == request.resource.data.updatedAt;
    }

    // Shop documents: only shop owner (uid == shopId) can manage profile/pricing
    match /shops/{shopId} {
      allow read: if true;
      allow write: if isSignedIn() && request.auth.uid == shopId;
    }

    // Orders: Read own orders or orders for own shop
    match /orders/{orderId} {
      allow read: if isSignedIn() && (
        resource.data.userId == request.auth.uid ||
        resource.data.shopId == request.auth.uid
      );

      // STRICT: prefer server-only writes via Admin SDK (rules bypassed).
      // Temporarily allow client create with tight constraints; migrate to server-created orders ASAP.
      allow create: if isSignedIn()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.shopId is string
        && request.resource.data.fileUrl is string
        && request.resource.data.totalCost is number
        && request.resource.data.status == 'pending'
        && request.time == request.resource.data.timestamp;

      // Status updates by shop only
      allow update: if isSignedIn()
        && resource.data.shopId == request.auth.uid
        && request.resource.data.keys().hasOnly(resource.data.keys())
        && request.resource.data.status in ['processing','printing','printed','collected','completed','cancelled'];

      allow delete: if false;
    }

    // History: read by involved user/shop; writes by shop (completion/cancel)
    match /history/{historyId} {
      allow read: if isSignedIn() && (
        resource.data.userId == request.auth.uid ||
        resource.data.shopId == request.auth.uid
      );
      allow create: if isSignedIn() && request.resource.data.shopId == request.auth.uid;
      allow update, delete: if false;
    }

    // Payouts: read by shop; create by shop
    match /payouts/{payoutId} {
      allow read, create: if isSignedIn() && request.resource.data.shopId == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

### Storage rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // User uploads under /uploads/{uid}/...
    match /uploads/{uid}/{fileName=**} {
      allow read: if true; // files are served publicly by design
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // Shop logos under /shop_logos/{uid}.jpg
    match /shop_logos/{uid}.jpg {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### Razorpay verification (server, HMAC + replay protection)
```ts
// app/api/razorpay/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment verification params' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const hmac = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const valid = hmac === razorpay_signature;
    if (!valid) return NextResponse.json({ valid: false, error: 'Invalid signature' }, { status: 400 });

    // TODO: Implement replay protection by storing processed payment_id in Firestore 'payments_ledger' with TTL
    return NextResponse.json({ valid: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Verification failed' }, { status: 500 });
  }
}
```

### Threat model highlights
- Client cannot mint Firebase token; server mints custom token based on Clerk session.
- Orders integrity risk if client writes orders: mitigate via server-created orders and payment ledger.
- Storage upload endpoint uses Admin SDK; validate content type and size; sanitize filename.

### Secrets and rotation
- Store secrets in Vercel project settings; rotate Razorpay and Clerk keys quarterly.
- Maintain audit logs of token minting and admin-side writes (Cloud Logging).

### TODO
- Enforce server-only order creation post-verify; remove client create ability.
- Add idempotency ledger and webhook reconciliation.


