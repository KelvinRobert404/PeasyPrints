# PeasyPrints Flutter to Next.js Migration Plan

## Executive Summary
This plan describes a 1:1, feature-complete migration of the PeasyPrints Flutter application to a web-first stack using Next.js (App Router, TypeScript), shadcn/ui, Tailwind CSS, Firebase JS SDK, Razorpay Web SDK, and PWA. Functionality, user flows, business logic, and data models must remain identical. The migration preserves all screens (Splash, Auth, Home with bottom navigation: Home/Shops/Orders/Profile, Upload, Payment confirmation dialogs), Firebase services (Auth, Firestore, Storage, Functions where applicable), PDF processing, location usage, pricing logic, and payment flow.

---

## Current Flutter Application Analysis

### Project Structure
- `lib/main.dart`: Monolithic app entry and most screens, widgets, business logic, navigation, and Firebase integration (~4,535 lines)
- `lib/GlobalVarProvider.dart`: Provider-based global state for pricing and file reference
- `lib/firebase_options.dart`: FlutterFire auto-generated config
- `assets/images/`: App images and logos
- `android/`, `ios/`, `macos/`, `windows/`: Platform projects
- `pubspec.yaml`: Dependencies and assets config
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`: Firebase config/rules/indexes

### Screen Inventory (Screen-by-Screen)

1) SplashScreen
- File: `lib/main.dart`
- Purpose: Launch gate; waits 2s then routes to `/home` or `/login` using `FirebaseAuth.currentUser`
- Interactions: None
- State: Reads auth state
- Navigation: To Home or Login
- External: Firebase Auth
- UI: Full-screen logo, simple delay
- Logic: 2s delay, auth check
- Errors: N/A

2) LoginScreen
- File: `lib/main.dart`
- Purpose: Email/password login and alternate phone-based registration path
- Interactions: Form submit, navigate to Registration/OTP
- State: Local form, potentially uses Provider after login to persist
- Navigation: To `RegistrationScreen` / `OTPEntryScreen` / Home
- External: Firebase Auth (email/password)
- UI: Material inputs/buttons
- Logic: Credential validation, sign-in
- Errors: SnackBars on failures

3) RegistrationScreen
- File: `lib/main.dart`
- Purpose: Register via phone number; initiate OTP
- Interactions: Enter phone, request OTP
- State: Local form; loading flags; `_useEmailAuth` fallback
- Navigation: To `OTPEntryScreen`
- External: `FirebaseAuth.verifyPhoneNumber`
- UI: TextFields; loading states
- Logic: Phone regex validation (India), cooldowns, auto verification path
- Errors: SnackBars; retries and fallback to email if repeated failures

4) OTPEntryScreen
- File: `lib/main.dart`
- Purpose: Enter 6-digit OTP to complete sign-in
- Interactions: OTP inputs, resend OTP
- State: Local OTP fields, cooldown timer
- Navigation: On success → Home; `_processAfterSignIn`
- External: Firebase Auth (credential sign-in)
- UI: Six input boxes, buttons
- Logic: Auto-fill handling, paste handling, resend timer, verification
- Errors: SnackBars on failure

5) HomePage (BottomNavigation)
- File: `lib/main.dart`
- Purpose: Main shell with tabs: HomeScreen, ShopsScreen, OrdersScreen, ProfileScreen
- Interactions: BottomNavigationBar tab selection
- State: Tab index; child screens manage their state
- Navigation: Tab switching; to UploadScreen from cards
- External: N/A
- UI: Material tabs, scaffold
- Logic: Simple
- Errors: N/A

5a) HomeScreen
- File: `lib/main.dart`
- Purpose: Overview: checks app updates, fetches location, recent orders summary, nearby shops
- Interactions: Open items, navigate to shops/orders
- State: `currentLocation`, app update dialog
- Navigation: To Shops/Orders/Upload
- External: Firestore (app_config, orders, shops), Geolocator
- UI: Sections, StreamBuilder lists, cards
- Logic: App update dialog via `app_config`, location permission workflow, recent order fetch
- Errors: Guarded; loading indicators

5b) ShopsScreen
- File: `lib/main.dart`
- Purpose: List print shops with pricing and details
- Interactions: Search, select shop (navigates to Upload)
- State: Stream of `shops`; format pricing
- Navigation: To `UploadScreen(shopId, pricing...)`
- External: Firestore `shops`
- UI: `ShopCard` entries rendered from stream
- Logic: Pricing mapping, logo URLs, timings
- Errors: Error text on stream error

5c) OrdersScreen
- File: `lib/main.dart`
- Purpose: User orders list with statuses
- Interactions: Open order details
- State: Stream of user `orders`
- Navigation: Detail dialog
- External: Firestore `orders`
- UI: List of `OrderCard`
- Logic: Filter by `userId`, order by timestamp, status display
- Errors: Error text on stream error

5d) ProfileScreen
- File: `lib/main.dart`
- Purpose: Show user info; policy texts; logout
- Interactions: Logout; open policy text content
- State: Reads `FirebaseAuth.currentUser`
- Navigation: Back/Home
- External: Firebase Auth
- UI: Simple info view and static text drawers
- Logic: Sign-out
- Errors: N/A

6) UploadScreen
- File: `lib/main.dart`
- Purpose: Configure print job and upload PDF
- Interactions: Choose PDF, set print color/format/size/orientation/binding, enter custom message, toggle emergency, set copies, preview, confirm
- State: Local selection state; uses `GlobalProvider.Commision` and sets `finalFile`
- Navigation: Shows `CustomDialog` (order summary/payment)
- External: `file_picker`, `path_provider`, `open_file`, `syncfusion_flutter_pdf` or `pdf` for processing; Firebase Storage for upload; Razorpay
- UI: Radio groups, counters, buttons
- Logic: PDF page counting, rotation, price calculation (see below), emergency surcharge, commissions
- Errors: SnackBars, disabled confirm when invalid

7) CustomDialog (Order confirmation & payment)
- File: `lib/main.dart`
- Purpose: Summarize order, calculate total, handle payment, upload to storage, create Firestore order
- Interactions: Confirm triggers Razorpay payment
- State: `_isConfirmLoading`
- Navigation: On success → OrdersScreen
- External: Razorpay payment; Firebase Storage upload; Firestore `orders`
- UI: Dialog with breakdown and actions
- Logic: `_placeOrderAfterPaymentSuccess()` uploads file, computes fields, writes order
- Errors: Guarded; error SnackBars on failure

8) Reusable Widgets
- `ShopCard`, `OrderCard`, `RecentOrderCard`, `OrderDetailsDialog`: Presentational + some navigation hooks (all in `lib/main.dart`)

### State Management Analysis (Provider)
- File: `lib/GlobalVarProvider.dart`
- Fields (pricing & config):
  - A4: `A4SingBlaWh=2`, `A4SingColor=5`, `A4DoubBlaWh=3`, `A4DoubColor=6`
  - A3: `A3SingBlaWh=4`, `A3SingColor=8`, `A3DoubBlaWh=5`, `A3DoubColor=10`
  - Binding: `SoftBinding=20`, `HardBinding=30`
  - Emergency: `EmergencyPr=15`
  - `Commision=0`
  - `late File finalFile`
- Methods: `updateValues({...})` setter that updates provided fields and `notifyListeners()`
- Sharing: Provided at app root via `MultiProvider`; screens use `context.watch<GlobalProvider>()`
- Triggers: User selections, admin-config, or defaults; price calculation reads these values
- Real-time: Pricing in Flutter is static/provider-based (shop pricing pulled from Firestore for display and calculations; provider holds default/base values)

### Firebase Integration Details
- Auth:
  - Email/password login
  - Phone OTP registration and OTP verification
  - `_processAfterSignIn`: writes user document to `users/{uid}` (username, metadata)
- Firestore:
  - `shops`: Shop profile & pricing documents (nested maps for A4/A3 pricing and additional services)
  - `orders`: New orders with fields: `userId`, `shopId`, `shopName`, `userName`, `fileName`, `fileUrl`, `totalPages`, `totalCost`, `status`, `timestamp`, `emergency`, `printSettings{...}`, `pricingDetails{...}`
  - `users`: User profile data
  - `app_config`: `latestVersion`, `isMandatory` for update dialogs
- Storage:
  - Uploads processed PDF to `orders/{timestamp}.pdf`, retrieves download URL
- Real-time:
  - `StreamBuilder` listeners on `shops` and user `orders`
- Security Rules (current): very relaxed (`allow read, write: if true;`) – retained for parity but should be tightened later

### External Service Integration
- Razorpay Flutter SDK: Checkout popup for payments; success triggers order placement
- PDF Processing: `syncfusion_flutter_pdf` and `pdf` for page counting and rotation
- File Selection: `file_picker`, open/preview with `open_file`
- Location: `geolocator` for permission & current location; dialogs to encourage enabling services
- Other: `google_fonts`, `url_launcher`, `permission_handler`, `package_info_plus`, `firebase_app_check`

### Business Logic Documentation
- Pricing:
  - Price per page determined by `paperSize` (A3/A4), `printFormat` (Single/Double), `printColor` (B&W/Color) using shop pricing where provided; otherwise provider defaults
  - Total cost = (pages × pricePerPage) + bindingCost + emergencyCost + commission
  - Binding cost: Soft/Hard/Spiral (mapped to provided pricing; soft/hard from provider; spiral via shop services when present)
  - Emergency surcharge adds fixed amount
- Print Settings: paper size, format, color, orientation, binding, copies, custom message, optional extra color page count
- Order Workflow:
  1) User selects shop → configures job → selects file → (optionally rotates PDF) → confirms → Razorpay payment → upload file to Storage → create Firestore `orders` doc → navigate to OrdersScreen
- Auth Rules: Phone number format validated (India), cooldowns for OTP resend; email login alternative
- File Processing: Count pages; rotate 90° for horizontal orientation; save modified PDF before upload

---

## Next.js Target Architecture

### Technology Stack
- Next.js 14 (App Router) + TypeScript
- UI: shadcn/ui + Tailwind CSS
- State: Zustand (global app state + pricing) + React state
- Firebase JS SDK v9+ (Auth, Firestore, Storage, Functions optional)
- Payments: Razorpay Web SDK (Checkout.js) with same fields
- PDF: `pdf-lib` (page rotation, save) + `pdfjs-dist` (reliable page counting) – strictly to replicate Flutter behavior
- Location: Web Geolocation API + `navigator.permissions` fallback messaging
- PWA: `@ducanh2912/next-pwa` + custom `firebase-messaging-sw.js` for FCM (optional parity if needed)

### Proposed Project Structure
```
src/
  app/
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    (auth)/otp/page.tsx
    dashboard/page.tsx                # HomeScreen
    shops/page.tsx                    # ShopsScreen
    orders/page.tsx                   # OrdersScreen
    profile/page.tsx                  # ProfileScreen
    upload/[shopId]/page.tsx          # UploadScreen
    layout.tsx                        # Root layout with providers & bottom nav
  components/
    layout/BottomNav.tsx
    shops/ShopCard.tsx
    orders/OrderCard.tsx
    orders/RecentOrderCard.tsx
    upload/PrintOptions.tsx
    upload/FilePicker.tsx
    upload/OrderSummaryDialog.tsx     # CustomDialog
  lib/
    firebase/config.ts
    firebase/auth.ts
    firebase/firestore.ts
    firebase/storage.ts
    pdf/pdf.service.ts                # pageCount, rotate
  stores/
    pricingStore.ts                   # Zustand: mirrors GlobalProvider
    authStore.ts
    ordersStore.ts
    shopsStore.ts
  types/
    models.ts                         # Shop, Order, User, PrintSettings
  styles/globals.css
