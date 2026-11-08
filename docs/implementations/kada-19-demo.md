# KADA-19 · Swoop demo site on sample data

This is the plan for the KADA-19 Nightly. The run branch is `kada-19/demo-site`, cut from `kada-18/implement-redesign`, which holds the 7 Nov Swoop redesign built by the KADA-18 Nightly.

- **Briefs:** `docs/implementations/kada-19-packages.json` has 26 packages in 5 waves, plus the shared `common_rules`.
- **Runbook:** `docs/implementations/kada-19-demo-nightly.md`.
- **Record:** `docs/implementations/kada-19-ledger.md` is the only record of what is done.
- This file is the reference for people. Agents never read it.

## Goal

Build a demo of Swoop that anyone can browse on a laptop, like Folyo's preview site. Every student screen works on sample data, including the sign-in flow, with no keys and no live services. One command starts it: `npm run demo`, then open http://localhost:3019.

## Decided (owner, 8 Nov 2026; do not reopen)

- **Local only for now.** One command runs the demo on the laptop, on a fixed port. No deploy.
- **Simulated full sign-in flow.** Visitors go through the real screens: pick campus, Continue with Google (mocked), domain check, course step. They can also skip straight in as a sample student. No real accounts, no Clerk.
- **No env at all.** The demo runs without Clerk, Firebase or Razorpay keys. Demo stand-ins replace ClerkProvider, the Firebase client, the Admin SDK, Storage uploads and Razorpay checkout. Print ordering and payment are simulated end to end: upload, pick a shop, pay, and the order status moves along.
- **Visitor changes stay in that visitor's browser** until they press "Reset demo". That covers posts, saves, reserves, contact requests, prints, blood opt-in and game joins. Visitors never see each other's changes.
- **Sample world:** KJU Main and Airport Road, with full sample data on every surface, 3-4 student personas, and a demo-date switch (May move-out, July arrivals, November) so the seasonal screens show.
- **Demo bar:** small and always visible (persona, demo date, Reset demo). It never hides app UI. Plain copy, design system v1.
- **No live services tonight.** Never build events, gigs, jobs, food surfaces or pets.
- **Skipped KADA-18 checks:** use demo mode to finally run the KADA-18 browser checks that were skipped (the "Skipped verifications" section of `kada-18-ledger.md`), and fix what they find.

## Decided while planning (safest reversible choice; the owner can change any of these in the morning)

Three read-only maps of the code (data and server, sign-in, user-facing routes) were merged into this plan. Where they disagreed, this table records the call and why.

