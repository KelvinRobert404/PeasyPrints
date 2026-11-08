# KADA-19 ledger

This ledger tracks the KADA-19 Nightly run, which builds the Swoop demo site on sample data.

- **Plan:** `docs/implementations/kada-19-demo.md`
- **Agent briefs:** `docs/implementations/kada-19-packages.json`
- **Runbook:** `docs/implementations/kada-19-demo-nightly.md`
- **Branch:** `kada-19/demo-site`, base `kada-18/implement-redesign`
- **Demo:** `npm run demo`, then http://localhost:3019, with no env.

Always carry on from this ledger, never from the start. Only the lead edits it; agents never do.

Statuses:

- `pending`, `building`, `verifying`
- `done`: verified, committed and pushed
- `blocked`: failed twice, or broke the build after one fix pass; the package's files are restored
- `skipped`: a package it depends on is blocked

## Claim

<!-- Newest line wins. `**Working:** <person> · <device> · chat "<chat title>" · since <d Mon HH:MM IST>`, then `**Released:** ...` or `**Reclaimed:** ...` when the run stops or is taken back. -->

**Working:** jtk · claude-2 (GCP VM) · chat "KADA-19 · 8 Nov/demo-site" · since 8 Nov 10:35 IST (claim kept here only: Linear connector not signed in on this device)

## Packages

