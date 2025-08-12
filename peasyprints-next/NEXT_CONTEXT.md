# PeasyPrints Next.js Application Documentation

## 1. Application Overview

**Product Description**: PeasyPrints is a comprehensive printing service platform that connects users with print shops. Users can upload PDFs, configure print settings, and place orders through a modern web application.

**Tech Stack Summary**:
- **Frontend**: Next.js 13+ App Router, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui design system, Geist font
- **State Management**: Zustand stores
- **Backend Services**: Firebase (Auth, Firestore, Storage), Clerk (UI/Auth), Razorpay (Payments)
- **PWA Features**: Serwist service worker implementation
- **PDF Processing**: pdf-lib, pdfjs-dist

**Core Services**:
- **Authentication**: Clerk for UI + Firebase bridge for backend integration
- **Database**: Firestore for shops, orders, and user data
- **Storage**: Firebase Storage for PDF uploads
- **Payments**: Razorpay payment gateway with server-side verification

**Target Users**: End users ordering prints and shop owners managing their services

## 2. Architecture & Design Patterns

**App Router Structure**: Uses Next.js 13+ app directory approach with route groups `(auth)` for authentication flows.

**State Management**: Zustand stores architecture providing reactive state management:
- `authStore`: Authentication state and Firebase user
- `shopsStore`: Shop data and pricing
- `ordersStore`: User orders and filtering
- `uploadStore`: File handling and print configuration
- `pricingStore`: Default pricing values

**Authentication Bridge**: Clerk → Firebase custom token flow for seamless integration.

**Data Flow**: Client → Firebase → Razorpay payment verification → Order creation.

## 3. Environment Configuration

### Client-side Variables (`NEXT_PUBLIC_*`)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
```

### Server-side Variables (Sensitive)
```bash
CLERK_SECRET_KEY=sk_test_...
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

**Security Notes**: 
- `NEXT_PUBLIC_*` variables are exposed to the client and safe for public keys
- Server variables contain sensitive credentials and must never be exposed
- Firebase Admin private key requires escaped newlines (`\n`)

## 4. Authentication System

**Dual Auth Architecture**: Clerk handles UI and session management, while Firebase provides backend integration through custom tokens.

**Auth Flow**:
1. **Clerk Sign-in**: User authenticates through Clerk's UI components
2. **Custom Token Generation**: `POST /api/auth/firebase-custom-token` creates Firebase custom token
3. **Firebase Authentication**: Client signs into Firebase with custom token
4. **User Profile Creation**: `POST /api/users/upsert` creates/updates Firestore user document

**Implementation**:
```typescript
// AuthProvider.tsx - Bridge implementation
useEffect(() => {
  if (isSignedIn && isLoaded && !firebaseBridgeAttempted.current) {
    firebaseBridgeAttempted.current = true;
    
    // Get Firebase custom token from Clerk session
    fetch('/api/auth/firebase-custom-token')
      .then(res => res.json())
      .then(data => signInWithCustomToken(auth, data.token))
      .then(() => {
        // Create/update user profile
        return fetch('/api/users/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
      });
  }
}, [isSignedIn, isLoaded]);
```

**Route Protection**: Uses `clerkMiddleware` with public route matcher:
```typescript
// middleware.ts
export default clerkMiddleware((auth, req) => {
  const publicRoutes = createRouteMatcher([
    '/',
    '/login',
    '/register',
    '/otp',
    '/api/auth/firebase-custom-token',
    '/api/users/upsert'
  ]);
  
  if (!publicRoutes(req)) {
    return auth().protect();
  }
});
```

## 5. Pages & Routing Structure

**Auth Routes** (`(auth)` group):
- `/login`: Clerk SignIn component
- `/register`: Clerk SignUp component  
- `/otp`: Legacy phone OTP verification (being phased out)

**Main Application Routes**:
- `/dashboard`: Home shell with basic skeleton
- `/shops`: Shop listing with Firestore real-time updates
- `/shops/[shopId]`: Individual shop details and pricing
- `/upload/[shopId]`: Complete upload flow (PDF + configuration + checkout)
- `/orders`: User order history with status filtering
- `/profile`: User profile placeholder

**Route Groups Strategy**: `(auth)` groups authentication routes without affecting URL structure.

## 6. State Management (Zustand Stores)

### authStore
```typescript
// Legacy Firebase auth helpers and user state
interface AuthStore {
  user: User | null;
  recaptchaReady: boolean;
  initRecaptcha: (containerId: string, size?: 'invisible' | 'normal') => void;
  resetRecaptcha: (containerId: string) => void;
  sendOTP: (phoneNumber: string) => Promise<void>;
}
```

### shopsStore
```typescript
// Shop data with pricing normalization
interface ShopsStore {
  shops: Shop[];
  subscribe: (userId: string) => () => void;
  // Adapts legacy flat pricing fields to normalized ShopPricing
}
```

### ordersStore
```typescript
// User orders with real-time updates
interface OrdersStore {
  orders: Order[];
  subscribe: (userId: string) => () => void;
  // Filters by userId, orders by timestamp desc
}
```

### uploadStore
```typescript
// File handling and print configuration
interface UploadStore {
  file: File | null;
  pageCount: number;
  rotations: number[];
  settings: PrintSettings;
  totalCost: number;
  setFile: (file: File) => void;
  recalc: () => void;
}
```

## 7. Firebase Integration

**Configuration**: `src/lib/firebase/config.ts` initializes Firebase SDK with environment variables.

**Firestore Collections**:
- `shops`: Shop documents with pricing data
- `orders`: Order documents with payment tracking
- `users`: User profiles and metadata