| # | Question | Choice | Why | Undo |
|---|---|---|---|---|
| 1 | How are Clerk, Firebase and Razorpay replaced? | **Webpack aliases in the demo dev build only** (Folyo's pattern): `@clerk/nextjs`, `@clerk/nextjs/server`, `@clerk/nextjs/errors`, `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/storage` and `razorpay` resolve to files in `src/lib/demo/shims/`. The sign-in map proposed a hand-written auth facade instead. | The alias approach makes zero edits at about 30 Clerk call sites and about 20 Firebase call sites, so production code stays as it is. The facade would touch about 25 files that other packages also edit. Three guards keep the aliases out of production (see "Switching it on"). | Delete `src/lib/demo/shims/` and the demo block in `next.config.js`. |
| 2 | Who answers `/api` in the demo? | **The server**, from the visitor's own in-memory world: the KADA-18 fake Admin DB and bucket, one per visitor. The browser keeps the durable copy in IndexedDB. | Swoop has about 45 routes of real logic that already run on the fakes. Folyo answers `/api` in the browser, but copying that would mean writing all that logic twice. | Not reversible cheaply; this is the core design. |
| 3 | What does the demo date move? | **Only the season helpers and the seasonal sample packs.** | Patching the clock everywhere would touch about 195 `Date` calls in 86 files, or need a global Date patch on the server per request. | Trade-off: absolute dates elsewhere ("Available 20 Nov", order dates) still follow the real calendar. |
| 4 | Port and build folder | **Port 3019** (the brief's port; one map proposed 3100). Build folder `.next-demo`, so the demo can run beside `npm run dev`. | Next 16 lets only one `next dev` use a build folder at a time. | Change `DEMO_PORT` in `src/lib/demo/contract.ts`. |
| 5 | Godview and shopfront | **Not in the demo.** `/godview*` and `/shopfront*` show a plain "not part of the demo" page. | They would need an admin persona and 8 more client-Firestore pages, and visitors don't browse them. | Remove the redirect in `proxy.ts`. |
| 6 | Personas | **Sana** (KJU Main, verified, default), **Kabir** (KJU Airport Rd, verified), **Ananya** (Girls' space approved) and **Meera** (ID card pending). **Riya** is the new student in the sign-in walk-through. No admin persona. | They cover every state the screens have: verified on each campus, Girls' space, pending, and new. | Edit `DEMO_PERSONAS`. |
| 7 | Listing photos | **Keep `images: []`.** Cards show the design's no-photo state. A visitor's own uploads work through the fake bucket. | The design rule is no stock photos, and the repo has no sample photos. | Add photos to the fixtures later. |
| 8 | Mocked Google step | **A plain Swoop sheet, "Pick a sample account", with a Demo chip.** It offers `riya@kju.test` (college), `riya.t@gmail.test` (personal) and the four sample students. | It must never look like Google's real picker, so shared screenshots can't read as phishing. The `.test` domains are plainly fake. | Copy lives in `DemoAccountChooser.tsx`. |
| 9 | ID card review | **An "Approve my card (demo)" button** under the pending state, not a timer. | It is visible and easy to test, and the visitor stays in control. | Remove the button. |
| 10 | The other side of the sample world | **Demo life:** sample sellers approve an ask after about 10 s, a sample student asks on a visitor's new post after about 45 s, and a sample player joins a game after about 20 s. All of it goes through the real contact-request and notification code. | Without it, every ask would sit at "pending" forever and the activity screens would look dead. | Empty `tickLife` in `src/lib/demo/server/life.ts`. |
| 11 | WhatsApp, phone, mail and Instagram links | **They open a demo sheet** ("In the real app this opens WhatsApp with Farhan"). | They must never open a real service or a real number. | Remove the demo branch from the four files. |
| 12 | First visit | **It goes to `/demo`**, which offers three choices: sign in like a new student, jump in as a sample student, or look around signed out. | The visitor learns it is a demo before anything else. | Remove step 2 of the demo branch in `proxy.ts`. |
| 13 | "npm run build in demo mode" | **`npm run demo:check`.** By design, a production build can never be in demo mode: the config refuses to start. So the demo-mode build starts the demo and compiles every page under the stand-ins, failing on any compile error or 500. The plain `npm run build` still runs to prove that no stand-in leaks into it. | It keeps the "never in production" guard absolute. | None needed. |
| 14 | Session cookie | **Readable by the browser and unsigned.** | It is dev-only and local, and every `/api/demo/*` route returns 404 outside demo. It must never be deployed as is. | Sign it before any deploy. |

## Architecture of demo mode

### Switching it on, and why it can never run in production

- **The launcher.** `npm run demo` runs `scripts/demo.mjs`. It sets `NEXT_PUBLIC_SWOOP_DEMO=1` and `NEXT_PUBLIC_SWOOP_FIXTURES=1`, gives Razorpay, the webhook and cron placeholder values, and blanks the analytics keys. Then it runs `next dev --webpack -p 3019` and pre-loads the main routes. `npm run demo:check` does the same, then compiles every static page and exits.
- **The flag.** `isDemoMode()` is `NEXT_PUBLIC_SWOOP_DEMO === '1' && NODE_ENV !== 'production'`. It uses literal env reads, so Next inlines it into bundles, and it is always false in a production build. Demo mode implies fixture mode.
- **Guard 1: `next.config.js`.** It adds the demo block only when the flag is on in development. It throws a plain error if the flag meets `next build`, `next start` or Turbopack.
- **Guard 2: aliases.** The aliases and the same-origin CSP exist only inside that block. A unit test checks the wiring, and a grep after the plain `npm run build` checks that no shim file reached `.next`.
- **Guard 3: routes.** Every `/api/demo/*` route returns 404 unless `isDemoMode()`. `/api/dev/fixture-user` returns 404 in demo.
- **Deploys.** `vercel.json` turns off deployments for `kada-19/**`. The plan commit adds that line.

### How a request is answered

```
Browser ──► proxy.ts (demo branch)
              1. mint swoop_demo_visitor if missing (on the request and the response)
              2. first page visit with no visitor cookie ──► /demo?next=<path>
              3. /godview*, /shopfront* ──► /demo/not-included
              4. existing clerkProxy, whose clerkMiddleware/auth now come from the Clerk server stand-in:
                 signed out on a non-public page ──► /login?redirect_url=…; signed in on /login ──► target
         ──► page or route handler (unchanged code)
              getAdminDb() / getAdminBucket() ──► world for this visitor id
                                                  (FakeFirestore + FakeBucket, seeded from the sample world,
                                                   plus the seasonal pack for swoop_demo_date)
              on each world access (at most every 2 s): tickOrders (print progress), tickLife (demo life)
Client Firestore reads (ordersStore, shopsStore, pickup page, authStore)
         ──► firebase/firestore stand-in ──► POST /api/demo/firestore ──► the same world
              onSnapshot polls every 2.5 s while the tab is visible and emits only on change
```

### Persistence: the visitor's own browser

- **Change log.** Each world counts a `rev` and logs the doc paths and bucket files that changed. Rate-limit docs, idempotency docs and seasonal pack docs are left out.
- **Pulling changes.** `DemoPersistence` (mounted by `DemoRoot` in the root layout) pulls `GET /api/demo/state?since=` after every non-GET `/api` call and every 15 s while the tab is visible. It merges the changes into one overlay in IndexedDB (`swoop-demo`). Print PDFs are too big for localStorage, which is why it uses IndexedDB.
- **After a server restart,** the world comes back fresh with a new `bootId`. The browser sees `fresh: true`, posts its overlay back (`POST /api/demo/state`) and reloads once.
- **Isolation.** Visitors never share a world, because the world is picked by the `swoop_demo_visitor` cookie. All personas share one visitor's world, so a visitor can switch from Sana to Kabir and see both sides of a contact request.
- **Private windows.** In a private window, or with storage blocked, changes last only for the server's lifetime. No error is shown.

### Reset

Pressing "Reset demo" (in the bar or the desktop panel, after one confirm) does this:

1. `POST /api/demo/reset` drops the world, sets a new visitor id, and clears the session and date cookies.
2. The browser deletes the IndexedDB store, the `swoop-demo:*` keys, the college pick (`college-store`), the saved blood WhatsApp number and the analytics consent key, and clears sessionStorage.
3. It goes to `/demo`.

### Demo date

- **The cookie.** `swoop_demo_date` takes one of three values:
  - `nov`, the default: today if today falls between 15 Oct and 30 Nov, else the next 10 Nov.
  - `may`: the next 20 May.
  - `july`: the next 10 Jul.
- **Who reads it.** `useSeasonNow()` feeds the season helpers on Home, Market, Housing and the housing card. It is hydration-safe and returns the real time when demo is off. `app/api/housing/posts/route.ts` reads the cookie itself.
- **Switching.** Changing the date runs `applySeason` in the visitor's world. It removes the other packs' `season-*` docs and seeds this one: May brings move-out bundles and summer sublets, July brings room-wanted posts, new-student deals and set-up-room items. The visitor's own posts and saves stay.

### Auth stand-in

- **Session cookie.** `swoop_demo_session` holds `{uid, emails?}` as base64url JSON. No cookie means signed out. Persona names and emails come from `fixtureIdentity`. Only the walk-through user (Riya, uid `new-user`) carries emails in the cookie.
- **Server stand-in.** `@clerk/nextjs/server` resolves to the stand-in, so `auth()`, `currentUser()`, `clerkClient()` and `clerkMiddleware()` read the cookie. In demo, `src/lib/campus/auth.ts` uses that Clerk path, so the existing college-domain auto-approve and onboarding run unchanged. A Google email on `kju.test` is approved by domain; a `gmail.test` one lands on "That's not a KJU email". The Firebase custom token is `demo:<uid>`, and `requestAuth` accepts it.
- **Client stand-in.** `@clerk/nextjs` resolves to the client stand-in, which provides `ClerkProvider`, `useAuth`, `useUser` (including adding a college email with any 6-digit code), `useClerk().signOut`, `UserButton` (the demo avatar menu) and `AuthenticateWithRedirectCallback`.
- **Screens.** The real `/login` and `/campus/verify` screens are used:
  - Continue with Google opens the demo chooser.
  - Email code takes any 6 digits.
  - "Just looking? Skip in as a sample student" opens the chooser's student list.
  - Sign-in, sign-out and persona switches do full page loads, so the client stores reset.
- **`/api/demo/session`.** It handles a persona, Google college or personal, an email code, adding an email, and sign out. Walk-through sign-ins delete Riya's membership in that visitor's world, so onboarding plays again.

### Payments stand-in

- **Unchanged code.** `CheckoutButton` and the real `/api/razorpay/order`, `/api/razorpay/verify`, `/api/razorpay/webhook` and `/api/orders/create` run as they are.
- **Server stand-in.** The `razorpay` package resolves to a stand-in (`orders.create`, `payments.fetch`) that keeps its records in the visitor's world.
- **Checkout sheet.** `loadRazorpay()` installs a `window.Razorpay` stand-in instead of loading checkout.razorpay.com. It opens `DemoPaySheet` ("Demo payment. No money moves.") with Pay, Payment fails and Cancel.
- **Pay.** `POST /api/demo/razorpay/pay` plays Razorpay's servers. It signs `order|payment` with the launcher's placeholder secret, sends a signed webhook to `/api/razorpay/webhook`, and returns the handler fields. CheckoutButton then calls verify and create as usual and lands on `/orders`.
- **Order progress.** `tickOrders` moves the order from processing to printing at 15 s and to printed (ready for pickup) at 45 s. On the pickup page, "Shop hands it over (demo)" marks it collected.
- **Files.** Print PDFs and images go through `/api/storage/upload` into the visitor's fake bucket. "Try a sample PDF" builds a 4-page PDF offline with pdf-lib.

### No live services

- **Analytics off.** PostHog is off on the client and the server, and the `/ph` rewrites are gone. AnalyticsConsent, Speed Insights and the Agentation toolbar don't render. The CSP sets `connect-src 'self'`. Rate limiting is off.
- **SDKs can't load.** The Clerk and Firebase SDKs can't load at all. The launcher overrides the Razorpay, PostHog and cron values, so a real `.env.local` can never reach a service.
- **One outside fetch remains:** `next/font` downloads Google Fonts on the server when the dev server compiles. That is not a product service; offline, it falls back to system fonts.

## Shared contract (fixed in wave 1 by SWITCH; repeated in `common_rules`)

| Item | Value |
|---|---|
| Flag | `isDemoMode()` in `src/lib/demo/mode.ts`; `isFixtureMode()` is also true in demo |
| Command and URL | `npm run demo`, http://localhost:3019, build folder `.next-demo`; `npm run demo:check`; `npm run demo:smoke` (from APICHK) |
| Cookies | `swoop_demo_visitor` (httpOnly, minted by the proxy), `swoop_demo_session` (readable base64url JSON `{uid, emails?:[{address, verified, google}]}`), `swoop_demo_date` (`nov`, `may` or `july`) |
| Personas | `sana` = `verified-kju-main`, `kabir` = `verified-kju-airport`, `ananya` = `girls-approved`, `meera` = `pending-id-card`; walk-through `new-user` (Riya) with `riya@kju.test` or `riya.t@gmail.test` |
| Demo API (404 outside demo) | `/api/demo/session` (+ `/card`), `/api/demo/firestore`, `/api/demo/state`, `/api/demo/reset`, `/api/demo/date`, `/api/demo/razorpay/pay`, `/api/demo/orders/[id]/collect` |
| Shim files | `src/lib/demo/shims/clerk-client.tsx`, `clerk-server.ts`, `clerk-errors.ts`, `firebase-app.ts`, `firebase-auth.ts`, `firebase-firestore.ts`, `firebase-storage.ts`, `razorpay-server.ts`; each alias goes live once its file exists |
| World hooks | `src/lib/demo/server/orderProgress.ts` (`tickOrders`), `life.ts` (`tickLife`), `seasonPack.ts` (`applySeason`); WORLD creates them as stubs and later packages fill them |
| Seasonal docs | ids start with `season-` and are never persisted as visitor changes |
| Demo root | `src/components/demo/DemoRoot.tsx`, mounted once in `app/layout.tsx` by SHELL; PERSIST adds `DemoPersistence`, DEMOBAR adds the bar |

## Packages

Sizes: S is about 0.5 h, M about 1 h, L about 1.5 h of agent work, including self-review and the lead's verify. All 26 packages run on the strongest model; none is purely mechanical.

| ID | Title | Files | Size | Depends on | Acceptance |
|---|---|---|---|---|---|
| SWITCH | Demo switch, shared contract, launcher and alias wiring | `src/lib/demo/mode.ts`, `src/lib/demo/contract.ts`, `src/lib/demo/build-config.cjs`, `scripts/demo.mjs`, `next.config.js`, `package.json`, `src/lib/firebase/fixtureMode.ts`, `tsconfig.json`, `.gitignore`, `eslint.config.mjs`, `tests/demo/contract.test.ts`, `tests/demo/build-config.test.ts` | M | none | With every .env* file moved aside, npm run demo reaches Ready on http://localhost:3019. With the demo flag set, next build refuses to start with a plain message. Plain npm run build compiles and nothing under .next mentions src/lib/demo/shims. Tests cover the session codec (empty, malformed, unknown uid, more than 3 emails), the persona table, the date ids and the alias wiring (off unless the flag is on outside production; matches the barrel '!=!' request form). typecheck, lint and test green. |
| SEED | Sample world: every surface full on both campuses, print orders and users | `src/lib/campus/fixtures/market.ts`, `src/lib/campus/fixtures/housing.ts`, `src/lib/campus/fixtures/utilities.ts`, `src/lib/campus/fixtures/shops.ts`, `src/lib/campus/fixtures/print.ts`, `src/lib/campus/fixtures/index.ts`, `src/lib/firebase/fakeSeed.ts`, `tests/campus/fixtures.test.ts` | L | none | tests/campus/fixtures.test.ts passes: every persona owns at least one market and one housing post; KJU Airport Rd has 8+ market, 4+ housing, 2 deals, 1 game, 1 lost-found and one open shop; a reserved, a price-dropped (last 7 days), an agent and a 4-day-old Sana post exist; Sana has a ready order today, a printing order and two collected; each persona has a users doc and 2+ notifications; no dropped-feature words; dates relative to now. All existing tests still pass. |
| WORLD | One fake world per visitor: Admin DB, bucket, change log and hooks | `src/lib/firebase/fakeAdmin.ts`, `src/lib/firebase/admin.ts`, `src/lib/demo/server/world.ts`, `src/lib/demo/server/orderProgress.ts`, `src/lib/demo/server/life.ts`, `src/lib/demo/server/seasonPack.ts`, `tests/demo/world.test.ts`, `tests/firebase/fake-admin.test.ts` | L | SWITCH, SEED | world.test.ts: writes in world A are invisible in world B; transactions run one at a time per world; with no request context the 'default' world is used with one warning; each world has bootId, rev and a change log of doc paths and bucket files that skips _rate_limits, payment_idempotency and 'season-' docs; tickOrders and tickLife run at most every 2 s per world; applySeason runs when a world is created; past 50 worlds the oldest is evicted. Plain fixture mode keeps one shared store. All existing tests pass. |
| CLERKSRV | Clerk server stand-in, demo identity and the session API | `src/lib/demo/shims/clerk-server.ts`, `src/lib/demo/server/identity.ts`, `app/api/demo/session/route.ts`, `app/api/demo/session/card/route.ts`, `src/lib/campus/auth.ts`, `src/lib/server/requestAuth.ts`, `app/api/auth/firebase-custom-token/route.ts`, `app/api/dev/fixture-user/route.ts`, `tests/demo/identity.test.ts` | L | SWITCH | On :3019 with no env: no cookie, GET /api/campus/session is signed out. POST /api/demo/session {persona:'sana'}: Sana at KJU Main, verified. {google:'college'} then POST /api/campus/onboarding {collegeId:'kju', campusId:'kju-main'}: domainMismatch false, needs course. {google:'personal'}: domainMismatch true. PATCH {addEmail:'riya@kju.test'} then onboarding {}: approved. /api/demo/session/card approves Meera's pending card. DELETE signs out. /api/storage/upload, /api/razorpay/order and /api/users/upsert give 401 signed out and work signed in, never a Clerk error or 500. /api/dev/fixture-user is 404 in demo. |
| CLERKUI | Clerk client stand-in, avatar menu and the demo account chooser | `src/lib/demo/shims/clerk-client.tsx`, `src/lib/demo/shims/clerk-errors.ts`, `src/lib/demo/client/session.ts`, `src/components/demo/DemoUserMenu.tsx`, `src/components/demo/auth/DemoAccountChooser.tsx` | L | SWITCH | At the end of wave 2 (needs CLERKSRV and FIREBASE too), on :3019 with no env: / renders with no ClerkProvider error; signed out, the navbar shows a Sign in link; after signInAs('sana') the avatar menu shows Sana, her email, Profile, Switch student and Sign out; Sign out lands on / signed out; openDemoAccountChooser() shows the Demo-marked sheet (college account, personal account, four sample students, Cancel) at 375 and 1280 px; no request to any clerk host. typecheck and lint clean. |
| FIREBASE | Firebase client stand-ins backed by the visitor's world | `src/lib/demo/shims/firebase-app.ts`, `src/lib/demo/shims/firebase-auth.ts`, `src/lib/demo/shims/firebase-firestore.ts`, `src/lib/demo/shims/firebase-storage.ts`, `app/api/demo/firestore/route.ts`, `src/lib/demo/server/clientQuery.ts`, `src/lib/demo/codec.ts`, `tests/demo/codec.test.ts`, `tests/demo/client-query.test.ts` | L | SWITCH | On :3019 with no env (end of wave 2): /, /orders, /shops and /upload render with no Firebase invalid-api-key error; AuthProvider's custom-token bridge and upsert succeed silently; /orders lists the persona's seeded orders; a status written on the server shows on /orders/[id]/pickup within 3 s; network shows only localhost. Tests: codec round-trips Timestamp, GeoPoint, refs, bytes and nested arrays; where, orderBy and limit through clientQuery match FakeFirestore. /api/demo/firestore is 404 outside demo and refuses '_' collections. |
| SHELL | Demo shell: no analytics or outside calls, and the DemoRoot mount | `app/layout.tsx`, `src/components/demo/DemoRoot.tsx`, `src/lib/posthog/server.ts`, `instrumentation-client.ts`, `src/lib/server/rateLimit.ts`, `src/hooks/usePosthog.ts` | S | SWITCH | In demo: AnalyticsConsent, AgentationDevTools and Vercel Speed Insights don't render; posthog-js never initialises; captureServerEvent is a no-op; checkRateLimit always allows; DemoRoot renders only in demo, as the first child of body. With demo off, the layout output is unchanged. No request to posthog, google-analytics, googletagmanager or vercel-insights on :3019. typecheck, lint and test green. |
| HANDOFF | Demo hand-off sheet instead of WhatsApp, phone and mail links | `src/components/demo/DemoHandoffSheet.tsx`, `src/components/campus/detail/ContactButton.tsx`, `app/campus/lost-found/page.tsx`, `app/campus/blood/page.tsx`, `app/contact/page.tsx` | S | SWITCH | In demo, 'Continue on WhatsApp' after an approved ask, a revealed lost-found contact, the blood WhatsApp link and the support links on /contact each open a sheet naming the sample person and the channel; no wa.me, tel:, mailto: or instagram navigation happens. With demo off the links are unchanged. typecheck and lint pass; browser check at the end of wave 2. |
| GATE | Demo proxy: visitor cookie, first visit, sign-in guard, areas kept out | `proxy.ts` | M | SWITCH, CLERKSRV, WORLD | curl on :3019: a page request with no visitor cookie sets swoop_demo_visitor (httpOnly, SameSite=Lax, 1 year) and redirects to /demo?next=<path>; /api requests get the cookie, no redirect. Signed out, /orders?x=1 redirects to /login?redirect_url=%2Forders%3Fx%3D1 and /marketplace to /login?redirect_url=%2Fmarketplace. Signed in, /login?redirect_url=%2Fhousing goes to /housing. /godview and /shopfront/dashboard go to /demo/not-included?area=godview\|shopfront. /demo is public. Cross-site API writes still get 403. Plain fixture mode keeps today's let-through; demo off, the Clerk path is unchanged. |
| PERSIST | Visitor changes kept in the browser, and Reset demo | `src/lib/demo/server/overlay.ts`, `app/api/demo/state/route.ts`, `app/api/demo/reset/route.ts`, `src/lib/demo/client/persist.ts`, `src/lib/demo/client/DemoPersistence.tsx`, `src/lib/demo/client/reset.ts`, `src/components/demo/DemoRoot.tsx`, `tests/demo/overlay.test.ts` | L | WORLD, FIREBASE, CLERKSRV, SHELL | As Sana, save a listing, send a contact request and join a game; stop and restart npm run demo, reload: all three are back, restored from IndexedDB, after one automatic reload. resetDemo(): seeded data again, signed out, IndexedDB and swoop-demo:* keys empty, college pick and blood number cleared, new visitor cookie, lands on /demo. A second browser profile never sees the first one's changes. overlay.test.ts round-trips docs, deletes and bucket files through export and import. |
| DATE | Demo date and seasonal sample packs | `src/lib/demo/season.ts`, `app/api/demo/date/route.ts`, `src/lib/campus/fixtures/seasonal.ts`, `src/lib/demo/server/seasonPack.ts`, `app/page.tsx`, `src/components/campus/HousingExperience.tsx`, `src/components/campus/MarketplaceExperience.tsx`, `src/components/campus/housing/HousingListingCard.tsx`, `app/api/housing/posts/route.ts`, `tests/demo/season.test.ts` | M | SWITCH, WORLD, SEED | May: Home slot 'Moving out? Sell it as a bundle', the Market moving_out prompt, move-out bundles and summer sublets in the feeds, peak housing on. July: 'Set up your room for less', the set_up_room prompt, housing 'From students' on, room-wanted posts and new-student deals. Nov: 'Exams soon? Print your notes', no market prompt. Switching keeps the visitor's own posts and saves. season.test.ts maps each id to its instant and leaves real time alone with demo off. |
| PRINTPAY | Simulated payment and order progress | `src/lib/demo/shims/razorpay-server.ts`, `app/api/demo/razorpay/pay/route.ts`, `app/api/demo/orders/[id]/collect/route.ts`, `src/lib/demo/client/checkout.ts`, `src/components/demo/DemoPaySheet.tsx`, `src/lib/razorpay/loadRazorpay.ts`, `src/lib/demo/server/orderProgress.ts`, `tests/demo/razorpay-shim.test.ts` | L | WORLD, CLERKSRV, FIREBASE, SEED | As Sana: upload a 3-page PDF at /upload, pick Main Block Prints, press Pay in the demo sheet: the visitor lands on /orders with the new order processing, then printing, then ready for pickup within about 60 s, and the pickup page updates live. payments/{id} ends fulfilled and razorpay_webhook_events has a processed entry. 'Payment fails' shows the failure toast and makes no order. The closed shop says it is closed. checkout.razorpay.com is never requested. The shim test checks order create, signature and payment fetch. |
| LIFE | Demo life: sample students answer | `src/lib/demo/server/life.ts`, `tests/demo/life.test.ts` | M | WORLD, CLERKSRV, SEED | As Sana, ask for Farhan's study lamp: within about 15 s it shows approved with the WhatsApp reveal and an inbox item. Post a listing: within about 60 s a sample student's ask arrives with an Update. Join a game: a sample player takes a seat within about 30 s. life.test.ts drives tickLife on a FakeFirestore with fake times. Everything goes through the existing contact-request and notify code, never fake UI. |
| ENTRY | Demo start page and the not-in-demo page | `app/demo/page.tsx`, `app/demo/not-included/page.tsx`, `src/components/layout/RootShell.tsx` | M | CLERKUI, DATE, PERSIST, GATE | /demo at 375 and 1280 px: 'Sign in like a new student' opens /login at step 1 with no stored pick; each of the 4 persona cards lands on next (or /) with the right campus chip and 'Hey <name>'; 'Look around signed out' lands on / with 'Pick college'; the date chips switch and reload. /godview and /shopfront/dashboard show the not-included page with 'Back to Swoop' and no console errors. With demo off both pages 404. No navbar or dock on /demo pages. |
| DEMOBAR | Demo bar: student, demo date and Reset demo | `src/components/demo/DemoBar.tsx`, `src/components/demo/PersonaPicker.tsx`, `src/components/demo/DemoDatePicker.tsx`, `src/components/demo/DemoRoot.tsx`, `app/globals.css`, `src/components/campus/MarketplaceExperience.tsx`, `src/components/campus/market/MarketSeeAll.tsx` | M | PERSIST, CLERKUI, DATE | 375 px: a 36 px strip on every route, including /login, /demo and the pickup page, showing Demo, the student chip, the date chip and Reset; while scrolling it never covers the navbar, the Market, See all or Upload sticky headers, or the Dock. 1280 px: a fixed left panel outside the 428 px column, no overlap. Switching to Kabir reloads with 'KJU Airport Rd'. May shows the moving-out card on Home. Reset asks once and lands on /demo. Demo off: nothing renders. No horizontal scroll. |
| SIGNIN | Simulated sign-in on /login: mocked Google, skip in, email code | `src/components/auth/useCollegeSignIn.ts`, `src/components/demo/auth/useDemoCollegeSignIn.ts`, `app/(auth)/login/page.tsx`, `src/components/auth/SignInStep.tsx`, `src/components/auth/EmailCodeForm.tsx` | M | CLERKUI, CLERKSRV, GATE | At 375 and 1280 px in demo: /login, pick KJU, KJU Main, skip stay, Continue with Google opens the Demo chooser; Cancel returns the button to idle with no error; college account goes through 'Signing you in', /campus/verify, the course step, then Home greets Riya; personal account lands on 'That's not a KJU email'. 'Skip in as a sample student' signs in as Sana and goes to redirect_url. Email code shows 'Any 6 digits work' and any 6 digits sign in. Back walks ?step=. /login/preview still works. Demo off: the Clerk hook is unchanged. |
| VERIFYD | /campus/verify in demo: add college email and approve ID card | `app/campus/verify/page.tsx`, `src/components/campus/AddCollegeEmail.tsx` | S | CLERKUI, CLERKSRV | As personal-account Riya: adding riya@kju.test with any 6-digit code gives approved, then the course step, then Home. The ID card route gives pending, then 'Approve my card (demo)' gives approved. As Meera: pending plus the approve button. 'Sign in with another account' signs out to /login. With demo off, the screens are unchanged. typecheck and lint pass. |
| PRINTUI | Print screens on sample data: Home order, sample PDF, hand-over | `app/page.tsx`, `app/upload/page.tsx`, `src/components/upload/FileDropzone.tsx`, `src/lib/demo/samplePdf.ts`, `app/orders/[id]/pickup/page.tsx` | M | PRINTPAY, FIREBASE, DATE | As Sana in demo: Home shows the recent order and the 'Print ready for pickup' slot; View opens the pickup page in its ready state with art. /upload has 'Try a sample PDF', which loads a 4-page PDF into the previewer; the sticky header sits below the demo bar. The pickup page has 'Shop hands it over (demo)', which marks the order collected. Refresh keeps it; Reset removes it. Demo off: unchanged. typecheck and lint pass. |
| APICHK | Demo smoke script, the KADA-18 data checks and the API fixes | `scripts/demo-smoke.mjs`, `package.json`, `app/api/contact-requests/route.ts`, `app/api/contact-requests/[id]/route.ts`, `src/lib/campus/serial.ts`, `app/api/campus/actions/route.ts`, `app/api/campus/notifications/route.ts`, `app/api/campus/games/route.ts`, `app/api/campus/games/[id]/route.ts`, `app/api/campus/lost-found/route.ts`, `app/api/campus/lost-found/[id]/route.ts`, `app/api/campus/blood/route.ts`, `app/api/campus/student-deals/route.ts`, `app/api/campus/verifications/route.ts`, `app/api/marketplace/listings/route.ts`, `app/api/marketplace/listings/[id]/route.ts`, `app/api/housing/posts/route.ts`, `app/api/housing/posts/[id]/route.ts`, `app/api/users/me/deletion-request/route.ts`, `app/api/internal/campus-maintenance/route.ts` | L | GATE, CLERKSRV, FIREBASE, PRINTPAY, DATE, LIFE | node scripts/demo-smoke.mjs (npm run demo:smoke) exits 0 against a fresh npm run demo: every smoke route answers 200, the expected redirect or 404, with no Next error markers, signed out and as each persona; and the API checks pass: session and onboarding, market and housing create, edit and serial, save, share and report on v2 collections, contact create, list (seeded requests show) and approve, reserved post 409, wanted offer intent, notifications GET and PATCH, games join and Full, lost-found claim and redacted ID card, blood opt-in, deals by distance with 403 for Meera, ID-card upload, case-insensitive deletion confirm, campus-maintenance GET with the launcher's cron value. |
| HOMECHK | KADA-18 checks in demo: Home, header, gate, dock and profile | `app/page.tsx`, `src/components/AnnouncementCarousel.tsx`, `src/components/home/UtilityRow.tsx`, `src/components/layout/SwoopNavbar.tsx`, `src/components/layout/Dock.tsx`, `src/components/layout/RootShell.tsx`, `src/components/campus/CampusGate.tsx`, `app/profile/page.tsx`, `src/hooks/useCampusSession.ts` | M | ENTRY, DEMOBAR, SIGNIN, VERIFYD, PRINTUI, APICHK | In demo at 375 and 1280 px: HOME (exams card first in Nov, moving-out in May, set-up-room in July; 4 utility tiles link; 'Hey <name>'; no images; no caps), DEAD (/ and /login load), HDR (chip reads KJU Main for Sana and KJU Airport Rd for Kabir; one session call per load; gate links carry next; Home tab active on the 4 utilities) and the gate (signed out to sign-in, Meera to pending, Ananya into Girls' space) all pass; profile shows name and kju.test email and signs out. Before and after screenshots taken. |
| AUTHCHK | KADA-18 checks in demo: sign-in, verify and session | `app/(auth)/login/page.tsx`, `app/(auth)/sso-callback/page.tsx`, `src/components/auth/useCollegeSignIn.ts`, `src/components/demo/auth/useDemoCollegeSignIn.ts`, `src/components/auth/CollegePicker.tsx`, `src/components/auth/StayStep.tsx`, `src/components/auth/SignInStep.tsx`, `src/components/auth/EmailCodeForm.tsx`, `src/components/auth/AuthShell.tsx`, `app/campus/verify/page.tsx`, `src/components/campus/CourseStep.tsx`, `src/components/campus/AddCollegeEmail.tsx`, `src/components/campus/IdCardUpload.tsx`, `src/lib/demo/shims/clerk-client.tsx`, `src/lib/demo/shims/clerk-server.ts`, `src/lib/demo/server/identity.ts`, `src/lib/demo/client/session.ts`, `src/components/demo/auth/DemoAccountChooser.tsx`, `src/components/demo/DemoUserMenu.tsx` | M | ENTRY, DEMOBAR, SIGNIN, VERIFYD, PRINTUI, APICHK | In demo at 375 and 1280 px: LOGIN ('KJC' finds KJU, KJU shows 2 campuses, stay is skippable, every step and Back), VERIFY (new user, unverified and pending each show the right step; semester list follows programme), the simulated SIGNIN and MEM round trips (college Google auto-approves, personal Google mismatches, email code, add college email, ID card approve), the guarded redirect and return for /orders, /upload, /campus/activity and /marketplace/new, the /login bounce when signed in, and sign out from navbar, profile and verify all pass. Zero requests to clerk hosts. |
| MARKETCHK | KADA-18 checks in demo: Market feed, See all, details, forms and kits | `src/components/campus/MarketplaceExperience.tsx`, `src/components/campus/market/ListingCard.tsx`, `src/components/campus/market/BundleCard.tsx`, `src/components/campus/market/PassRow.tsx`, `src/components/campus/market/WantedCard.tsx`, `src/components/campus/market/AskCard.tsx`, `src/components/campus/market/SeasonPrompt.tsx`, `src/components/campus/market/MarketSeeAll.tsx`, `src/components/campus/market/PriceBits.tsx`, `src/components/campus/market/AlsoChips.tsx`, `src/components/campus/market/FurnishTiles.tsx`, `src/components/campus/MarketDetail.tsx`, `src/components/campus/market-form/registry.tsx`, `src/components/campus/market-form/payload.ts`, `src/components/campus/market-form/TripFields.tsx`, `src/components/campus/market-form/TicketFields.tsx`, `src/components/campus/market-form/PassFields.tsx`, `src/components/campus/market-form/VehicleFields.tsx`, `src/components/campus/market-form/BundleItemsField.tsx`, `src/components/campus/detail/ContactButton.tsx`, `src/components/campus/detail/SaveShare.tsx`, `src/components/campus/detail/ReportSheet.tsx`, `src/components/campus/detail/Gallery.tsx`, `src/components/campus/fields/PhotoField.tsx`, `src/components/campus/fields/PriceInput.tsx`, `src/components/campus/fields/PriceTermsChips.tsx`, `src/components/campus/fields/GenderChips.tsx`, `src/hooks/useMarketFeed.ts` | L | ENTRY, DEMOBAR, SIGNIN, VERIFYD, PRINTUI, APICHK | In demo at 375 and 1280 px: MFEED (sections in order with See all; the four See-all pages; /marketplace/all/x 404; 'cycle under 12k', 'mattress near clg', ask on empty search; /girls-space/marketplace mirror as Ananya), MFORM1 and MFORM2 (every kind; 1.5k preview, distance, bundle rows, ?kind=wanted&q=cycle prefill, fair price, ticket above face value blocked, cycle hides plate/RC/insurance, posts land in the right section), MDETAIL (one per kind, own and others'; reserved disables the buyer action; pay-on-pickup line), market SEAMROUTES and CONTACT, the May and July season prompts, and MKIT and CPARTS on /dev/market-kit and /dev/parts pass. |
| HOUSINGCHK | KADA-18 checks in demo: Housing, Girls' space, activity and My posts | `src/components/campus/HousingExperience.tsx`, `src/components/campus/housing/HousingListingCard.tsx`, `src/components/campus/housing/HousingFilters.tsx`, `src/components/campus/housing/HousingDetail.tsx`, `src/components/campus/housing/HousingPostForm.tsx`, `src/components/campus/housing/FormFields.tsx`, `src/components/campus/housing/HousingMyPosts.tsx`, `src/components/campus/market/MarketMyPosts.tsx`, `src/hooks/useHousingFeed.ts`, `app/girls-space/page.tsx`, `app/campus/activity/page.tsx` | L | ENTRY, DEMOBAR, SIGNIN, VERIFYD, PRINTUI, APICHK | In demo at 375 and 1280 px: HFEED (1.8 km post hidden at 1 km and shown at 2 km; 'under 9k', 'kjc', 'Kristu', 'Kothnur'; ask on empty; /girls-space/housing girls only), HFORM (blocked without move-in, who can stay or rules; agent needs brokerage; WhatsApp paste fills fields; ?type=roommate&area=Kothanur prefills; post shows in feed), HDETAIL (reserved, price-dropped, agent and owner nudge render; reserve, lower rent and beds persist after reload), HCARD on /dev/housing-kit, MYPOSTS ('Still available?' on the 4-day-old post only; Updates list), housing SEAMROUTES, Girls' space for Ananya with Sana gated, and 'From students' off in Nov, on in May and July all pass. |
| UTILCHK | KADA-18 checks in demo: deals, lost and found, blood, games, privacy | `app/campus/deals/page.tsx`, `app/campus/lost-found/page.tsx`, `app/campus/blood/page.tsx`, `app/campus/games/page.tsx`, `app/settings/privacy/page.tsx`, `app/contact/page.tsx` | M | ENTRY, DEMOBAR, SIGNIN, VERIFYD, PRINTUI, APICHK | In demo at 375 and 1280 px: DEAL (5 deals by distance, the counter sheet; Meera gets the gate and the API 403), LOST (4 posts, ID card details redacted, claim sent and approved, report), BLOOD (opt in, the B+ and O- requests, post a request and it shows; a matching donor gets an Update; Meera gated), GAMES (4 games; join drops the count, Full shows, leave frees a seat, host sheet) and COPY (/settings/privacy confirm is case-insensitive, demo deletes nothing real) all pass, and every hand-off opens the demo sheet. |
| PRINTCHK | KADA-18 checks in demo: print flow, orders, pickup art and campus shops | `app/upload/page.tsx`, `app/orders/page.tsx`, `app/orders/[id]/pickup/page.tsx`, `app/shops/page.tsx`, `app/shops/[shopId]/page.tsx`, `src/components/upload/CheckoutButton.tsx`, `src/components/upload/FileDropzone.tsx`, `src/components/swoop/illustrations.tsx`, `src/components/demo/DemoPaySheet.tsx`, `src/lib/demo/client/checkout.ts`, `src/lib/demo/shims/razorpay-server.ts`, `src/lib/demo/server/orderProgress.ts`, `src/lib/demo/shims/firebase-firestore.ts`, `src/lib/demo/server/clientQuery.ts`, `src/lib/stores/ordersStore.ts`, `src/lib/stores/shopsStore.ts` | M | ENTRY, DEMOBAR, SIGNIN, VERIFYD, PRINTUI, APICHK | In demo at 375 and 1280 px: PRINTCAMPUS (/upload lists KJU Main shops for Sana and Airport Road shops for Kabir), the full print flow (sample PDF and an images job, settings change the price, demo pay, order goes processing, printing, ready, then collected; payment failure; closed shop), /orders groups Today and Earlier, /shops and /shops/shop-main-block show pricing and Upload, and ART (PickupWaitArt on a ready order) pass. No request to checkout.razorpay.com, /firebasestorage or any firebase host. |
| DEMOCHK | Demo checks end to end: persistence, reset, isolation, dates and the bar | `src/components/demo/DemoBar.tsx`, `src/components/demo/PersonaPicker.tsx`, `src/components/demo/DemoDatePicker.tsx`, `src/components/demo/DemoRoot.tsx`, `src/components/demo/DemoHandoffSheet.tsx`, `src/lib/demo/client/persist.ts`, `src/lib/demo/client/DemoPersistence.tsx`, `src/lib/demo/client/reset.ts`, `src/lib/demo/server/overlay.ts`, `src/lib/demo/server/world.ts`, `src/lib/demo/server/seasonPack.ts`, `src/lib/demo/server/life.ts`, `src/lib/demo/season.ts`, `src/lib/campus/fixtures/seasonal.ts`, `app/api/demo/state/route.ts`, `app/api/demo/reset/route.ts`, `app/api/demo/date/route.ts`, `app/demo/page.tsx`, `app/demo/not-included/page.tsx`, `app/globals.css`, `scripts/demo.mjs`, `scripts/demo-smoke.mjs` | M | ENTRY, DEMOBAR, SIGNIN, VERIFYD, PRINTUI, APICHK | With every .env* moved aside: npm run demo starts on :3019 and the first visit lands on /demo. Two browser profiles never see each other's posts. Changes (a post with a photo, a save, an ask, a print order, a blood opt-in, a game join) survive a server restart and a reload; Reset clears them all, signs out and lands on /demo. Date switching shows the seasonal screens and keeps own posts. The demo bar sits on every smoke route at 375 and 1280 px without hiding app UI. Demo life answers. npm run demo:smoke passes. Zero requests to any non-localhost host. |

## Waves

| Wave | Packages (size) | Longest | Hours |
|---|---|---|---|
| 1 | SWITCH (M), SEED (L) | SEED (L) | 1.5 |
| 2 | WORLD (L), CLERKSRV (L), CLERKUI (L), FIREBASE (L), SHELL (S), HANDOFF (S) | WORLD (L) | 1.5 |
| 3 | GATE (M), PERSIST (L), DATE (M), PRINTPAY (L), LIFE (M) | PERSIST (L) | 1.5 |
| 4 | ENTRY (M), DEMOBAR (M), SIGNIN (M), VERIFYD (S), PRINTUI (M), APICHK (L) | APICHK (L) | 1.5 |
| 5 | HOMECHK (M), AUTHCHK (M), MARKETCHK (L), HOUSINGCHK (L), UTILCHK (M), PRINTCHK (M), DEMOCHK (M) | MARKETCHK (L) | 1.5 |
| **Total** | **26 packages** | | **7.5 h** |

Estimated work: about 7.5 hours (the sum of each wave's longest package, with S = 0.5 h, M = 1 h and L = 1.5 h). With dependency-driven starts and up to 8 agents at once, the night can be shorter; KADA-18 finished 47 packages in about 1 h 25 min.

**Why this order:**

- **Wave 1** fixes the contract and the sample data that everything else reads.
- **Wave 2** builds the three stand-ins that any no-env page needs (Clerk server, Clerk client, Firebase client), the per-visitor world, the quiet shell and the hand-off sheet. The demo renders for the first time at the end of wave 2.
- **Wave 3** adds the proxy, persistence, the demo date, payments and demo life.
- **Wave 4** builds the visible demo (front door, bar, sign-in, verify, print screens) and the smoke script with the API fixes.
- **Wave 5** runs the skipped KADA-18 browser checks and the demo's own end-to-end checks, split by area so the files stay disjoint.

Dependency-driven starts are allowed (see the runbook): a package may start as soon as everything in its `depends_on` is done and no running package shares a file.

## Per-package verification (the lead, as each agent returns)

1. `git status --porcelain` shows only the package's files.
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`, which must include the package's own test files.
5. **UI packages:** a browser check in demo mode on http://localhost:3019 at 375 px and 1280 px, using the acceptance in the brief.
   - No horizontal scroll and no console errors.
   - The network list shows only `localhost`: nothing to clerk, firebase or googleapis, razorpay, posthog, googletagmanager, google-analytics or vercel-insights.
   - Keep one "after" screenshot per changed screen in the scratchpad.
   - The demo first renders with no env at the end of wave 2. Packages in waves 1 and 2 are checked with tests and `curl` until then, and their browser part is checked in the end-of-wave-2 smoke.
6. **Restart `npm run demo`** after any package that changes `next.config.js`, `src/lib/demo/build-config.cjs` or adds a shim file, because aliases are read at start.
7. **Grep checks** named in the acceptance.
8. **Live-service checks are never attempted.** They go under "Skipped verifications" in the ledger.

## End-of-wave verification

1. The full `npm run typecheck && npm run lint && npm test` with the whole wave in.
2. Plain `npm run build`.
   - It must compile. If prerender fails only on missing env, as it did in KADA-18, record that under "Skipped verifications".
   - Then run `grep -rl "src/lib/demo/shims" .next` (Git Bash). It must find nothing.
3. **The demo-mode build:** `npm run demo:check`, with every `.env*` file moved aside.
   - From wave 2 on, every static page must compile and answer without a 500.
4. From wave 4 on: `npm run demo:smoke` against a fresh `npm run demo`.
5. **The route smoke list** below, in a real browser:
   - At 375 px, every route the wave touched, plus `/`, `/marketplace` and `/housing`.
   - After waves 4 and 5, the whole list at 375 px and 1280 px.
6. The network shows only localhost.

## Route smoke list (demo mode, Sana unless noted)

| Route | Who / date | Must show |
|---|---|---|
| `/demo` | signed out | three choices, 4 sample student cards, date chips, "Your changes stay in this browser. Reset any time." |
| `/` | Sana, Nov | "Hey Sana", KJU Main chip, exams card first, Print and Marketplace tiles, 4 utility tiles, the recent order, the campus shops, the "Print ready for pickup" dock slot |
| `/` | Sana, May and July | "Moving out? Sell it as a bundle" (May), "Set up your room for less" (July) |
| `/` | Kabir · Meera · Ananya · signed out | KJU Airport Rd chip and Airport Road shops · "Verify you're a KJU student" row · Girls' space tile · "Pick college" chip |
| `/login` | signed out | "KJC" finds KJU; 2 campuses; stay skippable; Continue with Google opens the demo chooser (Demo chip, Cancel); "Skip in as a sample student"; email code hint |
| `/sso-callback` | after a Google pick | "Signing you in", then `/campus/verify` |
| `/campus/verify` | Riya (college) · Riya (personal) · Meera | course step · "That's not a KJU email" with add-email and ID card · pending with "Approve my card (demo)" |
| `/upload` | Sana · Kabir | campus shop scroller (Kabir: Airport Road shops, the closed one marked), "Try a sample PDF", live price, sticky header below the demo bar, checkout bar |
| Demo pay sheet | Sana | "Demo payment. No money moves.", Pay, Payment fails, Cancel |
| `/orders` | Sana | Today and Earlier groups; a new order moves processing, printing, ready |
| `/orders/<ready id>/pickup` | Sana | ready state, PickupWaitArt, live updates, "Shop hands it over (demo)" |
| `/shops`, `/shops/shop-main-block` | Sana | campus shops; pricing table and Upload |
| `/marketplace` | Sana | sections in order: Rooms clearing out; Seats, tickets and passes; Everything near you; Wanted; each with See all. Season prompt only in May and July |
| `/marketplace/all/{clearing-out,seats,near-you,wanted}` | Sana | posts listed; `/marketplace/all/x` is a 404 |
| `/marketplace/<id>` | Sana | each of the 8 kinds renders; her own post shows owner actions; reserved disables the buyer action |
| `/marketplace/new?kind=…` | Sana | each of the 8 kinds opens its form; a post lands in the right section |
| `/housing` | Sana | near list, filters, the distance ring, ask on an empty search; "From students" off in Nov, on in May and July |
| `/housing/<id>` | Sana | owner panel on her post; reserved, price-dropped and agent posts |
| `/housing/new?type=roommate&area=Kothanur` | Sana | prefilled; WhatsApp paste fills fields |
| `/girls-space`, `/girls-space/marketplace`, `/girls-space/housing` | Ananya · Sana | girls-only posts · the private gate |
| `/campus/activity`, `?tab=posts` | Sana | seller asks with Approve and Decline, sent asks, Updates; "Still available?" on the 4-day-old post |
| `/campus/deals` | Sana · Meera | 5 deals by distance and the counter sheet · the gate |
| `/campus/lost-found` | Sana | 4 posts, ID card details redacted, claim and report |
| `/campus/blood` | Sana | opt-in, the B+ and O- requests, post a request |
| `/campus/games` | Sana | 4 games, join, leave, Full, host sheet |
| `/profile`, `/settings/privacy` | Sana | name, kju.test email, My orders, sign out; the confirm phrase works in any case |
| `/about`, `/contact`, `/privacy`, `/terms`, `/helper` | anyone | render; `/contact` links open the demo hand-off sheet |
| `/godview`, `/shopfront/dashboard` | anyone | the not-included page with "Back to Swoop" |
| `/dev/parts`, `/dev/market-kit`, `/dev/housing-kit`, `/login/preview` | anyone | render (they are fixture-gated, and demo implies fixture mode) |
| Every route | all | demo bar visible and covering no app UI (desktop: panel outside the column); no console errors; no horizontal scroll; network only localhost |

## KADA-18 skipped checks: tonight vs still skipped

| KADA-18 check ids | Tonight, in demo mode | Package |
|---|---|---|
| HOME, DEAD, HDR, CampusGate, profile and sign out | browser, 375 and 1280 px | HOMECHK |
| LOGIN, VERIFY, and SIGNIN and MEM as simulated round trips | browser | AUTHCHK |
| MFEED, MFORM1, MFORM2, MDETAIL, MKIT, CPARTS, market half of SEAMROUTES and CONTACT | browser | MARKETCHK |
| HFEED, HFORM, HDETAIL, HCARD, MYPOSTS, housing half of SEAMROUTES | browser | HOUSINGCHK |
| DEAL, LOST, BLOOD, GAMES, COPY | browser | UTILCHK |
| PRINTCAMPUS, ART | browser | PRINTCHK |
| SEAMROUTES, CONTACT, NTF, GAMES, LOST, MACT, CRON, COPY (data and API side) | `npm run demo:smoke` | APICHK |
| CLEAN smoke | route smoke list | DEMOCHK and end of wave 5 |

These stay skipped even with the demo, because they need a live service. The ledger keeps them as skipped, never as done:

- Real Clerk round trips: Google, email code and redirects against a Clerk dev instance.
- The Firestore index deploy, the rules emulator, and Timestamp writes on real Firestore (NTF, HAPI, GAMES, LOST, MACT, CRON, SEAMIDX).
- Real college email domains and map-checked coordinates (CAT).
- `npm run build` with real env (prerender).
- The GVC Godview editor, since Godview is out of the demo.

## Risks

1. **Dev server only.** The demo runs on `next dev --webpack`, because demo and fixture mode are dev-only. Each route compiles slowly the first time; the launcher's pre-load softens this. A deployed demo later would need a Folyo-style opt-in, signed cookies and a persistent store.
2. **Alias matching.** Next's barrel optimisation rewrites imports as `!=!` requests, so the alias regex must match that form. Under Turbopack the webpack plugin does nothing, which is why the config throws when the flag meets Turbopack. The shims also render on the server, so they must not touch `window` at import.
3. **Wave 2 is all or nothing.** No page renders without env until the Clerk server, Clerk client and Firebase client stand-ins are all in. If the end-of-wave-2 smoke can't render `/` after one fix pass, the run stops (runbook stop rules).
4. **Request context.** `cookies()` inside the fake DB only works within a request. Code that loses the request context (`setTimeout`, `after()`) falls back to the shared `default` world with a loud warning. The ticks run inside requests only.
5. **Demo date trade-off.** Only seasonal screens and packs move. Absolute dates elsewhere still follow the real calendar.
6. **IndexedDB.** In a private window or with storage blocked, changes last for the server's lifetime only. Large uploads make the overlay heavy; the app's existing upload limits apply.
7. **No indexes or rules in the fakes.** Fake Firestore enforces neither composite indexes nor security rules, so a demo pass does not prove production queries.
8. **`/api/demo/firestore` is a rules-free door.** It returns 404 outside demo, touches only the caller's own world, and refuses collections that start with `_`.
9. **Unsigned, readable session cookie.** Anyone can be any persona in their own browser. This is acceptable only because the demo is dev-only and local.
10. **The production Clerk path can't be fully proven** by `npm run build` without env, since prerender needs it. The run relies instead on typecheck, lint, tests, the shim-leak grep, and production files keeping their Clerk calls unchanged.
11. **`.next-demo` types.** `next dev` points `next-env.d.ts` (gitignored) at the demo folder's types. If a later typecheck reads stale `.next-demo` types, delete `.next-demo`. SWITCH adds the tsconfig include up front, so `tsconfig.json` doesn't churn.
12. **Fonts.** `next/font` fetches Google Fonts at compile. On an offline laptop the demo shows fallback fonts and logs a warning.
13. **Fixes outside a package's files.** Wave 5 packages fix only their own files. API bugs they find go to a follow-up wave, as KADA-18 did with its seam wave, so the night can grow by one wave.
14. **Fake email domain.** `kju.test` is a fixture domain; the real KJU email domain is still unknown (CAT).
15. **Windows.** npm scripts with an inline `VAR=1` don't work on Windows, so the launcher is a Node script.
16. **Bare cards.** Listings have no sample photos, so cards show the no-photo state. That is intentional (see decision 7).
17. **Shopfront and Godview** load through the stand-ins but are redirected away. They are untested in the demo.
18. **One fetch wrapper.** `DemoPersistence` wraps `fetch` once; hot reload must not wrap it twice.

## What needs live services later (morning report)

- Nothing for the demo itself.
- **Deploying the demo** (not decided) would need a production opt-in flag, signed demo cookies, a persistent per-visitor store instead of server memory, and a host.
- **Still waiting on live services from KADA-18:** the Clerk dev-instance round trips, the Firestore index and rules deploy and emulator tests, the real KJU email domain and coordinates, and `npm run build` with real env.
