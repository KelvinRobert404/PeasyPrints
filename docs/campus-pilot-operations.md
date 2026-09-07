# KJU campus pilot operations

## Required deployment configuration

- Set `VIDEO_WORKER_TOKEN` to the same long random value in PeasyPrints and `peasy-comotion`.
- Set `CRON_SECRET` for the hourly maintenance route. The included Vercel schedule runs at minute 15 each hour.
- Set `CAMPUS_ACCOUNT_HOOK_TOKEN` and invoke `DELETE /api/internal/campus-users/{clerkUserId}` from the verified Clerk `user.deleted` webhook handler. This immediately removes retained iCards and private campus profile data.
- Deploy `firestore.rules`, `firestore.indexes.json`, and `storage.rules` before enabling either campus product.
- In Godview → Campus Trust, configure KJU email domains and safe pickup points, then enable Marketplace and Housing.
- Run the compositor from `C:\Developer\peasy-comotion` with `pnpm worker` when a Godview posting pack is queued.

## Release verification matrix

1. Attempt Marketplace and Housing browse/API calls signed out, with an unverified membership, with a non-KJU membership, and after revocation. Each must return no records.
2. Create a Girls’ Space record and verify it is absent from campus feeds, saved-item payloads without entitlement, ordinary shares, render selection, render snapshots, media access without entitlement, and public metadata.
3. Run concurrent Firestore-emulator creates until collision retries occur. Assert each reservation and content document has one immutable `KJU-M####` or `KJU-H####`, including leading-zero cases. Confirm deleted content does not release its reservation.
4. Exercise email verification and both iCard queues; view a card and confirm an audit entry is written. Approve, renew, revoke, run maintenance after expiry, and invoke account deletion. Confirm the private file is removed in every terminal path.
5. Advance availability beyond seven days. Confirm the 24-hour warning, feed/search/contact/render exclusion at expiry, `needs_confirmation` status after maintenance, and one-tap reactivation.
6. Submit a contact request. Confirm no number is present before approval, only its buyer receives the WhatsApp URL afterward, unanswered requests expire at 72 hours, and sold/filled/closed/expired content invalidates access.
7. Seed identical timestamps across KJU and a second enabled campus. Confirm KJU is first, followed by the explicit other-campus section, with serial/UUID tie-breaking stable between requests.
8. Call every Godview campus endpoint as a non-admin Clerk session and confirm server-side 403 responses.
9. Queue identical Marketplace and Housing snapshots twice. Confirm deterministic durations and frames, silent MP4 output, and all six posting-pack artifacts: MP4, cover, caption, manifest, deep links, and ZIP.
10. Test 320px, 390px, 768px and desktop widths with keyboard-only operation, a screen reader, 200% text zoom, reduced motion, slow network throttling, expired posts and empty KJU inventory.