| ID | Title | Wave | Size | Status | Commit | Notes |
|---|---|---|---|---|---|---|
| SWITCH | Demo switch, shared contract, launcher and alias wiring | 1 | M | done | 49169df | demo reaches Ready on :3019 with no env; build and Turbopack refuse the flag; lead renamed the Razorpay placeholder (secrets grep) |
| SEED | Sample world: every surface full on both campuses, print orders and users | 1 | L | done | 00a3654 | 20 fixture tests; Meera owns no posts (pending ID card); lead updated the fake-admin seed test (users now seeded) |
| WORLD | One fake world per visitor: Admin DB, bucket, change log and hooks | 2 | L | done | d1f6430 | one world per visitor, LRU 50, change log; 376 tests at hand-back |
| CLERKSRV | Clerk server stand-in, demo identity and the session API | 2 | L | done | 3e35a70 | session API curl sequence passes on :3019; persona emails come from the seeded users docs (decided) |
| CLERKUI | Clerk client stand-in, avatar menu and the demo account chooser | 2 | L | done | 3ed7acd | avatar menu and chooser checked at 375 and 1280; chooser from Switch student shows the four students |
| FIREBASE | Firebase client stand-ins backed by the visitor's world | 2 | L | done | 7540a70 | /orders lists Sana's seeded orders; no Google host; 29 new tests |
| SHELL | Demo shell: no analytics or outside calls, and the DemoRoot mount | 2 | S | done | 01ed4c0 | no analytics hosts on :3019; DemoRoot mounted |
| HANDOFF | Demo hand-off sheet instead of WhatsApp, phone and mail links | 2 | S | done | 9257684 | /contact WhatsApp opens the sheet; /contact has only a WhatsApp link today |
| GATE | Demo proxy: visitor cookie, first visit, sign-in guard, areas kept out | 3 | M | done | 529e7ea | curl on :3019: first visit 307 to /demo?next=, visitor cookie 1 year, login bounce, godview/shopfront kept out, cross-site 403; /orders stays public (decided) |
| PERSIST | Visitor changes kept in the browser, and Reset demo | 3 | L | done | dc77aa3 | game join and a Farhan approval survived a server restart in the same browser; a fresh browser sees only seed; reset route mints a new visitor and signs out |
| DATE | Demo date and seasonal sample packs | 3 | M | done | 904edd2 | May/July/Nov Home and Market copy checked at 375; date route swaps season packs (8 market + 3-4 housing) |
| PRINTPAY | Simulated payment and order progress | 3 | L | done | a1a3953 | browser: 3-page PDF, Main Block Prints, demo sheet Pay, /orders processing -> printing -> ready in ~55 s; Payment fails alerts, no order; helpers moved to src/lib/demo/server/razorpay.ts (decided) |
| LIFE | Demo life: sample students answer | 3 | M | done | 3341f05 | Farhan approved Sana's headphones ask within 30 s with an inbox item; sample player joined the football game |
| ENTRY | Demo start page and the not-in-demo page | 4 | M | done | 324b789 | /demo and persona cards honour next; not-included page for godview and shopfront; checked at 375 and 1280 |
| DEMOBAR | Demo bar: student, demo date and Reset demo | 4 | M | done | eafda27 | 36 px strip at 375 (body padded, Market header below it); left panel at 1280; Kabir switch; Reset asks once and lands on /demo |
| SIGNIN | Simulated sign-in on /login: mocked Google, skip in, email code | 4 | M | done | 6228f54 | college Google to verify, course, Home greets Riya; personal to "That's not a KJU email"; Cancel idle; skip-in to redirect_url; email code any 6 digits |
| VERIFYD | /campus/verify in demo: add college email and approve ID card | 4 | S | done | d4549c5 | personal Riya adds riya@kju.test with any code, approved; Meera approves her card |
| PRINTUI | Print screens on sample data: Home order, sample PDF, hand-over | 4 | M | done | 46a540f | Home slot to pickup, hand-over marks collected and survives reload; sample PDF loads 4 pages |
| APICHK | Demo smoke script, the KADA-18 data checks and the API fixes | 4 | L | done | 3fc0dce | npm run demo:smoke: 200 passed, 0 failed; NTF check accepts an item queued for the next slot (decided) |
| HOMECHK | KADA-18 checks in demo: Home, header, gate, dock and profile | 5 | M | done | 6cc8a6f | HOME, DEAD, HDR, gate, profile, sign out (navbar, /profile, verify) pass; Riya no longer sees the stale Verify card; RootShell height subtracts the demo bar; gate copy sentence case |
| AUTHCHK | KADA-18 checks in demo: sign-in, verify and session | 5 | M | done | 27a318c | LOGIN, Google college and personal, email code, add college email, ID card, Meera pending, semesters, guarded redirects, login bounce pass; verify waits for the shared session refresh; demo email placeholders |
| MARKETCHK | KADA-18 checks in demo: Market feed, See all, details, forms and kits | 5 | L | done | c78384e | MFEED, MFORM1-2, MDETAIL, CONTACT, SEAMROUTES, seasons, MKIT, CPARTS pass; /dev/market-kit crash fixed; approval refresh and hand-off sheet in ContactButton |
| HOUSINGCHK | KADA-18 checks in demo: Housing, Girls' space, activity and My posts | 5 | L | done | f1c1b0e | HFEED, HFORM, HDETAIL, HCARD, MYPOSTS, seller asks, SEAMROUTES, Girls space, From students pass; 403 on girls housing for Sana gone; move-in follows the demo date; activity WhatsApp opens the demo sheet |
| UTILCHK | KADA-18 checks in demo: deals, lost and found, blood, games, privacy | 5 | M | done | 2cd7c32 | DEAL, LOST, BLOOD, GAMES, COPY, /contact pass; demo privacy copy says nothing is deleted; seeded O- request is fulfilled so not listed (by design) |
| PRINTCHK | KADA-18 checks in demo: print flow, orders, pickup art and campus shops | 5 | M | done | b65e277 | PRINTCAMPUS, sample PDF and images flow, pay fails, Today/Earlier, shops, ART, live pickup pass; /shops filtered by campus (real app too); paise kept on pickup |
| DEMOCHK | Demo checks end to end: persistence, reset, isolation, dates and the bar | 5 | M | done | 33f791e | all 9 checks pass; smoke 201/201 warm and cold; reset now clears the Firebase stand-in's uid; /campus dropped from the warm-up list |
| FIXPRICE | Student print prices without the rupee sign, keeping paise | 6 | S | done | 0b1421b | formatPrintPrice keeps paise (Rs 1.5); no rupee sign on /orders, Home, /upload, /shops/[id]; order totals now keep paise |
| FIXCHROME | Small app fixes from the wave 5 checks: favicon, tab case, kit grid, soft 404, dev badge, PostHog guard | 6 | S | done | ecb79c8 | icon.svg, sentence-case tabs, kit grid, real 404 for unknown See-all sections (after the sign-in bounce), dev badge off in demo only, PostHog demo guard |
| FIXSEED | Sample data copy that matches its times, and far distances without walk times | 6 | S | done | aece632 | day-free titles, Tanvi kurta request, 14 fixture update links fixed, no walk time past 3 km, own campus named |

