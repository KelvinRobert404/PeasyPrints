# KADA-18 · Implement the 7 Nov redesign decisions

Run plan for the KADA-18 Nightly. Worktree `C:/Developer/PeasyPrints-kada18`, branch `kada-18/implement-redesign`, cut from `dev`. Planned 7 Nov 2026 from five read-only area maps of the repo: sign-in, Market, Housing, Home/shell/copy, and data/platform.

Companion files:
- `docs/implementations/kada-18-packages.json`: machine-readable waves, with one brief per package and the `common_rules` every agent gets.
- `docs/implementations/kada-18-ledger.md`: status of every package. The run updates it.
- `docs/implementations/kada-18-redesign-nightly.md`: the runbook for running this plan overnight, on any machine.

## Goal

Build the redesign the owner decided on 7 Nov, wave by wave, without touching a live service:

- Sign-in in two steps. Step 1: pick college and campus, with an optional phone-GPS distance. Step 2: Continue with Google first, a 6-digit email code second, and the ID card as fallback. Then a course step.
- Market v2, with the four See all screens.
- Housing v2, including the post form and the WhatsApp paste.
- Home v2.
- Four campus utilities: student deals, lost and found, blood donor alerts and pickup games.
- The supporting data model, helpers, notification queue, maintenance cron and copy rules.

Each package is verified on its own and pushed to the run branch only. Everything that needs Clerk, Firebase or a person is listed for the morning.

## Decided (owner, 7 Nov 2026; do not reopen)

- **No live services.** No Firebase, Clerk, Razorpay or database calls. Packages are built against types, in-memory fakes and fixtures. Screens are checked in the browser through an offline fixture mode, which is dev only and gives a fake Admin DB, a fake bucket and a proxy bypass. Every check that needs a live service goes in the morning report.
- **Build v1 screens** for student deals, lost and found, blood donor alerts and pickup games. Also build all four Market See all screens: Rooms clearing out; Seats, tickets and passes; Everything near you; and Wanted.
- **Base branch is dev.** Push only the run branch `kada-18/implement-redesign`. Never push to dev or main, and never open a PR, merge or deploy.
- **Swoop is not launched.** The data model may change freely. There is no backfill and no backward compatibility, and legacy paths are deleted once they are replaced.
- **Dropped, never build:** events, hiring, jobs, internships and gigs; food surfaces (meal plans, late-night kitchens, kitchen storefronts, student shops); the DM button rename; the going-home module; the survey board; past papers; pets. Remove any of these that already exist.
- **Asset files need the owner.** Asset files are stock photos and images. Tonight the run only stops referencing them and lists them for the morning. It never deletes an asset file. Deleting dead code files is fine.
- **Design source.** The Swoop redesign canvas boards:
  - Home v2
  - Market v2, plus the Rooms clearing out See all screen
  - Housing post after
  - Sign in step 1: campus picker with GPS distance
  - Sign in step 2: Continue with Google first, email code second, ID card fallback

  The locked design system v1 in `src/components/swoop/` also applies.
- **Location.** Never ask students to pick an area. Phone GPS is optional, and only the distance from campus is kept. People posting a listing may pick a landmark.

## Defaults taken while planning (safest reversible choice; owner can change them in the morning)

