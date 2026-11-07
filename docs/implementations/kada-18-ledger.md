# KADA-18 ledger

This ledger tracks the KADA-18 Nightly run. The run implements the owner's 7 Nov redesign decisions. The plan is in `docs/implementations/kada-18-redesign.md`, the agent briefs are in `docs/implementations/kada-18-packages.json`, and the runbook is `docs/implementations/kada-18-redesign-nightly.md`. Branch: `kada-18/implement-redesign`, base `dev`.

Statuses: `pending`, `building`, `verifying`, `done` (verified, committed and pushed), `blocked` (failed twice, or broke the build after one fix pass; the package's files are restored), `skipped` (a package it depends on is blocked).

## Claim

No claim. The run is planned and ready for anyone to start. The chat that starts the run posts `**Working:**` on KADA-18 in Linear and repeats that line here.

## Packages

| Package | Title | Wave | Size | Status | Commit | Notes |
|---|---|---|---|---|---|---|
| TYP | Types and shared constants | 1 | M | pending |  |  |
| CAT | College, campus and course catalog | 1 | L | pending |  |  |
| FMT | Price and distance helpers | 1 | M | pending |  |  |
| RUL | Season, lifecycle and notification-slot rules | 1 | M | pending |  |  |
| FIX | Offline fixture mode (fake Admin DB and bucket, proxy bypass) | 1 | L | pending |  |  |
| ICO | Shared icon additions | 1 | M | pending |  |  |
| ART | Swoop illustration series, room art and pickup kitten swap | 1 | L | pending |  |  |
| COPY | Copy pass: sentence-case tags, no ALL CAPS, no food leftovers | 1 | M | pending |  |  |
| MEM | Membership server: multi-college principal, onboarding, session, config | 2 | L | pending |  |  |
| GVC | Godview campus config for all colleges and trust-queue columns | 2 | L | pending |  |  |
| SEED | Fixture data for every section and utility | 2 | L | pending |  |  |
| SRCH | Campus search: aliases, places, price phrases, one-tap ask | 2 | M | pending |  |  |
| MSCH | Market schema, constants and feed grouping | 2 | L | pending |  |  |
| HMOD | Housing model, schema and WhatsApp paste parser | 2 | L | pending |  |  |
| STORE | Pre-sign-in choice store, college picker and stay step | 2 | M | pending |  |  |
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

## Blocked

<!-- One entry per blocked package: id · what failed (command and first error line) · what was tried · files restored · packages skipped because of it. -->

## Skipped verifications

<!-- One entry per check not run tonight: package id · the check · why it was skipped (needs Clerk / Firebase / Storage / emulator / Godview admin gate) · what to run in the morning. -->

## Decided at night

<!-- One entry per decision the run made without the owner: what · the options · the choice (always the safest reversible one) · where it lives in the code · how to undo it. -->