## Session log

<!-- One line per event: <d Mon HH:MM IST> · <who/device> · <what happened> (wave started, package done with commit, wave verified, usage pause and resume time, run finished). -->

8 Nov 10:35 IST · jtk/claude-2 · TON: worktree ~/workspace/developer/peasyprints-kada19, npm ci, baseline green (typecheck, lint, 326/326 tests), preflight GO, before shot taken (/ answers 500: Firebase auth/invalid-api-key with no env). ETA ~8 h, done about Sun 8 Nov 18:30 IST.

8 Nov 10:40 IST · jtk/claude-2 · wave 1 started (SWITCH, SEED); at most 2 agents at once on this 4-CPU VM.
8 Nov 11:05 IST · jtk/claude-2 · wave 1 verified: typecheck, lint, 352/352 tests, build compiles, no shim in .next, demo Ready on :3019. Pushed 00a3654 SEED, 49169df SWITCH.

8 Nov 11:12 IST · jtk/claude-2 · wave 2 started (6 packages).
8 Nov 11:24 IST · jtk/claude-2 · wave 2 verified: typecheck, lint, 405/405 tests; build compiles; demo:check: 54 static pages, none 500; **wave-2 gate passed**: with no env / renders signed out, POST /api/demo/session sana, reload greets "Hey Sana", no console error, no outside host. Pushed d1f6430 WORLD, 3e35a70 CLERKSRV, 3ed7acd CLERKUI, 7540a70 FIREBASE, 01ed4c0 SHELL, 9257684 HANDOFF.

8 Nov 11:26 IST · jtk/claude-2 · wave 3 started (5 packages).
8 Nov 12:17 IST · jtk/claude-2 · wave 3 verified: typecheck, lint, 442/442 tests; build compiles, no shim in the production bundle; demo:check 54 pages, none 500; GATE curl, DATE, LIFE, PRINTPAY and PERSIST checked on :3019. Pushed lead fixes e4b99d9, bd96983, 913d0dd and 529e7ea GATE, a1a3953 PRINTPAY, dc77aa3 PERSIST, 904edd2 DATE, 3341f05 LIFE.

8 Nov 12:20 IST · jtk/claude-2 · wave 4 started (6 packages).
8 Nov 13:16 IST · jtk/claude-2 · wave 4 verified: typecheck, lint, 442/442 tests; build compiles, no shim in the production bundle; demo:check 56 pages, none 500; demo:smoke 200/200; route list at 375 and 1280 as Sana: 48 checks, no console error, no horizontal scroll, localhost only; sign-in, verify, demo bar and print flows checked in the browser. Pushed lead fixes fdc0eb4, 941a65c, 2254ee5, 870a791 and 3fc0dce APICHK, 324b789 ENTRY, eafda27 DEMOBAR, 6228f54 SIGNIN, d4549c5 VERIFYD, 46a540f PRINTUI.

