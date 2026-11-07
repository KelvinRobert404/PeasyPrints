# KADA-18 ledger

This ledger tracks the KADA-18 Nightly run. The run implements the owner's 7 Nov redesign decisions. The plan is in `docs/implementations/kada-18-redesign.md`, the agent briefs are in `docs/implementations/kada-18-packages.json`, and the runbook is `docs/implementations/kada-18-redesign-nightly.md`. Branch: `kada-18/implement-redesign`, base `dev`.

Statuses: `pending`, `building`, `verifying`, `done` (verified, committed and pushed), `blocked` (failed twice, or broke the build after one fix pass; the package's files are restored), `skipped` (a package it depends on is blocked).

## Claim

**Working:** siyonroy · MacBook (macOS, ~/Desktop/Developer/PeasyPrints-kada18) · chat "KADA-18 · 7 Nov/redesign-run1" (claude://claude.ai/epitaxy/local_fa979743-9896-41c1-b141-2e451fc40f12) · since 7 Nov 21:18 IST

Run setup on this Mac, settled with the owner in chat before the start (7 Nov 21:15 IST):
- **No Linear connector in this chat.** The owner chose to run without Linear: this ledger is the only claim and progress record for this run. The owner copies the Preflight and report text into KADA-18. Before every push, check this ledger (on GitHub) for a newer `**Reclaimed:**` line.
- **Not running anywhere else.** The owner confirmed KADA-18 is not running or claimed on the Windows machine or by anyone else.
- **No `.env.local` on this Mac.** The owner chose to run without it. Typecheck, lint, tests and builds still run. Every browser check (375/1280 px, fixture smoke tests, before/after screenshots) is a skipped verification, because `ClerkProvider` can't render without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- **Power:** caffeinate -dims (72 h) and the app's keep-awake hold. First resume at 8 Nov 02:03 IST.
- **ETA:** ~6 h of work · done about Sun 8 Nov 10:00 IST (44 packages in 6 waves, every wave has L packages; ~220M effective tokens, expect about 3 usage resets).

## Packages

| Package | Title | Wave | Size | Status | Commit | Notes |
|---|---|---|---|---|---|---|
| TYP | Types and shared constants | 1 | M | done | d973b62 | Additive types; new collections market_listings/housing_listings; DocTime structural; test glob quoted in package.json |
| CAT | College, campus and course catalog | 1 | L | done | 2f91a40 | 7 colleges, 21 campuses; emailDomains left empty (no guessed domains); landmark and 12 origin coordinates are estimates; semesterStarts placeholder |
| FMT | Price and distance helpers | 1 | M | done | 0697643 | 'Rs 6k /mo' (space before suffix); 0/NaN show 'Free'; fairPassPrice floor Rs 10 |
| RUL | Season, lifecycle and notification-slot rules | 1 | M | done | d484a84 | Placeholder seasonal slot titles; exams slot wins; date-only means end of IST day |
| FIX | Offline fixture mode (fake Admin DB and bucket, proxy bypass) | 1 | L | done | 4b4f2f5 | Fixture mode skips clerkMiddleware; principal from fixture cookie comes with MEM; getAdminApp throws in fixture mode |
| ICO | Shared icon additions | 1 | M | done | d7b41c8 | CanteenIcon removed (no users); ScooterIcon drawn as a moped |
| ART | Swoop illustration series, room art and pickup kitten swap | 1 | L | done | acc3d93 | app/page.tsx keeps its inline PrinterArt (HOME can swap); pickup 'Paid' stat still has the rupee sign (file now formats later) |
| COPY | Copy pass: sentence-case tags, no ALL CAPS, no food leftovers | 1 | M | done | 7f616b3 | Removed --tint-canteen token; uppercase badges to sentence case; deletion copy shortened |
| MEM | Membership server: multi-college principal, onboarding, session, config | 2 | L | done | 010da12 | MEM: fixture users seeded lazily in auth.ts; unread count still reads campus_contact_requests; godview config route still writes the legacy top-level pickupPoints |
| GVC | Godview campus config for all colleges and trust-queue columns | 2 | L | done | 775aa4c | GVC built; also writes top-level pickupPoints for old readers; subdomains count needs suffix match in auth.ts; browser check skipped (Clerk gate) |
| SEED | Fixture data for every section and utility | 2 | L | done | 6708b90 | Type gaps put in copy: housing kind, rent drop and reserved; insurance date; sample deal via createdBy. Shops use campus ids. All listing images are . |
| SRCH | Campus search: aliases, places, price phrases, one-tap ask | 2 | M | done | 5191b02 | SRCH built: item words set a category and stay search words; typo place matching; a lone 2k reads as a max; girls also finds anyone listings; clg with no viewer college sets nothing. |
| MSCH | Market schema, constants and feed grouping | 2 | L | done | 599426f | Schema input names (departureAt, faceValue, plateState, landmarkId, whatsappNumber) not yet on src/types/market.ts; API package must map. needs_confirmation stays in feed. |
| HMOD | Housing model, schema and WhatsApp paste parser | 2 | L | done | ae01a22 | Housing model types live in model.ts (agent, no_restrictions, rentTerms enum, kind) because src/types/housing.ts differs; a later package must align the doc type. |
| STORE | Pre-sign-in choice store, college picker and stay step | 2 | M | done | 4ff4c5a | Store sanitizes pick/stay on every write and rehydrate; a campus change keeps the stay type but clears its distance; Skip sets stay to null; no browser check (no env) |
| SIGNIN | Custom sign-in: Continue with Google first, 6-digit email code second | 2 | M | done | 12181ed | SignInStep is pure UI: onEmailCode= sendCode,verifyCode object; hook returns AuthResult, never throws; email sign-up may hit missing_requirements live |
| CPARTS | Shared campus UI parts: price, places, gender, photos, detail parts | 2 | L | done | b382323 | CPARTS built; typecheck/lint clean; browser check skipped (no env). Rent terms use local RentPriceTerms (no slightly_negotiable in PriceTerms); parts work uncontrolled. |
| NTF | Notification queue, inbox API, rules and indexes | 3 | M | done | 6a4ea76 | NTF fix: inbox GET scans newest 200 by createdAt; missing deliverAfter counts as due. Fixture inbox now shows items. New userId+createdAt indexes must be deployed. |
| HDR | Header campus chip, shell rules, CampusGate routing, shared session | 3 | L | done | 8795c64 | Shared session store with a Clerk userId refetch; refresh keeps old data; next is pathname only; /otp kept as auth page; browser checks skipped (no env) |
| LOGIN | /login stepper, AuthShell trust line, dev preview | 3 | M | done | 578da0e | LOGIN: 3-screen stepper with step= pushState; in-app Back pushes previous step; client preview uses notFound in prod; clerkAppearance.ts now unused, not deleted |
| VERIFY | /campus/verify onboarding: domain result, add college email, ID card, course step | 3 | L | done | 197ff3f | Fix pass: two copy lines shortened to 8 words (CourseStep subtitle, IdCardPending body). Typecheck and lint clean. Browser check still skipped (no env). |
| MAPI | Market listing API v2: read, create, serializer | 3 | L | done | c384daa | Uses market_listings via a cast on serial.ts type; viewer-relative roughDistanceM; hard expiry derived from details; dup guard per audience; PATCH collection switched only |
| MKIT | Market UI kit | 3 | L | done | b098bd8 | MKIT built; typecheck and lint pass. No browser check (no .env.local). Links are placeholder defaults; pass fair price uses sample paid amounts (schema lacks paid). |
| HCARD | Housing card v2 | 3 | M | done | 55e7e53 | Card prop type adds optional v2 fields HousingListing lacks; booked shows Reserved; kit fills those fields from fixture text; browser check not run |
| DEAL | Student deals v1 (verified only) | 3 | M | done | 2eb4264 | PATCH no longer wipes code/howToClaim when they are left out; only a present /null clears them. Collection stays CAMPUS_COLLECTIONS.deals (campus_deals). |
| LOST | Lost and found v1 (hides ID details) | 3 | L | done | b95526c | Used lost_found (seeded) not lost_found_items ; photos hidden from non-posters on all posts; contact required on create; browser check skipped. |
| HAPI | Housing API v2: serializer, create, lifecycle actions | 4 | L | done | a48a639 | housing_listings collection; previousRentPp naming; empty houseRules = no restrictions; other routes and indexes still on housing_posts; no browser check (no env) |
| MACT | Market listing actions API | 4 | M | done | 1096348 | Uses the schema s partIndex/seatsLeft; seats_left also on seats; no reserve or price drop on wanted posts; old confirm callers now get 400; fixture check not run |
| MFEED | Market v2 feed and the four See all screens | 4 | L | pending |  |  |
| MFORM1 | New listing form v2, part 1: shell, item, wanted, bundle | 4 | L | pending |  |  |
| HOME | Home v2: greeting, seasonal slot, utility row, illustrations | 4 | L | done | 08c25b1 | Fixture Home shows a local copy of FIXTURE_SHOPS: core.ts imports firebase-admin, so a client page can t import it. Follow-up: client-safe shops fixture |
| BLOOD | Blood donor alerts v1 (opt-in) | 4 | L | pending |  |  |
| GAMES | Pickup games with slots v1 | 4 | L | done | aae8479 | Uses CAMPUS_COLLECTIONS.games ( campus_games ), not pickup_games ; lead should rename it in constants.ts so it matches the index. Browser check not done. |
| DEAD | Remove dead auth, announcements and location code | 4 | S | done | cbc9306 | Typecheck fixed by regenerating .next types. RootShell.tsx:21 still checks /otp ; its owner package should drop it. |
| HFEED | Housing feed v2 | 5 | L | pending |  |  |
| HFORM | Housing post form v2 with landmark picker and WhatsApp paste | 5 | L | pending |  |  |
| HDETAIL | Housing detail with owner lifecycle | 5 | M | pending |  |  |
| MFORM2 | New listing form v2, part 2: seat, cab split, ticket, pass, vehicle | 5 | M | pending |  |  |
| MDETAIL | Market detail screen | 5 | L | pending |  |  |
| CONTACT | Contact requests and availability for v2 listings | 5 | M | pending |  |  |
| PRINTCAMPUS | Print shops follow the signed-in campus | 5 | M | done | bb1d796 | Fixture shops copied into /upload (core.ts is server only); selectedCollegeId in other packages files still hits the grep; stale .next/types needs typegen |
| MYPOSTS | My posts and updates on /campus/activity | 5 | M | pending |  |  |
| CRON | Maintenance planner for new lifecycles and account purge | 5 | L | pending |  |  |
| CLEAN | Legacy cleanup and final copy audit | 6 | L | pending |  |  |

## Session log

<!-- One line per event: <d Mon HH:MM IST> · <who/device> · <what happened> (wave started, package done with commit, wave verified, usage pause and resume time, run finished). -->

- 7 Nov 21:16 IST · MacBook · preflight GO (system sleep covered by caffeinate -dims); baseline typecheck, lint and 11 tests pass
- 7 Nov 21:18 IST · MacBook · run started; next resume 8 Nov 02:03 IST
- 7 Nov 21:19 IST · MacBook · wave 1 started (8 build agents)
- 7 Nov 21:29 IST · MacBook · wave 1 built (8/8, ~9.5 min, ~0.76M subagent tokens)
- 7 Nov 21:31 IST · MacBook · wave 1 verified: typecheck 0 errors, lint clean, tests 101/101; npm run build compiled (fails only at prerender on missing env)
- 7 Nov 21:32 IST · MacBook · wave 1 committed: d973b62 TYP, 2f91a40 CAT, 0697643 FMT, d484a84 RUL, 4b4f2f5 FIX, d7b41c8 ICO, acc3d93 ART, 7f616b3 COPY
- 7 Nov 21:41 IST · MacBook · STORE done, 4ff4c5a
- 7 Nov 21:41 IST · MacBook · SIGNIN done, 12181ed
- 7 Nov 21:42 IST · MacBook · SRCH done, 5191b02
- 7 Nov 21:42 IST · MacBook · MSCH done, 599426f
- 7 Nov 21:44 IST · MacBook · GVC done, 775aa4c
- 7 Nov 21:44 IST · MacBook · MEM done, 010da12
- 7 Nov 21:45 IST · MacBook · CPARTS done, b382323
- 7 Nov 21:47 IST · MacBook · LOGIN done, 578da0e
- 7 Nov 21:49 IST · MacBook · HMOD done, ae01a22
- 7 Nov 21:49 IST · MacBook · SEED done, 6708b90
- 7 Nov 21:50 IST · MacBook · HDR done, 8795c64
- 7 Nov 21:52 IST · MacBook · DEAD done, cbc9306
- 7 Nov 21:56 IST · MacBook · HCARD done, 55e7e53
- 7 Nov 21:57 IST · MacBook · NTF done, 6a4ea76
- 7 Nov 21:58 IST · MacBook · VERIFY done, 197ff3f
- 7 Nov 21:59 IST · MacBook · MAPI done, c384daa
- 7 Nov 22:00 IST · MacBook · DEAL done, 2eb4264
- 7 Nov 22:00 IST · MacBook · HOME done, 08c25b1
- 7 Nov 22:00 IST · MacBook · LOST done, b95526c
- 7 Nov 22:00 IST · MacBook · MKIT done, b098bd8
- 7 Nov 22:06 IST · MacBook · HAPI done, a48a639
- 7 Nov 22:06 IST · MacBook · MACT done, 1096348
- 7 Nov 22:07 IST · MacBook · PRINTCAMPUS done, bb1d796
- 7 Nov 22:07 IST · MacBook · GAMES done, aae8479


## Blocked

<!-- One entry per blocked package: id · what failed (command and first error line) · what was tried · files restored · packages skipped because of it. -->

## Skipped verifications

<!-- One entry per check not run tonight: package id · the check · why it was skipped (needs Clerk / Firebase / Storage / emulator / Godview admin gate) · what to run in the morning. -->

- ALL UI packages · browser checks at 375/1280 px, fixture smoke tests, before/after screenshots · no `.env.local` on this Mac (owner's choice), so ClerkProvider can't render · in the morning: add `.env.local` per the runbook and run the fixture smoke test on every changed route
- Wave 1 · npm run build prerender · compiles fine (so relative .ts imports resolve under webpack) but prerender needs the production env vars · run npm run build with real env in the morning
- CAT · real college email domains and map-checked landmark coordinates · not in the facts file · confirm before distances or email verification go live
- ART · pickup page PickupWaitArt against a real ready order · needs Firestore onSnapshot · check at 375/1280 px with a real order
- COPY · deletion-request API case-insensitive confirm · needs Clerk + Firestore · test with a live session


## Decided at night

<!-- One entry per decision the run made without the owner: what · the options · the choice (always the safest reversible one) · where it lives in the code · how to undo it. -->
- Verification per wave, not per package as each agent returns · options: per-package checks while other agents still edit the same worktree, or whole-wave checks once all are in · chose whole-wave typecheck/lint/test, then one commit per package with exact file staging · runbook section 2 · undo: none needed (commits are still per package)
- From wave 2 on (owner in chat: use as many subagents as needed) · options: wave barriers, or start each package as soon as its dependencies are verified · chose dependency-driven start, max 14 agents (16 CPUs), FIX added as an implicit dependency of DEAD (both touch proxy.ts), one verify agent and at most one fix pass per package, then serial commits · lives in the run's workflow script only · undo: go back to wave-by-wave runs
