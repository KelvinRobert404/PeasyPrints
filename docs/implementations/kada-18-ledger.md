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
| MEM | Membership server: multi-college principal, onboarding, session, config | 2 | L | pending |  |  |
| GVC | Godview campus config for all colleges and trust-queue columns | 2 | L | pending |  |  |
| SEED | Fixture data for every section and utility | 2 | L | pending |  |  |
| SRCH | Campus search: aliases, places, price phrases, one-tap ask | 2 | M | pending |  |  |
| MSCH | Market schema, constants and feed grouping | 2 | L | pending |  |  |
| HMOD | Housing model, schema and WhatsApp paste parser | 2 | L | pending |  |  |
| STORE | Pre-sign-in choice store, college picker and stay step | 2 | M | done | 4ff4c5a | Store sanitizes pick/stay on every write and rehydrate; a campus change keeps the stay type but clears its distance; Skip sets stay to null; no browser check (no env) |
| SIGNIN | Custom sign-in: Continue with Google first, 6-digit email code second | 2 | M | pending |  |  |
| CPARTS | Shared campus UI parts: price, places, gender, photos, detail parts | 2 | L | pending |  |  |
| NTF | Notification queue, inbox API, rules and indexes | 3 | M | pending |  |  |
| HDR | Header campus chip, shell rules, CampusGate routing, shared session | 3 | L | pending |  |  |
| LOGIN | /login stepper, AuthShell trust line, dev preview | 3 | M | pending |  |  |
| VERIFY | /campus/verify onboarding: domain result, add college email, ID card, course step | 3 | L | pending |  |  |
| MAPI | Market listing API v2: read, create, serializer | 3 | L | pending |  |  |
| MKIT | Market UI kit | 3 | L | pending |  |  |
| HCARD | Housing card v2 | 3 | M | pending |  |  |
| DEAL | Student deals v1 (verified only) | 3 | M | pending |  |  |
| LOST | Lost and found v1 (hides ID details) | 3 | L | pending |  |  |
| HAPI | Housing API v2: serializer, create, lifecycle actions | 4 | L | pending |  |  |
| MACT | Market listing actions API | 4 | M | pending |  |  |
| MFEED | Market v2 feed and the four See all screens | 4 | L | pending |  |  |
| MFORM1 | New listing form v2, part 1: shell, item, wanted, bundle | 4 | L | pending |  |  |
| HOME | Home v2: greeting, seasonal slot, utility row, illustrations | 4 | L | pending |  |  |
| BLOOD | Blood donor alerts v1 (opt-in) | 4 | L | pending |  |  |
| GAMES | Pickup games with slots v1 | 4 | L | pending |  |  |
| DEAD | Remove dead auth, announcements and location code | 4 | S | pending |  |  |
| HFEED | Housing feed v2 | 5 | L | pending |  |  |
| HFORM | Housing post form v2 with landmark picker and WhatsApp paste | 5 | L | pending |  |  |
| HDETAIL | Housing detail with owner lifecycle | 5 | M | pending |  |  |
| MFORM2 | New listing form v2, part 2: seat, cab split, ticket, pass, vehicle | 5 | M | pending |  |  |
| MDETAIL | Market detail screen | 5 | L | pending |  |  |
| CONTACT | Contact requests and availability for v2 listings | 5 | M | pending |  |  |
| PRINTCAMPUS | Print shops follow the signed-in campus | 5 | M | pending |  |  |
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