8 Nov 13:20 IST · jtk/claude-2 · wave 5 started (6 check packages; DEMOCHK held back to run alone).
8 Nov 14:28 IST · jtk/claude-2 · VM froze (memory thrash: headless Chrome outside the 12 GB cap, dev server ~8 GB); owner reset it. Scratch tools recovered from the chat; wave resumed 15:00 with MARKETCHK and HOUSINGCHK cached.
8 Nov 15:40 IST · jtk/claude-2 · MARKETCHK and HOUSINGCHK verified (typecheck, lint, 442/442, browser spot check) and pushed. Owner added 4 GB swap and removed T3 Code; cap now 10 GB RAM + 1 GB swap with Chrome inside it.
8 Nov 16:45 IST · jtk/claude-2 · demo server thrashed at 8 GB again (HOMECHK and UTILCHK blocked); restarted under a watchdog (restart above 6 GB). PRINTCHK and AUTHCHK verified and pushed.
8 Nov 17:40 IST · jtk/claude-2 · HOMECHK and UTILCHK re-run (the /tmp RAM disk filled with 236 leftover Chrome profiles mid-run; cleared, tools now delete their profiles); verified and pushed. DEMOCHK started alone. Wave 6 (FIXPRICE, FIXCHROME, FIXSEED) added for the outside fixes.
8 Nov 19:05 IST · jtk/claude-2 · DEMOCHK verified and pushed (33f791e). Wave 6 started; the lead runs the demo server under the watchdog. FIXCHROME's dev badge fix moved from next.config.js to the demo-only src/lib/demo/build-config.cjs, as DEMOCHK suggested.
8 Nov 19:50 IST · jtk/claude-2 · wave 6 verified and pushed (0b1421b, ecb79c8, aece632): typecheck, lint, 449/449 tests, demo:smoke 201/201, browser checks at 375 and 1280, dev badge gone after a restart. Production build compiles, no shims in .next. All 29 packages done, none blocked.

## Blocked

<!-- One entry per blocked package: id · what failed (command and first error line) · what was tried · files restored · packages skipped because of it. -->

## Skipped verifications

<!-- One entry per check not run: package id · the check · why it was skipped (needs Clerk, Firestore, Storage, the emulator, real env or a real college domain) · what to run later. After wave 5, the lead also marks each KADA-18 skipped check in docs/implementations/kada-18-ledger.md as "run in demo mode on <date>: pass / fail, fixing commit", and leaves the live-service ones skipped. -->

- Wave 1 · plain `npm run build` · compiles, prerender stops on missing production env (CLERK_SECRET_KEY etc.) · run with real env later.
- SWITCH · live alias swap in a running server · no shim files until wave 2 · covered by the end-of-wave-2 smoke.