public/
  manifest.json
  firebase-messaging-sw.js (if FCM parity is required)
```

### Component Hierarchy (High-Level)
- Pages: Splash (handled by auth-gate redirect), Login, Register, OTP, Dashboard(Home), Shops, Orders, Profile, Upload(shopId)
- Layout: `layout.tsx` with `<BottomNav />` (tabs: Home/Shops/Orders/Profile)
- UI Components: `ShopCard`, `OrderCard`, `RecentOrderCard`, `OrderSummaryDialog`, `PrintOptions`, `FilePicker`
- Business Components: Summary dialog computing totals; PDF service for rotation/page-count; Payment handler component

### State Management Strategy (Zustand)
- `pricingStore`
  - Fields: mirrors `GlobalProvider` – `A4SingBlaWh`, `A4SingColor`, `A4DoubBlaWh`, `A4DoubColor`, `A3SingBlaWh`, `A3SingColor`, `A3DoubBlaWh`, `A3DoubColor`, `SoftBinding`, `HardBinding`, `EmergencyPr`, `Commision`, `finalFile` (File | null)
  - Actions: `updateValues(partial)`, `setFinalFile(file)`
- `authStore`
  - Fields: `user`, loading, otp state; actions: phone/email login, verify OTP, logout
- `shopsStore`
  - Fields: `shops`, loading, error; actions: subscribe to `shops`
- `ordersStore`
  - Fields: `orders` for user; actions: subscribe by `userId`, `createOrder(order)`, `updateStatus`

### Routing Plan (Next.js App Router)
- Splash replacement: root layout performs auth gate; if no user → `/login`, else → `/dashboard` (showing HomeScreen content)
- `/dashboard`: mirrors HomeScreen (update modal, location prompt, nearby shops & recent orders)
- `/shops`: mirrors ShopsScreen
- `/orders`: mirrors OrdersScreen
- `/profile`: mirrors ProfileScreen
- `/upload/[shopId]`: mirrors UploadScreen with selected shop pricing
- Auth pages: `/login`, `/register` (phone/email collection), `/otp`

---

## Feature-by-Feature Migration Mapping

| Flutter Feature | Flutter Location | Next.js Page/Component | shadcn/ui Components | State/Store |
|---|---|---|---|---|
| Splash (2s delay + auth check) | `main.dart` | Auth gate in `layout.tsx` + redirect | N/A | `authStore` (user) |
| Login (email/password) | `main.dart` | `(auth)/login/page.tsx` | `Input`, `Button`, `Card` | `authStore` |
| Registration (phone number) | `main.dart` | `(auth)/register/page.tsx` | `Input`, `Button`, `Card` | `authStore` (send OTP) |
| OTP Entry | `main.dart` | `(auth)/otp/page.tsx` | `Input`×6, `Button`, `Card` | `authStore` (verify) |
| HomeScreen | `main.dart` | `dashboard/page.tsx` | `Card`, `Badge`, `Button`, `Dialog` | `ordersStore`, `shopsStore` |
| ShopsScreen | `main.dart` | `shops/page.tsx` | `Card`, `Badge`, `Input` | `shopsStore` |
| OrdersScreen | `main.dart` | `orders/page.tsx` | `Card`, `Badge`, `Tabs` | `ordersStore` |
| ProfileScreen | `main.dart` | `profile/page.tsx` | `Card`, `Button`, `Accordion` | `authStore` |
| UploadScreen | `main.dart` | `upload/[shopId]/page.tsx` | `RadioGroup`, `Button`, `Card`, `Dialog` | `pricingStore` + local state |
| CustomDialog (Order Summary & Payment) | `main.dart` | `OrderSummaryDialog.tsx` | `Dialog`, `Button`, `Badge` | `ordersStore`, `pricingStore` |
| RecentOrderCard | `main.dart` | `orders/RecentOrderCard.tsx` | `Card` | `ordersStore` |
| ShopCard | `main.dart` | `shops/ShopCard.tsx` | `Card`, `Badge` | `shopsStore` |

---

## Screen Migration Plan (Detailed)

Template fields shown for key screens:

1) Flutter: SplashScreen → Next.js: Auth Gate in `app/layout.tsx`
- Required Components: N/A (redirect logic)
- State: `authStore.user`
- Data: `FirebaseAuth.onAuthStateChanged`
- Interactions: none; 2s delay optional (not critical to UX; if required, add small timeout before redirect)
- Navigation: push to `/dashboard` or `/login`

2) Flutter: LoginScreen → `(auth)/login/page.tsx`
- Components: `Card`, `Input`, `Button`, `Alert`
- State: `authStore`
- Data: email/password login via Firebase Auth
- Validation: Email format, non-empty password
- Handlers: `onSubmit` → `authStore.loginWithEmail`
- Navigation: On success → `/dashboard`

3) Flutter: RegistrationScreen → `(auth)/register/page.tsx`
- Components: `Card`, `Input`, `Button`
- State: `authStore`
- Data: `sendOTP(phone)` using RecaptchaVerifier (invisible)
- Validation: India phone regex (same pattern)
- Navigation: On send → `/otp`

4) Flutter: OTPEntryScreen → `(auth)/otp/page.tsx`
- Components: 6 inputs, resend cooldown, button; `Card`
- State: `authStore`: `verificationId`, cooldown timer
- Data: `signInWithCredential`
- Validation: 6 digits; paste handling
- Navigation: On success → `/dashboard`

5) Flutter: HomeScreen → `dashboard/page.tsx`
- Components: `Card`, `Dialog`, `Button`, `Badge`
- State: `shopsStore`, `ordersStore`
- Data: Firestore: `app_config`, user `orders`, `shops`
- Interactions: View recent orders & shops; navigate to upload
- Extra: Update dialog using `app_config`

6) Flutter: ShopsScreen → `shops/page.tsx`
- Components: `Input` (search), `ShopCard`
- State: `shopsStore`
- Data: Firestore `shops` onSnapshot
- Interactions: Tap shop → `/upload/[shopId]`

7) Flutter: OrdersScreen → `orders/page.tsx`
- Components: `OrderCard`, `Tabs/Filters` (optional parity)
- State: `ordersStore`
- Data: `orders` filtered by `userId`
- Interactions: View details

8) Flutter: ProfileScreen → `profile/page.tsx`
- Components: `Card`, `Button`
- State: `authStore`
- Data: `FirebaseAuth.currentUser`
- Interactions: Sign out, view policy texts (static sections)

9) Flutter: UploadScreen → `upload/[shopId]/page.tsx`
- Components: `RadioGroup`, `Select` (if needed), `FilePicker`, `OrderSummaryDialog`
- State: local (selections) + `pricingStore`
- Data: shop pricing (from query) + provider defaults
- Validation: file selected, pages>0
- Interactions: rotate orientation, copies, binding, emergency, message
- Navigation: confirm → open `OrderSummaryDialog`

10) Flutter: CustomDialog → `OrderSummaryDialog.tsx`
- Components: `Dialog`, `Button`, `Badge`
- State: `_isConfirmLoading` equivalent local state
- Data: compute totals using same formula; Razorpay checkout; on success upload to Storage and create `orders` doc
- Errors: toast/alert on failures; disable confirm states

---

## State Management Migration (Provider → Zustand)

Mapping:
- GlobalProvider fields → `pricingStore` state:
  - A4/A3 price fields; SoftBinding/HardBinding; EmergencyPr; Commision; `finalFile`
- `updateValues({...})` → `pricingStore.updateValues(partial)`
- `finalFile` setter → `pricingStore.setFinalFile(file)`
- Access pattern: `const { A4SingBlaWh, ... } = usePricingStore()` and `useShallow` selectors for performance
- Real-time: Shop-specific pricing remains from Firestore; provider defaults remain in store
- Error state: stores expose `error` string and set on exceptions; UI renders Toast/Alert

---

## Data Flow Documentation (Major Flows)

1) Auth Flow (Phone)
- User Action: send OTP → Firebase Auth (Recaptcha + verifyPhoneNumber)
- State Change: `authStore.verificationId` set
- UI Update: Navigate to OTP; show cooldown
- Response Handling: `verifyOTP` → on success set `authStore.user`
- Error: set error → show toast; provide fallback to email

2) Shop Discovery Flow
- User Action: open Shops → subscribe `shopsStore`
- State Change: `shops` updated via onSnapshot
- UI Update: `ShopCard` list renders
- Error: show error banner

3) Upload & PDF Processing
- User Action: select file → `pdf.service.pageCount(file)`; rotate if horizontal via `pdf-lib`
- State Change: `pricingStore.finalFile` updated
- UI Update: show selected filename, enable confirm
- Error: show toast and disable confirm

4) Payment & Order Creation
- User Action: confirm order → Razorpay
- Response: on success → upload file to Storage; create `orders` doc with same fields
- State Change: orders stream updates in `ordersStore`
- UI Update: navigate to Orders page; show success toast
- Error: handle payment or upload errors via toast, keep dialog open

5) Real-time Orders
- Firestore onSnapshot for `orders` filtered by userId; updates list in real-time

---

## Implementation Plan

### Phase 1: Project Setup & Core
- Initialize Next.js + Tailwind + shadcn/ui + Zustand
- Firebase JS config; Auth guard in layout
- Bottom navigation layout; route skeletons

### Phase 2: Authentication & Navigation
- Email/password login
- Phone OTP flow with Recaptcha and OTP screens
- Auth gate redirects; sign-out; `_processAfterSignIn` parity (write user doc)

### Phase 3: Business Logic & State Management
- Implement `pricingStore`, `shopsStore`, `ordersStore`
- Home/Shops/Orders/Profile pages with onSnapshot streams
- Shop pricing mapping identical to Flutter

### Phase 4: External Integrations
- PDF service: page counting and rotation
- Razorpay web checkout with same fields and callbacks
- Storage upload and `orders` document creation (exact schema)
- Location (permissions flow + prompts)

### Phase 5: PWA & QA
- PWA manifest, service worker; optional FCM parity
- Accessibility and performance passes
- End-to-end parity testing for all flows

---

## Risk Assessment & Mitigations
- PDF Processing in Browser: Large files may be memory-heavy → use streaming where possible; cap file size similar to Flutter UX
- iOS Push Notifications (if parity required): Limited web push support historically; communicate platform caveats
- Razorpay in PWA: Ensure HTTPS, correct domain whitelisting, and handle iOS in-app browser quirks
- App Check: Web Recaptcha provider; ensure tokens don’t block Firestore/Storage access
- Very Relaxed Firestore Rules: For parity keep; plan hardening after migration

---

## Success Criteria
- 100% feature parity: identical screens, flows, and calculations
- Data model compatibility: same Firestore collections/fields and Storage paths
- Payment completes and produces orders identical to Flutter
- Real-time updates and navigation mimic the existing UX
- Performance meets or exceeds Flutter for core flows