**Storage Structure**: `uploads/{userId}/{timestamp}-{filename}`

**Legacy Data Handling**: 
```typescript
// shopsStore.ts - Pricing normalization
const legacyPricing = {
  A4SingBlaWh: 2.0,  // Legacy flat field
  SoftBinding: 50.0   // Legacy service field
};

// Normalized to:
const normalizedPricing = {
  pricing: {
    a4: { single: { blackWhite: 2.0 } },
    services: { softBinding: 50.0 }
  }
};
```

## 8. Upload & PDF Processing

**File Upload Flow**: Uses `react-dropzone` for drag-and-drop file selection.

**PDF Processing**: `pdf-lib` extracts page count and metadata.

**PDF Preview**: `pdfjs-dist` renders page previews with per-page rotation controls.

**Worker Configuration**:
```typescript
// PdfPreviewer.tsx
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

## 9. Pricing System

**Pricing Logic**: `src/lib/utils/pricing.ts` implements comprehensive cost calculation.

**Price Factors**:
- Paper size: A3/A4 with different base prices
- Print format: Single/Double sided
- Color options: Black & White vs Color
- Binding services: Soft binding, hard binding, etc.
- Emergency surcharge: Rush order premium
- Copy multipliers: Quantity discounts

**Real-time Calculation**: Integrated with upload store for instant price updates.

## 10. Payment Integration (Razorpay)

**Complete Payment Flow**:

1. **Order Creation**: `POST /api/razorpay/order`
```typescript
// Creates Razorpay order on server
const order = await razorpay.orders.create({
  amount: amount * 100, // Convert to paise
  currency: 'INR',
  receipt: `order_${Date.now()}`
});
```

2. **Client Payment**: Razorpay SDK integration
```typescript
// CheckoutButton.tsx
const options = {
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  amount: totalCost * 100,
  currency: 'INR',
  order_id: orderId,
  handler: handlePaymentSuccess
};
```

3. **Payment Verification**: `POST /api/razorpay/verify`
```typescript
// Server-side signature verification
const expectedSignature = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest('hex');

if (expectedSignature === razorpaySignature) {
  // Payment verified, proceed with order creation
}
```

4. **Post-Payment**: PDF upload and Firestore order creation

**Security**: HMAC SHA256 signature verification prevents payment tampering.

## 11. API Routes

### Auth Endpoints
- `/api/auth/firebase-custom-token`: Generates Firebase custom token from Clerk session
- `/api/users/upsert`: Creates/updates user profile in Firestore

### Payment Endpoints  
- `/api/razorpay/order`: Creates Razorpay order
- `/api/razorpay/verify`: Verifies payment signature

## 12. UI Components Architecture

**Layout Components**: `BottomNavigation` provides fixed bottom tabs for mobile navigation.

**Shop Components**: `ShopCard` displays shop information with Next.js Image optimization.

**Upload Components**: Complete workflow from file selection to checkout.

**shadcn/ui Integration**: Consistent design system with Button, Card, Input, and Skeleton components.

## 13. Orders Management

**Orders Page**: `/orders` implementation with real-time Firestore subscriptions.

**User Identity Resolution**: Prefers Clerk `user.id`, falls back to Firebase `auth.currentUser?.uid`.

**Status Filtering**: All/Pending/Processing/Completed/Cancelled tabs.

**Real-time Updates**: Firestore `onSnapshot` provides live order updates.

## 14. PWA Implementation

**Service Worker**: Serwist integration for production builds.

**Caching Strategy**: Precache configuration for core assets.

**Build Process**: `service-worker.js` and `next.config.js` handle service worker generation.

## 15. Development & Build Process

**Local Development**: `npm run dev` starts development server at http://localhost:3000.

**Build Process**: `npm run build` creates production build, `npm start` runs production server.

**Environment Setup**: `.env.local` must be configured before starting development server.

## 16. Security Considerations

**Environment Variables**: Strict separation of public and private keys.

**Firestore Rules**: Currently permissive, needs tightening for production.

**Payment Security**: Server-side signature verification prevents client-side tampering.

**Auth Security**: Custom token validation and secure user session management.

## 17. Known Issues & Technical Debt

- Firestore/Storage security rules need implementation
- Deprecated Clerk `afterSignInUrl` props replacement needed
- Legacy Firebase auth flow cleanup required
- Missing server webhooks for Razorpay reconciliation
- Error handling improvements needed

## 18. Data Models & Types

**ShopPricing**: Normalized pricing structure for consistent access.

**Order Structure**: Complete order schema with payment and print details.

**User Profile**: User metadata and preferences.

**Upload State**: File and configuration state management.

## 19. Integration Points

**Clerk Integration**: UI components and session management.

**Firebase Admin**: Server-side operations and custom token generation.

**Razorpay SDK**: Client-side payment processing.

**PDF.js**: Document processing and preview generation.

## 20. Future Roadmap & Improvements

- Implement comprehensive security rules
- Add webhook integration for payment reconciliation
- Complete migration from legacy auth flows
- Enhanced error handling and user feedback
- Performance optimizations for PDF processing

## Troubleshooting Guide

**Common Issues**:
- PDF worker not loading: Ensure `public/pdf.worker.min.mjs` exists
- Payment verification failing: Check `RAZORPAY_KEY_SECRET` configuration
- Auth bridge loops: Verify Firebase Admin credentials

**API Testing**: Use browser dev tools to test payment flows and Firebase operations.

**Deployment Checklist**: Ensure all environment variables are set in production.

**Monitoring**: Implement error tracking and performance monitoring for production use.