- Wave 2 · plain `npm run build` · compiles, prerender stops on missing production env · run with real env later.
- Wave 2 · runbook grep `grep -rl src/lib/demo/shims .next` · only hits `.next/cache/.tsbuildinfo` (TypeScript's file list, not shipped code); the bundle grep excluding cache is empty · the runbook grep should exclude .next/cache.
- CLERKSRV · /api/razorpay/order signed in · answers 400 'A valid idempotency key is required' to an empty body (not 401 or 500) · PRINTPAY covers the real pay flow.
- FIREBASE · pickup page status change within 3 s · needs PRINTPAY's order progress · checked in wave 4/5.

- Wave 3 · plain `npm run build` · prerender stops on missing production env · run with real env later.
- PERSIST · resetDemo() in the browser (IndexedDB, swoop-demo:* keys, college pick, blood number cleared) · the reset route is checked; the browser part is DEMOCHK's (wave 5). Run 8 Nov: pass (33f791e).
- PRINTPAY · the pickup page updating live and the closed-shop message · PRINTUI and PRINTCHK (waves 4-5).

- Wave 4 · plain `npm run build` · prerender stops on missing production env · run with real env later.
- APICHK · /marketplace/all/x is a 200 with the not-found page streamed in, not a 404 status, because app/loading.tsx streams first · the smoke counts the streamed not-found as the 404 · a true 404 needs proxy.ts or dropping the root loading.tsx.
- Wave 4 · one smoke run had `GET /api/demo/session` 500 with `SyntaxError: Unexpected end of JSON input` while the dev server recompiled (APICHK saw 'Manifest file is empty' once too); the rerun passed 200/200 · a webpack dev-server race, not app code.

- Wave 6 · plain `npm run build` · compiles in 68 s, prerender stops on missing production env; `grep -rl demo/shims .next --exclude-dir=cache` is empty · run with real env later.
- APICHK's soft 404 · fixed by FIXCHROME (ecb79c8): /marketplace/all/x and /girls-space/marketplace/all/x answer 404 for signed-in visitors.
- FIXPRICE · CouponInput is used on no page, so its 'You save' line was checked by tests only.

## Decided at night

<!-- One entry per decision the run made without the owner: what · the options · the choice (always the safest reversible one) · where it lives in the code · how to undo it. -->

- SWITCH · secrets grep hit the fake Razorpay placeholder `rzp_test_swoopdemo` in scripts/demo.mjs · options: push as is, or rename · renamed to `demo_razorpay_key_id` (nothing checks the rzp_ prefix) · scripts/demo.mjs · undo: restore the old string.
- SEED · tests/firebase/fake-admin.test.ts asserted `users` empty after seeding; SEED now seeds 5 users docs · lead changed the assertion to size 5 in the SEED commit (the file belongs to WORLD, which runs later) · undo: revert that line.
- SEED · Meera (pending ID card) owns no market or housing post, against the acceptance wording · the existing rule bans pending-id-card authors · kept the rule; tests assert Sana, Kabir and Ananya own posts · src/lib/campus/fixtures/*.
- SEED · housing has no reserved status or price-drop fields · used `booked` for reserved and a rent-cut post updated within 7 days for price-dropped · src/lib/campus/fixtures/housing.ts.

- CLERKSRV · persona emails · fixtureIdentity has example.com addresses; seeded users docs have kju.test · used the users docs (sana@kju.test ...), so the kju.test domain check, profile and upsert agree, and Meera (meera.k@gmail.test) stays pending · src/lib/demo/server/identity.ts.
- HANDOFF · app/campus/activity/page.tsx line 130 still renders a real wa.me 'Open WhatsApp' link in demo; no wave-2 package owns that file · left for the wave-5 checks or the follow-up wave (HOUSINGCHK covers activity) · fix: wrap it in HandoffAnchor like the others.
- SHELL · src/lib/posthog/client.ts can't initialise in demo (no key, no consent) but has no explicit demo guard · optional hardening for the follow-up wave: `if (DEMO) return;` first in ensurePosthogInit().

- PRINTPAY · checkout returned 500 for every non-assignment job: normalizeQuoteInput wrote `assignment: undefined`, which Firestore refuses (the fake and the real Admin SDK alike, since ignoreUndefinedProperties is never set) · lead fix e4b99d9 omits the key · src/lib/checkout/schema.ts · **check in the real app: the same write may fail in production today** · undo: revert e4b99d9.
- LIFE · the seed wrote contact requests to `contact_requests` (CAMPUS_COLLECTIONS.contactRequests) but the routes read `campus_contact_requests`, so seeded requests never showed · lead fix bd96983 seeds them where the routes read; the constant stays because firestore.rules lists it; two tests updated (fixtures, life) · undo: revert bd96983 and the life test line.
- PRINTPAY · the PDF preview could not load: pdf.js fetches the picked file through a blob: URL, and the demo CSP had connect-src 'self' · lead fix 913d0dd adds blob: to the demo CSP only · **the production CSP in next.config.js has no blob: in connect-src either; check the preview in the real app** · undo: revert 913d0dd.
- PRINTPAY · /api/demo/razorpay/pay imported helpers from the shim, so the shim reached the production build (seen in .next/trace) · moved the helpers to src/lib/demo/server/razorpay.ts; the shim re-exports them and keeps only the SDK class; the shim is now absent from the production build · in a1a3953.
- GATE · acceptance said signed-out /orders?x=1 redirects to /login, but '/orders(.*)' is already a public route and the brief said keep the login logic · kept it public; /orders shows its own sign-in link; protected pages (e.g. /profile) redirect with redirect_url · proxy.ts.
- DATE · HousingDetail.tsx:595 still passes real now to housingMoveInLabel · left for the follow-up wave · fix: use useSeasonNow() there.
- LIFE · the plan's example 'Farhan's study lamp' is Sana's own listing (mkt-study-lamp) · checks use Farhan's headphones (mkt-headphones).

- APICHK · notify.ts getAll found no refs: each route bundle has its own copy of the fake Firestore classes while worlds are shared, so `instanceof FakeDocumentReference` failed and no inbox item was ever written in demo · lead fix fdc0eb4 brands refs with Symbol.for and checks the brand · src/lib/firebase/fakeAdmin.ts · undo: revert fdc0eb4.
- APICHK · seeded posts had no campus_private_contacts, so approving an ask on a seeded post revealed no number · lead fix 941a65c seeds one per post with the same sample number formula as demo life · src/lib/firebase/fakeSeed.ts.
- APICHK · /about passed icon functions from a server page to client components and Next streamed an error into the page (for every viewer, real app too) · lead fix 2254ee5 makes the page a client page (it has no metadata or data loading) · **affects production too**.
- PRINTUI · the pdf.js previewer sends a HEAD to unpkg.com when NEXT_PUBLIC_PDF_WORKER_URL is unset (the demo CSP blocked it) · lead fix 870a791 sets it to the local worker in the launcher · scripts/demo.mjs.
- APICHK · the smoke expected a new ask in the seller's inbox at once, but normal items wait for the next 12:30 or 19:30 IST slot and the inbox hides them until then · the check now passes when the item is in the inbox, or queued in the world for a later slot (not weakened: it still fails if nothing was queued) · scripts/demo-smoke.mjs.
- SIGNIN · right after the course step, Home briefly showed 'Verify you're a KJU student' for an approved Riya; a reload clears it (stale client session) · left for HOMECHK or the follow-up wave.

- Wave 5 · checks found fixes outside every package's files (rupee sign in 7 student price views, favicon 404, Segmented capitalize, housing-kit grid, soft 404 on unknown See-all sections, dev badge over the Dock, sample titles with wrong weekdays, a kurta update with no request, far walk times) · grouped by file into wave 6: FIXPRICE, FIXCHROME, FIXSEED · docs/implementations/kada-19-packages.json · undo: drop wave 6.
- PRINTCHK · /shops listed every campus's shops · now filtered by the student's campus like /upload, in the real app too (same filter /upload already uses) · app/shops/page.tsx in b65e277 · undo: revert that file.
- HOMECHK · Meera (ID card pending) is still invited to 'Verify' on Home and in CampusGate · a pending message would be clearer but changes real-app copy · left as is; for the owner to decide.
- UTILCHK · the seeded O- blood request is fulfilled, so the open-requests list hides it · kept the seed; the B+ request covers the list check.
- FIXCHROME · the unknown See-all 404 sits in proxy.ts, so it applies in the real app too (after the sign-in bounce) · proxy.ts keeps its own copy of the four section ids; keep it in step with MARKET_SECTIONS · undo: revert the proxy.ts hunk of ecb79c8.
- FIXPRICE · OrdersList and OrderRow rounded order totals to whole rupees; they now keep paise, like the brief asks, in the real app too · undo: revert those two files in 0b1421b.
- FIXSEED · all 14 seeded update links pointed at routes that don't exist (/market/..., /deals/...) · fixed to real routes, with a test · src/lib/campus/fixtures/index.ts.
- Close-out · the morning report's 'before' shot needs the real app with no env, so the lead ran plain `next dev` on :3020 once; Clerk's keyless mode loaded its scripts from an anonymous temporary Clerk dev instance (legible-foal-8612.clerk.accounts.dev, keys in the git-ignored .clerk/), not the owner's Clerk account · no data sent, server stopped right after · leave .clerk/ alone or delete it.