| Default | Why | What changes if the owner disagrees |
|---|---|---|
| All 7 colleges can pick, sign up and verify, but only KJU has `launchState: live`. The others show "Opening soon", and Market and Housing stay gated for them. | Matches the 7-college catalog without opening products early. | One field per college in Godview (GVC). |
| A college is locked once verification is pending or approved. Switching campus within the same college is allowed. | Stops people from hopping between colleges after they are verified. | `applyOnboardingInput` in MEM. |
| Sign-in stays at `/login`, with steps in `?step=`. There is no new `/welcome` route. | `/login(.*)` is already public in `proxy.ts`, so no proxy change is needed. | LOGIN, HDR. |
| The utility routes are `/campus/deals`, `/campus/lost-found`, `/campus/blood` and `/campus/games`, with APIs under `/api/campus/*`. | They sit next to `/campus/verify` and `/campus/activity`, and they need sign-in by default. | HOME's UtilityRow links, HDR's shell rules. |
| Market See all URLs are `/marketplace/all/{clearing-out,seats,near-you,wanted}`, with a mirror under `/girls-space/marketplace/all/*`. The seasonal links go to `/marketplace/new?kind=bundle` and `/marketplace/all/near-you`. | Fixed now so that RUL, MFEED and HOME agree. | RUL (season.ts), MFEED. |
| The stay distance is rounded to 50 m, and coordinates never leave the phone. | Privacy. The owner said "keep only the distance". | `roundForPrivacy` in FMT. |
| Prices are written "Rs 1.5k", "Rs 8.5k pp" and "Rs 1.2L dep", never "₹". | The owner's C1 examples use Rs. | `formatPrice` in FMT. |
| Distance reads "650 m from KJU, 8 min walk" (walking at 80 m a minute). The ring filter defaults to 1 km. | This is how D1 and D2 are worded. | FMT. |
| Notification slots are 12:30 and 19:30 IST. Nothing goes out between 22:00 and 07:00. Urgent blood requests go out at once, but only between 07:00 and 22:00. | E4 says never after 22:00, and blood requests are urgent. | `nextSlot` in RUL. |
| Housing peak months, when "From students" is on by default, are April to August. Next semester starts on 1 Jun and 15 Nov. | Taken from the E1 windows. | season.ts in RUL. |
| Housing rent is always stored per person. Any verified student may post as Owner or Agent, and Agent requires a brokerage amount. | Follows "Rs 8.5k pp". There are no agent accounts. | HMOD schema. |
| Train seat swaps are allowed, with the line "Name change rules apply". Ticket resale is capped at face value. Mess and gym pass resale shows a fair price and the line "Check your mess allows transfer". | Safest version that still ships M2, M3 and F2. | MSCH schema, MFORM2 copy. |
| Lost and found posts close automatically after 30 days. The price-drop badge shows for 7 days. | Assumed, not stated by the owner. | CRON, RUL. |
| Fixture flag is `NEXT_PUBLIC_SWOOP_FIXTURES=1`, read through `isFixtureMode()`. It only works when `NODE_ENV !== 'production'`. | One flag works on both server and client, and a production build cannot reach it. | FIX. |
| `src/components/swoop/icons.tsx` is edited once, by ICO in wave 1, with additions only. Its README normally says not to edit it. | Icons are shared by every area, and one owner on one wave avoids conflicts. | ICO. |
| Campus names and origins. All 21 campuses use the real names, localities and pincodes from `docs/implementations/kada-18-campus-facts.json` (research of 2 Nov). Campuses with no source coordinates (Jain sites, KJU Airport Road, St Joseph's) are marked `approx: true`. | Coordinates came only from official and OpenStreetMap sources. | Godview (GVC) or a catalog edit once real pins are known. |

## Shared contracts (fixed before wave 1)

- **One owner per helper.**

  | Helper | File | Package |
  |---|---|---|
  | Price | `src/lib/format/price.ts` | FMT |
  | Distance | `src/lib/format/distance.ts` | FMT |
  | Search | `src/lib/search/campusSearch.ts` | SRCH |
  | Catalog | `src/lib/campus/catalog.ts` | CAT |
  | Lifecycle, season and slot rules | `src/lib/campus/{listingRules,season,notifySlots}.ts` | RUL |
  | Notifications | `src/lib/campus/notify.ts` | NTF |
  | Shared form, place and detail parts | `src/components/campus/{fields,places,detail}/*` | CPARTS |

  No other package writes its own version of these.
- **Types.**
  - New types go in new files: `src/types/{college,market,housing,utilities,notifications}.ts`.
  - `src/types/campus.ts` is edited only by TYP (additive, wave 1) and CLEAN (removals, wave 6).
  - The legacy `MarketplaceListing` and `HousingPost` stay until CLEAN, so every wave typechecks.
- **Listing place.** Listings store `place {landmarkId, label, area, lat, lng, campusId, roughDistanceM}`. The server resolves the coordinates from the campus config and never trusts the client. The serializer computes `distanceM` against the viewer's own campus origin. That is how the two KJU campuses (KJU Main and KJU Airport Rd) each get their own distances.
- **Feed responses.** `GET /api/marketplace/listings` and `GET /api/housing/posts` return `{campus, items}`. They also keep a temporary `own/other` alias until CLEAN, so older screens keep rendering between waves.
- **Fixture users.** The fixture users are `new-user`, `unverified-kju`, `pending-id-card`, `verified-kju-main` (the default), `verified-kju-airport`, `girls-approved` and `admin`. Switch user with `/api/dev/fixture-user?id=<id>&next=<path>`.
- **Dev-only check pages.** `/login/preview`, `/login/preview/verify`, `/dev/parts`, `/dev/market-kit` and `/dev/housing-kit` each return `notFound()` outside fixture mode or in production.

## Scope by area

| Area | Today | Packages |
|---|---|---|
| Sign-in, onboarding, verification | Clerk prebuilt `<SignIn>` only. KJU is hard-coded through `PILOT_COLLEGE`. There is no catalog, campus, stay or course data. Firebase phone-OTP leftovers remain. | CAT, STORE, SIGNIN, LOGIN, MEM, VERIFY, GVC, HDR, DEAD |
| Market | One grid with 4 collections and a college chip selector. There is a postType of sell, wanted or free. There is no shorthand, distance, reserve or price drop. | MSCH, MAPI, MACT, MKIT, MFEED, MFORM1, MFORM2, MDETAIL, CONTACT, MYPOSTS, CLEAN |
| Housing | Free-text area and commute. Prices show as "₹8,500/mo". There is no who-can-stay, house rules, move-in, posted-as or lifecycle. | HMOD, HAPI, HCARD, HFEED, HFORM, HDETAIL, MYPOSTS, CLEAN |
| Home, shell, copy | No greeting, seasonal slot or utility row. The navbar has a "Choose campus" picker, and Tag forces uppercase. There is a stock kitten and a stock cat image. | ICO, ART, COPY, HDR, HOME, PRINTCAMPUS |
| Data, rules, tooling, utilities | No fixture mode, no notifications and no utility collections. | TYP, FMT, RUL, FIX, SEED, SRCH, NTF, CRON, DEAL, LOST, BLOOD, GAMES |

Each overlap between the five maps was merged into one package:

| Merged | Into |
|---|---|
| Area map auth A1 + platform F1/F2 (catalog and types) | CAT and TYP |
| Market M2 + platform F3 (price) | FMT |
| Auth A1 geo + platform F4 (distance) | FMT |
| Market M2 + platform F6 + Housing H1 query parser (search) | SRCH |
| Market M3 + platform F5 + Home seasonal (rules) | RUL |
| Market M1 + Housing H1 models | TYP (types), MSCH and HMOD (logic) |
| Auth A2 + platform F8 (membership server) | MEM |
| Home P4 + P5 + auth A7 (shell and header) | HDR |
| Home P2 + P3 (illustrations) | ART |
| Housing H3 client fixtures | Replaced by the server fixture mode, FIX + SEED |
| Market M1 fixtures + Housing H3 fixtures + platform F11 | SEED |
| Market M7 icons + Home P1 | ICO |
| Market and Housing landmark pickers, price inputs and detail parts | CPARTS |
| Utilities U1-U4 (server) with P6/P7 (screens) | One package each: DEAL, LOST, BLOOD, GAMES |
| Platform F7 rules + F10 queue | NTF |
| Market M13 + Housing H9 cleanup | CLEAN |

## Packages

44 packages: 1 S (15 min), 18 M (30 min), 25 L (60 min). The full brief for each agent is in `kada-18-packages.json`.

| Id | Title | Decisions covered | Files | Size | Depends on | Acceptance check |
|---|---|---|---|---|---|---|
| TYP | Types and shared constants | B5, C2, E2, E3, F2-F4, G1-G3, H1, H2, I1, I2, M1-M3, U1, U2, U4, J5, E4 | `src/types/campus.ts`<br>`src/types/market.ts`<br>`src/types/housing.ts`<br>`src/types/utilities.ts`<br>`src/types/notifications.ts`<br>`src/lib/campus/constants.ts`<br>`package.json` | M | - | typecheck, lint and npm test green with no consumer file touched; no dropped-feature word in any enum |
| CAT | College, campus and course catalog | Sign-in step 1 (7 colleges, 21 campuses), B6 aliases, D3 landmarks, D5 origins, H1 courses | `src/types/college.ts`<br>`src/lib/campus/catalog.ts`<br>`src/lib/campus/courses.ts`<br>`tests/campus/catalog.test.ts`<br>`tests/campus/courses.test.ts` | L | - | npm test: 7 colleges, 21 campuses, unique ids, codes /^[A-Z]{2,8}$/, KJU origins >1 km apart, landmarks within 5 km, alias search, course validation |
| FMT | Price and distance helpers | C1, C2, M3 fair price, D1, D2, D5, stay distance | `src/lib/format/price.ts`<br>`src/lib/format/distance.ts`<br>`tests/format/price.test.ts`<br>`tests/format/distance.test.ts` | M | - | npm test covers every format/parse example, haversine within 1%, pass fair price 12/30 days of Rs 3000 = Rs 1200 |
| RUL | Season, lifecycle and notification-slot rules | E1, E2, E3, E4, G1, G2, G3, M1, M2, F2, F3, Home seasonal slot | `src/lib/campus/season.ts`<br>`src/lib/campus/listingRules.ts`<br>`src/lib/campus/notifySlots.ts`<br>`tests/campus/season.test.ts`<br>`tests/campus/listing-rules.test.ts`<br>`tests/campus/notify-slots.test.ts` | M | - | npm test with fixed dates: month edges, 7 Nov exams slot, 24 h reserve lapse, nudge once, slot times, urgent quiet hours |
| FIX | Offline fixture mode (fake Admin DB and bucket, proxy bypass) | Owner decision: no live services; offline fixture mode, dev only | `src/lib/firebase/fixtureMode.ts`<br>`src/lib/firebase/fakeAdmin.ts`<br>`src/lib/firebase/fakeSeed.ts`<br>`src/lib/firebase/admin.ts`<br>`proxy.ts`<br>`.env.example`<br>`app/api/dev/fixture-user/route.ts`<br>`tests/firebase/fake-admin.test.ts` | L | - | npm test on the fake DB; typecheck, lint; with the flag unset no fixture code path runs |
| ICO | Shared icon additions | Icons for every area (one owner of src/components/swoop/icons.tsx tonight); food leftovers removed | `src/components/swoop/icons.tsx` | M | - | typecheck, lint; git diff shows only additions (plus CanteenIcon removal if unused) |
| ART | Swoop illustration series, room art and pickup kitten swap | A1 (no stock photos; Swoop inline-SVG illustration series) | `src/components/swoop/illustrations.tsx`<br>`src/components/swoop/illustrations-room.tsx`<br>`src/components/swoop/README.md`<br>`app/orders/[id]/pickup/page.tsx` | L | - | typecheck, lint; grep '/figma/' in app and src empty; only #FFFFFF as a hex colour |
| COPY | Copy pass: sentence-case tags, no ALL CAPS, no food leftovers | B4, B7, H3 on files no other package owns; dropped food surfaces | `src/components/swoop/primitives.tsx`<br>`app/globals.css`<br>`app/about/page.tsx`<br>`app/contact/page.tsx`<br>`app/settings/privacy/page.tsx`<br>`app/api/users/me/deletion-request/route.ts`<br>`app/godview/ui.tsx`<br>`app/godview/fees/page.tsx`<br>`app/godview/orders/page.tsx`<br>`app/shopfront/dashboard/page.tsx`<br>`app/shopfront/layout.tsx`<br>`app/shopfront/profile/page.tsx`<br>`src/components/upload/PrintConfigurator.tsx`<br>`src/components/upload/PrintUpgrades.tsx` | M | - | typecheck, lint; 'uppercase' left only in coupon inputs, the SWOOP wordmark and files later packages rewrite; 'DELETE MY ACCOUNT' gone |
| MEM | Membership server: multi-college principal, onboarding, session, config | Sign-in steps 1-3 server side, Godview domains per college, ID card fallback, H1 storage, multi-college gating, fixture principal | `src/lib/campus/membership.ts`<br>`src/lib/campus/collegeConfig.ts`<br>`src/lib/campus/auth.ts`<br>`app/api/campus/onboarding/route.ts`<br>`app/api/campus/session/route.ts`<br>`app/api/campus/config/route.ts`<br>`app/api/campus/verifications/route.ts`<br>`src/hooks/useCampusConfig.ts`<br>`tests/campus/membership.test.ts` | L | TYP, CAT, FMT, FIX | npm test for membership.ts; no PILOT_COLLEGE in auth.ts or these routes; fixture mode session returns KJU Main / KJU Airport Rd per fixture user |
| GVC | Godview campus config for all colleges and trust-queue columns | Godview emailDomains per college, launch state, D3 landmarks and D5 origins as admin data | `src/lib/campus/collegeConfigSchema.ts`<br>`app/api/godview/campus/config/route.ts`<br>`app/godview/campus/page.tsx`<br>`app/godview/campus/CollegeConfigEditor.tsx`<br>`app/api/godview/campus/memberships/route.ts`<br>`app/api/godview/campus/verifications/route.ts`<br>`app/api/godview/campus/verifications/[id]/route.ts`<br>`docs/campus-pilot-operations.md` | L | TYP, CAT | typecheck, lint; no PILOT_COLLEGE in godview campus routes; editor PUT passes the schema (browser check skipped if the Godview admin gate needs live Clerk) |
| SEED | Fixture data for every section and utility | Owner decision: build against fixtures; A1 (fixtures carry no stock photos) | `src/lib/campus/fixtures/core.ts`<br>`src/lib/campus/fixtures/market.ts`<br>`src/lib/campus/fixtures/housing.ts`<br>`src/lib/campus/fixtures/utilities.ts`<br>`src/lib/campus/fixtures/index.ts`<br>`src/lib/firebase/fakeSeed.ts`<br>`tests/campus/fixtures.test.ts` | L | TYP, CAT, FMT, FIX | npm test: catalog ids exist, required fields present, no ALL CAPS, no stock URLs; seeding a fresh fake DB fills every collection |
| SRCH | Campus search: aliases, places, price phrases, one-tap ask | B1, B4, B6, C1 search, D4 | `src/lib/search/campusSearch.ts`<br>`tests/search/campus-search.test.ts` | M | CAT, FMT | npm test: 'kjc cycle under 2k', 'pg near kothnur', 'clg', 'under 12k girls kjc', 'mattress near clg', askText <10 words |
| MSCH | Market schema, constants and feed grouping | Market v2 model rules: M1-M3, F2, F3, E1 bundles, C2, G1, Market v2 sections | `src/lib/campus/market.ts`<br>`src/lib/campus/marketSchema.ts`<br>`src/lib/campus/marketFeed.ts`<br>`tests/campus/market-schema.test.ts`<br>`tests/campus/market-feed.test.ts` | L | TYP, RUL, FMT, ART | npm test: ticket above face value, seat without departure, scooter without plate, bundle 0/21 items rejected; empty-description wanted accepted; grouping correct |
| HMOD | Housing model, schema and WhatsApp paste parser | B5, I1, I2, E2, C1, C2, F4, H2, paste-a-WhatsApp-post autofill | `src/lib/campus/housing/model.ts`<br>`src/lib/campus/housing/schema.ts`<br>`src/lib/campus/housing/parseWhatsAppPost.ts`<br>`tests/campus/housing-model.test.ts`<br>`tests/campus/housing-whatsapp.test.ts` | L | TYP, FMT, RUL, CAT | npm test: agent without brokerage and phone-in-description rejected, rules exclusivity, 6+ sample posts parsed exactly |
| STORE | Pre-sign-in choice store, college picker and stay step | Sign-in step 1 (college + campus picker with GPS distance), stay step, B4, B6; never ask for an area | `src/lib/stores/collegeStore.ts`<br>`src/components/auth/CollegePicker.tsx`<br>`src/components/auth/StayStep.tsx`<br>`next.config.js` | M | TYP, CAT, FMT | typecheck, lint; no lat/lng in store state or request bodies; persist includes pick and stay; geolocation allowed for self |
| SIGNIN | Custom sign-in: Continue with Google first, 6-digit email code second | Sign-in step 2 (Continue with Google first, email code second, ID card fallback offered) | `src/components/auth/useCollegeSignIn.ts`<br>`src/components/auth/SignInStep.tsx`<br>`src/components/auth/EmailCodeForm.tsx`<br>`src/components/auth/GoogleMark.tsx`<br>`app/(auth)/sso-callback/page.tsx`<br>`app/(auth)/register/page.tsx` | M | CAT | typecheck, lint; no afterSignInUrl/afterSignUpUrl or 'as any' in touched files; live round trip is a morning item |
| CPARTS | Shared campus UI parts: price, places, gender, photos, detail parts | C1 inputs, C2 chips, B5, D1, D2, D3 landmark picker, A1 uploads only, shared detail parts | `src/components/campus/fields/PriceInput.tsx`<br>`src/components/campus/fields/PriceTermsChips.tsx`<br>`src/components/campus/fields/GenderChips.tsx`<br>`src/components/campus/fields/PhotoField.tsx`<br>`src/components/campus/places/LandmarkPicker.tsx`<br>`src/components/campus/places/RingChips.tsx`<br>`src/components/campus/places/DistanceLine.tsx`<br>`src/components/campus/detail/Gallery.tsx`<br>`src/components/campus/detail/ReportSheet.tsx`<br>`src/components/campus/detail/ContactButton.tsx`<br>`src/components/campus/detail/SaveShare.tsx`<br>`app/dev/parts/page.tsx` | L | TYP, FMT, CAT, ICO | typecheck, lint; fixture mode /dev/parts at 375 px and 1280 px: price preview, landmark distance line, ring default 1 km, locked gender, no horizontal scroll |
| NTF | Notification queue, inbox API, rules and indexes | E4 (12:30 / 19:30, never after 22:00), in-app only; rules and indexes for new collections | `src/lib/campus/notify.ts`<br>`app/api/campus/notifications/route.ts`<br>`firestore.rules`<br>`firestore.indexes.json`<br>`tests/security/firebase-rules.test.mjs`<br>`docs/35-campus-data-model.md`<br>`docs/30-data-models.md` | M | TYP, RUL, FIX, MEM | typecheck, lint; indexes JSON parses; rules test only with local Java + emulator (else skipped); fixture mode GET returns only due items |
| HDR | Header campus chip, shell rules, CampusGate routing, shared session | Never ask which campus; show campus in headers; tabs Home, Print, Market, Housing, Orders; B4, H3 | `src/components/layout/SwoopNavbar.tsx`<br>`src/components/layout/RootShell.tsx`<br>`src/components/layout/Dock.tsx`<br>`src/components/campus/CampusGate.tsx`<br>`src/hooks/useCampusSession.ts`<br>`src/hooks/useCurrentCampus.ts` | L | TYP, CAT, MEM, STORE, ICO | typecheck, lint; no useCollegeNames or uppercase in SwoopNavbar; fixture mode chip 'KJU Main' / 'KJU Airport Rd', one session request per page, gate links carry next |
| LOGIN | /login stepper, AuthShell trust line, dev preview | Sign-in step 1 then step 2 in order; H3 trust line; B4 copy | `app/(auth)/login/page.tsx`<br>`src/components/auth/AuthShell.tsx`<br>`app/(auth)/login/preview/page.tsx` | M | STORE, SIGNIN | typecheck, lint; fixture mode /login/preview at 375 px and 1280 px: every step, 'KJC' finds KJU, KJU shows 2 campuses, stay skippable, no ALL CAPS, no horizontal scroll |
| VERIFY | /campus/verify onboarding: domain result, add college email, ID card, course step | Sign-in step 2 outcome, ID card fallback, step 3 (H1 programme, specialisation, semester) | `app/campus/verify/page.tsx`<br>`src/components/campus/CourseStep.tsx`<br>`src/components/campus/AddCollegeEmail.tsx`<br>`src/components/campus/IdCardUpload.tsx`<br>`app/(auth)/login/preview/verify/page.tsx` | L | MEM, STORE, SIGNIN | typecheck, lint; fixture mode 375 px: new-user, unverified-kju and pending-id-card each show the right step; semester list follows programme |
| MAPI | Market listing API v2: read, create, serializer | Market v2 data, D1/D5 distance per viewer campus, B1 saved number, G2 duplicate guard, M2 ticket expiry | `app/api/marketplace/listings/route.ts`<br>`app/api/marketplace/listings/[id]/route.ts`<br>`src/lib/campus/marketSerialize.ts` | L | TYP, MSCH, RUL, FMT, MEM, SEED | typecheck, lint, npm test; fixture mode: GET items carry distanceM, a ticket POST expires at showtime, a duplicate returns 409 |
| MKIT | Market UI kit | Market v2 cards and sections, C1, C2, D1, G1, G3, B1, E1, A1 | `src/components/campus/market/ListingCard.tsx`<br>`src/components/campus/market/BundleCard.tsx`<br>`src/components/campus/market/PassRow.tsx`<br>`src/components/campus/market/WantedCard.tsx`<br>`src/components/campus/market/FurnishTiles.tsx`<br>`src/components/campus/market/AlsoChips.tsx`<br>`src/components/campus/market/AskCard.tsx`<br>`src/components/campus/market/SeasonPrompt.tsx`<br>`src/components/campus/market/PriceBits.tsx`<br>`app/dev/market-kit/page.tsx` | L | TYP, FMT, ICO, ART, MSCH, SEED, CPARTS | typecheck, lint; rg 'uppercase\|₹' src/components/campus/market empty; fixture mode /dev/market-kit at 375 px: prices, distance, all states, targets >= 32 px |
| HCARD | Housing card v2 | C1, C2, D1, E2, G1, G3, I1, I2, F4, H2, A1, B7 | `src/components/campus/housing/HousingListingCard.tsx`<br>`app/dev/housing-kit/page.tsx` | M | TYP, HMOD, FMT, ART, ICO, CPARTS, SEED | typecheck, lint; fixture mode /dev/housing-kit at 375 px and 1280 px: every fixture card shows the right lines without overflow |
| DEAL | Student deals v1 (verified only) | J5 student deals, H3 never charge students | `src/lib/campus/studentDeals.ts`<br>`app/api/campus/student-deals/route.ts`<br>`app/campus/deals/page.tsx`<br>`tests/campus/student-deals.test.ts` | M | TYP, FMT, MEM, SEED, ICO, ART, CPARTS | npm test: expired hidden, distance sort stable; fixture mode 375 px: verified sees deals by distance, unverified gets the gate and API 403 |
| LOST | Lost and found v1 (hides ID details) | U2 lost and found that hides ID details | `src/lib/campus/lostFound.ts`<br>`app/api/campus/lost-found/route.ts`<br>`app/api/campus/lost-found/[id]/route.ts`<br>`app/campus/lost-found/page.tsx`<br>`tests/campus/lost-found.test.ts` | L | TYP, CAT, MEM, SEED, ICO, ART, CPARTS | npm test: non-owner sees a redacted ID-card post, owner sees all; fixture mode 375 px: seeded ID card redacted, claim sent and approved |
| HAPI | Housing API v2: serializer, create, lifecycle actions | G1, G2, G3, E2, E4, D3, D5, I1, I2, H3 | `src/lib/campus/housing/serialize.ts`<br>`tests/campus/housing-serialize.test.ts`<br>`app/api/housing/posts/route.ts`<br>`app/api/housing/posts/[id]/route.ts` | L | HMOD, NTF, MEM, RUL, FMT, SEED | npm test (fake snapshots): reserved lapse, owner-only nudge at 72 h, per-campus distance, price-drop fields; fixture mode: reserve then GET shows reserved |
| MACT | Market listing actions API | G1 Mark sold / Mark booked / Reserved 24 h, G2 still available, G3 price drop + saver alerts, F3 seats left | `app/api/marketplace/listings/[id]/route.ts`<br>`src/lib/campus/marketActions.ts` | M | MAPI, NTF, MSCH | typecheck, lint, npm test; self-review action matrix; fixture mode: reserve + lower_price on a seeded post, a saver notification doc exists |
| MFEED | Market v2 feed and the four See all screens | Market v2 feed; See all: Rooms clearing out, Seats tickets and passes, Everything near you, Wanted; B1, B6, C1, D2, E1, G3 strip, campus in header | `src/components/campus/MarketplaceExperience.tsx`<br>`src/components/campus/market/MarketSeeAll.tsx`<br>`src/hooks/useMarketFeed.ts`<br>`app/marketplace/all/[section]/page.tsx`<br>`app/girls-space/marketplace/all/[section]/page.tsx`<br>`src/components/campus/MarketplaceCard.tsx` (delete) | L | MKIT, MAPI, MSCH, SRCH, HDR, CPARTS, RUL | typecheck, lint; fixture mode 375/1280 px: section order, each See all, /marketplace/all/x 404, 'cycle under 12k' and 'mattress near clg', ask on empty search, girls mirror, no horizontal scroll |
| MFORM1 | New listing form v2, part 1: shell, item, wanted, bundle | Market post form v2: B1 Wanted placeholder, C1, C2, D3 landmark picker, E1 bundles, G2 bring it back, campus never asked | `app/marketplace/new/page.tsx`<br>`src/components/campus/market-form/BundleItemsField.tsx`<br>`src/components/campus/market-form/registry.tsx`<br>`src/components/campus/market-form/payload.ts`<br>`tests/campus/market-form-payload.test.ts` | L | MSCH, CPARTS, MAPI, HDR, SRCH, MEM | npm test: item, wanted, bundle payloads pass marketSchema; fixture mode 375 px: 1.5k preview, landmark distance, bundle rows, ?kind=wanted&q=cycle prefill, post lands in feed |
| HOME | Home v2: greeting, seasonal slot, utility row, illustrations | Home v2 canvas, A1, B4, E1 seasonal slot, utility row (deals, lost and found, blood donors, games), H3 trust line, campus in header | `app/page.tsx`<br>`src/components/AnnouncementCarousel.tsx`<br>`src/components/home/UtilityRow.tsx` | L | ICO, ART, RUL, HDR, SEED | typecheck, lint; fixture mode 375/1280 px: no <img>, no caps, exams card on 7 Nov, 4 tiles link correctly, campus chip, 'Hey ...' greeting |
| BLOOD | Blood donor alerts v1 (opt-in) | U1 opt-in blood donor alerts, E4 quiet hours | `src/lib/campus/blood.ts`<br>`app/api/campus/blood/route.ts`<br>`app/campus/blood/page.tsx`<br>`tests/campus/blood.test.ts` | L | TYP, MEM, NTF, SEED, ICO, ART | npm test: compatibility table and matcher; fixture mode 375 px: opt in, post a request, it shows; unverified gets the gate |
| GAMES | Pickup games with slots v1 | U4 pickup games with slots (no events) | `src/lib/campus/games.ts`<br>`app/api/campus/games/route.ts`<br>`app/api/campus/games/[id]/route.ts`<br>`app/campus/games/page.tsx`<br>`tests/campus/games.test.ts` | L | TYP, CAT, MEM, NTF, SEED, ICO, ART, CPARTS | npm test: can't join full or started, no double join, leave frees a slot; fixture mode 375 px: join drops the count, full shows Full |
| DEAD | Remove dead auth, announcements and location code | Not launched: delete legacy paths when replaced (Firebase phone OTP, prebuilt Clerk styling, dead announcements API, unused location helper) | `app/(auth)/otp/page.tsx` (delete)<br>`src/components/auth/PhoneLogin.tsx` (delete)<br>`src/components/auth/PhoneRegister.tsx` (delete)<br>`src/components/auth/clerkAppearance.ts` (delete)<br>`src/lib/stores/authStore.ts`<br>`src/lib/utils/location.ts` (delete)<br>`app/api/announcements/route.ts` (delete)<br>`proxy.ts` | S | SIGNIN, LOGIN | typecheck, lint, npm test; grep for the deleted modules in app and src is empty; fixture mode / and /login still load |
| HFEED | Housing feed v2 | Campus in headers, B1, B4, B6, C1, D2, D4, E3 From students + agents digest, H3 | `src/components/campus/HousingExperience.tsx`<br>`src/components/campus/housing/HousingFilters.tsx`<br>`src/hooks/useHousingFeed.ts` | L | HCARD, HAPI, SRCH, CPARTS, HDR, RUL | typecheck, lint; fixture mode 375/1280 px: 1.8 km post hidden at 1 km and shown at 2 km, 'under 9k', 'kjc', 'Kristu', 'Kothnur', ask on empty, girls route only girls |
| HFORM | Housing post form v2 with landmark picker and WhatsApp paste | Housing post after (canvas): I1, I2, B5, E2, C1, C2, D3, F4, H2, B4, paste autofill, never ask campus | `app/housing/new/page.tsx`<br>`src/components/campus/housing/HousingPostForm.tsx`<br>`src/components/campus/housing/FormFields.tsx`<br>`src/components/campus/HousingCard.tsx` (delete) | L | HMOD, CPARTS, HAPI, HDR, MEM | typecheck, lint; fixture mode 375 px: submit blocked without move-in/who can stay/rules, agent needs brokerage, paste fills fields, ?type=roommate&area=Kothanur prefills, post appears in feed |
| HDETAIL | Housing detail with owner lifecycle | G1, G2, G3, E2, I1, I2, D1, F4, H2, H3, C1, C2 | `src/components/campus/housing/HousingDetail.tsx`<br>`app/housing/[id]/page.tsx`<br>`app/girls-space/housing/[id]/page.tsx` | M | HAPI, CPARTS, HMOD | typecheck, lint; fixture mode 375 px: reserved, price-dropped, agent and owner-nudge fixtures render; reserve, lower rent and beds update the fake DB |
| MFORM2 | New listing form v2, part 2: seat, cab split, ticket, pass, vehicle | F2 seat swap with seat gender, F3 airport cab split, M1 vehicles, M2 tickets, M3 passes fair price | `src/components/campus/market-form/TripFields.tsx`<br>`src/components/campus/market-form/TicketFields.tsx`<br>`src/components/campus/market-form/PassFields.tsx`<br>`src/components/campus/market-form/VehicleFields.tsx`<br>`src/components/campus/market-form/registry.tsx`<br>`src/components/campus/market-form/payload.ts`<br>`tests/campus/market-form-payload.test.ts` | M | MFORM1, RUL, FMT, CPARTS | npm test: payload test covers all 8 kinds; fixture mode 375 px: fair price updates, ticket above face value blocked, cycle hides plate/RC/insurance, seat lands in Seats section |
| MDETAIL | Market detail screen | C1, C2, C3 pickup + pay line, D1, G1, G3, B1 I have this, H3, M1-M3 meta | `src/components/campus/MarketDetail.tsx`<br>`app/marketplace/[id]/page.tsx`<br>`app/girls-space/marketplace/[id]/page.tsx` | L | MACT, MKIT, CPARTS, MSCH | typecheck, lint; fixture mode 375 px one detail per kind: owner actions per kind, reserved disables buyer CTA, pay-on-pickup line present |
| CONTACT | Contact requests and availability for v2 listings | G1 reserved blocks new requests, Wanted I have this intent, Swoop naming, E4 owner alert | `app/api/contact-requests/route.ts`<br>`src/lib/campus/serialize.ts` | M | MAPI, HAPI, NTF | typecheck, lint, npm test; no 'PeasyPrints' in the route; fixture mode: reserved post returns 409, wanted post stores intent offer |
| PRINTCAMPUS | Print shops follow the signed-in campus | Never ask which campus elsewhere; retire the legacy name-based college picker; B4 Swoop naming on Print | `app/upload/page.tsx`<br>`app/godview/stores/page.tsx`<br>`app/godview/layout.tsx`<br>`src/types/models.ts`<br>`src/lib/stores/collegeStore.ts`<br>`app/godview/colleges/page.tsx` (delete) | M | HDR, HOME, SEED, STORE | typecheck, lint; grep useCollegeNames, LEGACY_COLLEGES, selectedCollege in app and src empty; fixture mode /upload lists KJU Main fixture shops |
| MYPOSTS | My posts and updates on /campus/activity | G1 reserved countdown, G2 day-3 Still available?, G3 lower price, E4 in-app updates, Wanted offers | `app/campus/activity/page.tsx`<br>`src/components/campus/market/MarketMyPosts.tsx`<br>`src/components/campus/housing/HousingMyPosts.tsx` | M | MACT, HAPI, NTF, MKIT, HCARD | typecheck, lint; fixture mode 375 px /campus/activity?tab=posts: 4-day-old confirm shows 'Still available?', 1-day-old does not; Updates lists due notifications |
| CRON | Maintenance planner for new lifecycles and account purge | G1 reserve lapse, G2 nudge, M2/F2/F3 expiry, E1 bundles, U1-U4 cleanup, purge of new personal data | `src/lib/campus/maintenance.ts`<br>`app/api/internal/campus-maintenance/route.ts`<br>`app/api/internal/campus-users/[id]/route.ts`<br>`tests/campus/maintenance.test.ts` | L | RUL, NTF, SEED, MAPI, HAPI, BLOOD, GAMES, LOST | npm test with fixed now values; typecheck, lint; fixture mode maintenance GET with the CRON_SECRET bearer returns counts and updates the fake DB |
| CLEAN | Legacy cleanup and final copy audit | Not launched: delete replaced legacy paths; C1 on render packs; B7/H3 audit | `src/types/campus.ts`<br>`src/lib/campus/constants.ts`<br>`src/lib/campus/serialize.ts`<br>`src/components/campus/ContentDetail.tsx` (delete)<br>`app/api/godview/campus/content/route.ts`<br>`app/api/godview/render-packs/route.ts`<br>`app/api/marketplace/listings/route.ts`<br>`app/api/housing/posts/route.ts` | L | MFEED, MFORM2, MDETAIL, HFEED, HFORM, HDETAIL, CONTACT, MYPOSTS, CRON, PRINTCAMPUS, DEAD, GVC, VERIFY | typecheck, lint, npm test; legacy symbol grep empty or justified; fixture smoke of /, /marketplace, /housing, /campus/activity and one detail each |

## Waves

A package runs only after all of its dependencies are in an earlier wave. No two packages in the same wave touch the same file (checked by script while planning).

| Wave | Packages (size) | Longest |
|---|---|---|
| 1 | TYP (M), CAT (L), FMT (M), RUL (M), FIX (L), ICO (M), ART (L), COPY (M) | CAT (L, 60 min) |
| 2 | MEM (L), GVC (L), SEED (L), SRCH (M), MSCH (L), HMOD (L), STORE (M), SIGNIN (M), CPARTS (L) | MEM (L, 60 min) |
| 3 | NTF (M), HDR (L), LOGIN (M), VERIFY (L), MAPI (L), MKIT (L), HCARD (M), DEAL (M), LOST (L) | HDR (L, 60 min) |
| 4 | HAPI (L), MACT (M), MFEED (L), MFORM1 (L), HOME (L), BLOOD (L), GAMES (L), DEAD (S) | HAPI (L, 60 min) |
| 5 | HFEED (L), HFORM (L), HDETAIL (M), MFORM2 (M), MDETAIL (L), CONTACT (M), PRINTCAMPUS (M), MYPOSTS (M), CRON (L) | HFEED (L, 60 min) |
| 6 | CLEAN (L) | CLEAN (L, 60 min) |

Estimated wall-clock build time is about 6 hours: six waves, each as long as its longest package (60 min each), plus the lead's verification per wave. Total agent work is about 34 agent-hours (2,055 agent-minutes): 44 build-and-self-review agents, one per package.

Shared files and the one package that owns them in a wave:

| File | Wave and package |
|---|---|
| `src/types/campus.ts` | W1 TYP, W6 CLEAN |
| `src/lib/campus/constants.ts` | W1 TYP, W6 CLEAN |
| `src/components/swoop/icons.tsx` | W1 ICO |
| `src/components/swoop/primitives.tsx` | W1 COPY |
| `proxy.ts` | W1 FIX, W4 DEAD |
| `src/lib/firebase/fakeSeed.ts` | W1 FIX, W2 SEED |
| `src/lib/stores/collegeStore.ts` | W2 STORE, W5 PRINTCAMPUS |
| `src/lib/campus/auth.ts` | W2 MEM |
| `src/components/layout/RootShell.tsx`, `Dock.tsx`, `SwoopNavbar.tsx`, `CampusGate.tsx`, `useCampusSession.ts` | W3 HDR |
| `app/api/marketplace/listings/[id]/route.ts` | W3 MAPI, W4 MACT |
| `app/api/marketplace/listings/route.ts` | W3 MAPI, W6 CLEAN |
| `app/api/housing/posts/route.ts` | W4 HAPI, W6 CLEAN |
| `app/page.tsx` | W4 HOME |
| `src/components/campus/market-form/registry.tsx`, `payload.ts` | W4 MFORM1, W5 MFORM2 |
| `src/lib/campus/serialize.ts` | W5 CONTACT, W6 CLEAN |
| `app/campus/activity/page.tsx` | W5 MYPOSTS |
| `src/components/campus/ContentDetail.tsx` | Not edited. CPARTS copies its parts, and CLEAN deletes it in W6. |
| `vercel.json` | No package edits it. The worktree carries an uncommitted Vercel deployment guard, `git.deploymentEnabled: {"kada-18/**": false}`, so pushes to the run branch don't create Vercel deployments. It goes in the plan commit (`KADA-18: plan and runbook`) before the first push. CRON keeps the cron schedule unchanged. |

## Per-package verification (lead, after each agent returns)

1. `git status --porcelain`: only the package's files changed. Anything else is reverted (`git checkout -- <file>` for tracked files, deletion for new stray files the package created).
2. `npm run typecheck` passes.
3. `npm run lint` passes (`--max-warnings=0`).
4. `npm test` passes, including the package's own tests for every helper it touched.
5. UI packages: browser check in fixture mode on the dev server (`http://localhost:3018`, `NEXT_PUBLIC_SWOOP_FIXTURES=1`) at 375 px and 1280 px. Run through the package's acceptance list, confirm there is no horizontal scroll, read the console for errors, and keep one screenshot per changed screen for the morning report. Switch the fixture user with `/api/dev/fixture-user?id=...&next=...`.
6. Grep checks named in the package's acceptance.
7. A check that needs a live service (Clerk, Firebase, Storage, the rules emulator without Java, the Godview admin gate) is not attempted. It goes in the ledger under "Skipped verifications" with the reason.

## End-of-wave verification

1. Full `npm run typecheck`, `npm run lint` and `npm test` on the branch with all of the wave's packages in.
2. A fixture-mode smoke test of every route the wave changed, plus `/`, `/marketplace` and `/housing`, at 375 px. Each page renders, has no console errors and no horizontal scroll.
3. End of wave 1 only: `npm run build` once, to confirm that `.ts`-extension relative imports inside `src/` resolve under webpack. If the build fails only because of missing env values, record it as skipped. If it fails on the imports, the lead switches the affected imports to extensionless `@/` paths and moves those tests to type-only imports before wave 2.
4. End of wave 6: `npm run build` again, plus the CLEAN grep audit.
5. Update the ledger's session log with the wave result and the next wave.

## What needs live services later (morning report)

- **Clerk dashboard (owner).** Turn on Google with Swoop's own OAuth client and the email verification code. Set username, phone and password to not required, so Google sign-up completes. Allow several emails per user, so "Add your college email" works. Then test the real Google and email-code round trips, sso-callback, and add-college-email.
- **Email domains per college.** The real student domains need to be entered in Godview. Some colleges may use Microsoft 365, and for them the 6-digit code becomes the main path. Until the domains are entered, no college auto-verifies and students use the ID card.
- **Campus data.** Confirm the campus origins and landmark coordinates (all `approx`), and the names of the 8 Jain city campuses and the 4 Christ campuses. Distances are only as accurate as these.
- **Firestore.** Deploy the new rules and indexes (`firestore.rules`, `firestore.indexes.json`). Run the rules tests in the emulator if Java was missing tonight.
- **Real data paths.** Storage uploads (media and ID cards), the real Firestore reads and writes in every new route, the hourly Vercel cron (the plan tier decides whether it runs hourly or daily), and the account-deletion purge.
- **Live Firebase client data.** The print shop and order screens (`/`, `/upload`, the pickup page) use live data outside fixture mode.
- **Notifications.** Push is not built. The queue is in-app only (`/campus/activity` Updates).
- **Godview admin pages.** These may not open in fixture mode, because their admin gate uses Clerk.
- **Clerk's browser script.** It still loads in fixture mode because `ClerkProvider` wraps the app. The publishable key in `.env.local` is used only for that. Our code makes no Clerk call in fixture mode.
- **Owner decisions still open.**
  - The old `colleges` Firestore collection and its public-read rule.
  - The Godview announcements page: retire it, or reuse it to drive the seasonal slot.
  - "PeasyPrints" in the terms and privacy legal text.
  - The Print "Service fee" versus H3 "never charge students".
  - The privacy notice copy for stay distance, course and blood group.

## Risks

- **Fixture fidelity.** The fake Firestore covers only the query subset in use today. A route that starts using `collectionGroup`, `count` or `startAfter` fails in fixture mode until the fake is extended (the lead extends FIX in a fix pass).
- **Node test imports.** Modules that tests import may use only `import type` from `@/...` paths, and their runtime imports must be relative with the `.ts` extension. This pattern is new inside `src/`, which is why there is a build check after wave 1.
- **Clerk 6.39.3.** `authenticateWithRedirect` has no Google `hd` hint, so the account chooser cannot be limited to the college domain. A student who picks a personal Gmail gets an account and lands on the "not a KJU email" screen. The server-side domain check is the only gate.
- **Wide waves.** Waves 2, 3 and 5 run 9 agents each. If usage runs short, run a wave in two halves. The order inside a wave does not matter, because no files overlap.
- **Copy changes in COPY.** The Tag change restyles every tag in the app at once. The account-deletion phrase changes an API contract, so the client and the route ship together in COPY.
- **Privacy.** Stay distance, course and blood group are new personal data. Blood group is opt-in and is deleted on opt-out. The account purge is extended in CRON, and the privacy copy is a morning item.
- **Dropped-scope drift.** Agents could reintroduce events, jobs, food, pets or past papers through category lists. Every brief and `common_rules` forbids them, and CLEAN's audit greps for them.
- **Placeholder data.** Fixture deals use invented merchant names marked `sample`. They must never ship as real offers.
- **Firestore scale.** Feed queries use `status in [...]` with a limit of 200 and filter by college in memory. That is fine for the KJU pilot but will not scale; the composite indexes are added for later.

## Asset files to delete (owner approval needed; not deleted tonight)

None of these is referenced after wave 1. ART swaps out the pickup kitten, and DEAD removes the dead announcements route that served `Group 14.png`.

| File | What it is | What breaks if deleted |
|---|---|---|
| `public/announcements/Group 14.png` | Stock cat photo with "WE ARE LIVE NOW". It was served only by the dead announcements API. | Nothing, once DEAD lands. |
| `public/figma/3282e2fcd344b844a08c5e470da99b46d1dc9445.png` | Pixel-art kitten that was on the pickup page. | Nothing, once ART lands. |
| `public/figma/39ee2580af610dcf6070534ca8baa00b1f81f2e7.png`, `3a3d1724c2727a8bfe5104c30b0f9c4f34325e85.png`, `a9df3efab731ab9679d53bf2e350d8ff724a5c4b.png`, `d629420214b8200ddc959eece5e5148d49b4964a.png`, `e4702269c114f68dcff879aecd2445c1fe9c83c8.svg` | Old Figma exports, unreferenced. | Nothing. |
| `public/images/icons8-french-fries-100.png`, `icons8-hamburger-100.png`, `icons8-kawaii-soda-100.png`, `icons8-rice-bowl-100.png` | icons8 food icons (food is dropped), unreferenced. | Nothing. |
| `public/images/hovercode.png`, `origami.png`, `printer.png` | Unreferenced images. | Nothing. |

Keep `public/fonts/Quinn-Bold.otf`. It is the brand font for the SWOOP wordmark.
