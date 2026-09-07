# PeasyPrints production runbook

## Release gate

1. Run `npm ci`, `npm audit --omit=dev`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` from a clean checkout.
2. Run `npm run test:rules` through the Firestore and Storage emulators. Deploy rules and indexes before application code.
3. Build the Windows helper in Release mode and test a one-time print ticket against staging.
4. Verify Razorpay uses live-mode keys, automatic capture, and a webhook for `payment.captured`, `payment.failed`, and `order.paid` pointing to `/api/razorpay/webhook`.
5. Run a ₹1 staging/live smoke order: quote, pay, finalize, print, complete, payout reservation, and admin settlement.

## Required operations

- Call `/api/internal/campus-maintenance` at least hourly with `Authorization: Bearer $CRON_SECRET`. Alert on non-2xx responses and on a nonzero `reconciliationFlags` result.
- Probe `/api/health`; page the operator after three consecutive 503 responses.
- Review payment records with `reconciliationRequired=true` before issuing a refund or manually creating an order. Cross-check the Razorpay order, captured amount, currency, user, and uploaded files.
- Review queued `account_deletion_requests`. Complete active orders first, remove private user content, anonymize retained financial records, delete Firebase and Clerk identities, then mark the request completed with an audit timestamp.
- Rotate worker, cron, webhook, Firebase, Clerk, and Razorpay credentials after suspected exposure. Never place server secrets in `NEXT_PUBLIC_*` variables.

## Retention and recovery

- Print documents are deleted seven days after completion or cancellation. Verification cards, one-time tickets, and rate-limit buckets are removed by maintenance.
- Enable Firestore point-in-time recovery and scheduled Storage/Firestore backups in the production project. Test a restore into a separate project before launch and quarterly thereafter.
- Roll back application deployments through the hosting provider, but do not roll back payment/order data. Use compensating transactions and preserve provider references.

## Incident checklist

1. Disable new checkout if payment verification or order finalization is failing.
2. Preserve request IDs, webhook event IDs, Razorpay references, and affected order IDs.
3. Reconcile captured payments against orders before re-enabling checkout.
4. Notify affected users without exposing document names, payment secrets, or signed URLs.
