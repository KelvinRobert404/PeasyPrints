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

## Packages

| ID | Title | Wave | Size | Status | Commit | Notes |
|---|---|---|---|---|---|---|
| SWITCH | Demo switch, shared contract, launcher and alias wiring | 1 | M | pending | | |
| SEED | Sample world: every surface full on both campuses, print orders and users | 1 | L | pending | | |
| WORLD | One fake world per visitor: Admin DB, bucket, change log and hooks | 2 | L | pending | | |
| CLERKSRV | Clerk server stand-in, demo identity and the session API | 2 | L | pending | | |
| CLERKUI | Clerk client stand-in, avatar menu and the demo account chooser | 2 | L | pending | | |
| FIREBASE | Firebase client stand-ins backed by the visitor's world | 2 | L | pending | | |
| SHELL | Demo shell: no analytics or outside calls, and the DemoRoot mount | 2 | S | pending | | |
| HANDOFF | Demo hand-off sheet instead of WhatsApp, phone and mail links | 2 | S | pending | | |
| GATE | Demo proxy: visitor cookie, first visit, sign-in guard, areas kept out | 3 | M | pending | | |
| PERSIST | Visitor changes kept in the browser, and Reset demo | 3 | L | pending | | |
| DATE | Demo date and seasonal sample packs | 3 | M | pending | | |
| PRINTPAY | Simulated payment and order progress | 3 | L | pending | | |
| LIFE | Demo life: sample students answer | 3 | M | pending | | |
| ENTRY | Demo start page and the not-in-demo page | 4 | M | pending | | |
| DEMOBAR | Demo bar: student, demo date and Reset demo | 4 | M | pending | | |
| SIGNIN | Simulated sign-in on /login: mocked Google, skip in, email code | 4 | M | pending | | |
| VERIFYD | /campus/verify in demo: add college email and approve ID card | 4 | S | pending | | |
| PRINTUI | Print screens on sample data: Home order, sample PDF, hand-over | 4 | M | pending | | |
| APICHK | Demo smoke script, the KADA-18 data checks and the API fixes | 4 | L | pending | | |
| HOMECHK | KADA-18 checks in demo: Home, header, gate, dock and profile | 5 | M | pending | | |
| AUTHCHK | KADA-18 checks in demo: sign-in, verify and session | 5 | M | pending | | |
| MARKETCHK | KADA-18 checks in demo: Market feed, See all, details, forms and kits | 5 | L | pending | | |
| HOUSINGCHK | KADA-18 checks in demo: Housing, Girls' space, activity and My posts | 5 | L | pending | | |
| UTILCHK | KADA-18 checks in demo: deals, lost and found, blood, games, privacy | 5 | M | pending | | |
| PRINTCHK | KADA-18 checks in demo: print flow, orders, pickup art and campus shops | 5 | M | pending | | |
| DEMOCHK | Demo checks end to end: persistence, reset, isolation, dates and the bar | 5 | M | pending | | |

## Session log

<!-- One line per event: <d Mon HH:MM IST> · <who/device> · <what happened> (wave started, package done with commit, wave verified, usage pause and resume time, run finished). -->

## Blocked

<!-- One entry per blocked package: id · what failed (command and first error line) · what was tried · files restored · packages skipped because of it. -->

## Skipped verifications

<!-- One entry per check not run: package id · the check · why it was skipped (needs Clerk, Firestore, Storage, the emulator, real env or a real college domain) · what to run later. After wave 5, the lead also marks each KADA-18 skipped check in docs/implementations/kada-18-ledger.md as "run in demo mode on <date>: pass / fail, fixing commit", and leaves the live-service ones skipped. -->

## Decided at night

<!-- One entry per decision the run made without the owner: what · the options · the choice (always the safest reversible one) · where it lives in the code · how to undo it. -->
