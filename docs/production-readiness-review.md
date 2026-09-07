# Production readiness review

Reviewed on 31 August 2026 on branch `codex/dev-production-readiness`.

## Top ten findings and changes

| Priority | Production risk | Resolution on this branch |
| --- | --- | --- |
| 1 | A browser-provided amount could diverge from the shop price and order | Checkout is strictly validated and quoted on the server; payment intent, provider amount, currency, user, shop, and finalized order are bound together. |
| 2 | Order completion and payouts changed separate client-side ledgers | Fulfilment, receivables, payout reservation, settlement, cancellation, and retries now use server-side Firestore transactions and explicit lifecycle rules. |
| 3 | Vulnerable/outdated web dependencies | Clerk, Next, Firebase, Firebase Admin, PostHog, and build tooling were upgraded and pinned; npm audit reports zero vulnerabilities. |
| 4 | Print documents and job URLs could remain publicly reusable | Uploads are private, file paths are owner-checked, downloads use short-lived signed URLs, helper tickets are hashed/one-time/two-minute, and legacy public-token backfills return 410. |
| 5 | Admin access relied on client-visible email lists | Admin membership is server-only, Firebase tokens carry a server-minted admin claim, Godview APIs verify it, and rules enforce it. |
| 6 | Environment mistakes reached runtime | Production startup validates all required variables, matching Razorpay IDs, HTTPS origins, secret length, admin email format, and Firebase PEM format. |
| 7 | Mutations and uploads lacked consistent abuse controls | Distributed rate limits, same-origin/fetch-metadata checks, constant-time worker secrets, strict schemas, size limits, and file-signature validation are applied at trust boundaries. |
| 8 | No reliable release gate | CI now runs clean install, audit, strict typecheck, lint, tests, Firebase rule compilation, production build, and Windows helper build. |
| 9 | Limited recovery and payment reconciliation | A readiness endpoint, error boundaries, hourly maintenance, captured-payment reconciliation flags, deterministic webhook deduplication, and an operations/recovery runbook were added. |
| 10 | Privacy, retention, accessibility, and PWA gaps | Analytics is opt-in, privacy/terms/settings and deletion requests exist, print/verification/ephemeral retention is enforced, browser zoom works, responsive overflow is fixed, and install icons/manifest are valid. |

## Verification completed

- `npm run typecheck`, `npm run lint`, all 9 tests, and a production build covering 75 routes pass.
- All 5 Firestore/Storage authorization tests pass against Firebase emulators, including financial-field isolation, owner scoping, admin claims, server-only orders, and private Storage paths.
- `npm audit` reports zero vulnerabilities.
- The Windows helper builds on .NET 8 with zero warnings/errors; NuGet reports no vulnerable packages.
- Browser smoke tests passed at 320, 390, 768, and 1280 px with no horizontal overflow or console errors. Analytics assets remained absent after choosing essential-only.
- HTTP probes confirmed CSP/HSTS, cross-site mutation rejection, and JSON 401 responses for private APIs.
- `git diff --check` reports no whitespace errors.

## Deployment gates

1. Replace the placeholder local Firebase Admin private key and supply every variable in `.env.example` with production values.
2. Deploy `firestore.rules`, `storage.rules`, and `firestore.indexes.json` before application code. The current Firebase project is missing the announcements composite index already described in the index file.
3. Require CI’s Firebase emulator authorization suite to pass before each rules deployment.
4. Configure Razorpay live keys, automatic capture, webhook events/secrets, then run and reconcile a ₹1 end-to-end smoke order.
5. Install the Release helper on a clean Windows machine and print a real black-and-white and split-color job.
6. Enable and test Firestore point-in-time recovery and backups, configure health/maintenance alerting, and process the queued deletion workflow described in the runbook.
