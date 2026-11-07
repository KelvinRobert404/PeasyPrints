# Swoop campus operations

Swoop runs one college catalog for every campus. KJU is live first; the other
colleges sit on the waitlist until their email domains are confirmed. This
page covers deployment config, per-college setup in Godview, the owner's Clerk
dashboard steps and the release checks.

## Required deployment configuration

- Set `VIDEO_WORKER_TOKEN` to the same long random value in PeasyPrints and `peasy-comotion`.
- Set `CRON_SECRET` for the hourly maintenance route. The included Vercel schedule runs at minute 15 each hour.
- Set `CAMPUS_ACCOUNT_HOOK_TOKEN` and invoke `DELETE /api/internal/campus-users/{clerkUserId}` from the verified Clerk `user.deleted` webhook handler. This immediately removes retained iCards and private campus profile data.
- Deploy `firestore.rules`, `firestore.indexes.json`, and `storage.rules` before enabling either campus product.
- Run the compositor from `C:\Developer\peasy-comotion` with `pnpm worker` when a Godview posting pack is queued.

## Per-college setup (Godview → Campus Trust → College config)

The static catalog (`src/lib/campus/catalog.ts`) holds every college, campus,
origin, pickup point and landmark. Godview saves overrides to
`college_configs/{collegeId}`; arrays you save replace the catalog value.
Nothing is backfilled: a college with no saved config uses the catalog.

For each college:

1. Pick the college in the **College** select. Save or drop changes before switching.
2. **Student email domains**: one per line, e.g. `kristujayanti.com`. Subdomains count, so `student.kristujayanti.com` needs no extra line. Domains are stored lowercase, without a leading `@`.
3. **Launch state**: keep **Waitlist** until the domains are confirmed and pickup points are agreed. Switch to **Live** to open sign-up.
4. **Marketplace on / Housing on**: turn a product off to hide it for that college without changing the launch state.
5. Per campus:
   - **Campus origin**: lat and lng of the main gate. Distances such as "650 m from KJU, 8 min walk" are measured from here. Catalog origins marked "(estimate)" should be replaced with a checked point.
   - **Safe pickup points**: one per line. Existing ids are kept when a line stays the same; new lines get a fresh id.
   - **Landmarks**: name, area, lat, lng and comma-separated aliases (lowercase misspellings students type). Use the trash button to remove a row and the plus row to add one. Posters pick from these; viewers only see the label, area and rough distance.
6. **Save**. The editor checks the same schema as the server (`src/lib/campus/collegeConfigSchema.ts`) and names the first bad field.
7. Check the serial chips under the toggles (`KJU-M`, `KJU-H`, and so on). Each college has 10,000 serials per product; Godview warns at 80%.

The review queue and membership list take a college filter at the top of the
page. Both show the campus label, verification method and course. Approving an
iCard copies the request's campus to the membership, so the student is never
asked again.

## Clerk dashboard steps (owner)

Done once in the Clerk dashboard for the production instance. Swoop does not
change these from code.

1. **User & authentication → Social connections → Google**: turn on and choose **Use custom credentials**. Paste Swoop's own Google OAuth client id and secret (Google Cloud console, OAuth consent screen named Swoop). Add the Clerk redirect URI shown on that page to the Google client.
2. **User & authentication → Email**: turn on **Email address** as an identifier, turn on **Verify at sign-up**, and choose **Email verification code**. Turn off email links.
3. **Username**: off.
4. **Phone number**: off.
5. **Password**: off. Students sign in with Google or an email code only.
6. **Email address → Allow users to add multiple email addresses**: on. A student can keep a personal Gmail and add the college inbox to verify.
7. Keep the `user.deleted` webhook pointed at the account deletion hook above.

## Release verification matrix

1. Attempt Marketplace and Housing browse/API calls signed out, with an unverified membership, with a membership from a waitlist college, and after revocation. Each must return no records.
2. Create a Girls’ Space record and verify it is absent from campus feeds, saved-item payloads without entitlement, ordinary shares, render selection, render snapshots, media access without entitlement, and public metadata.
3. Run concurrent Firestore-emulator creates until collision retries occur. Assert each reservation and content document has one immutable `{CODE}-M####` or `{CODE}-H####`, including leading-zero cases. Confirm deleted content does not release its reservation.
4. Exercise email verification and both iCard queues; view a card and confirm an audit entry is written. Approve, renew, revoke, run maintenance after expiry, and invoke account deletion. Confirm the private file is removed in every terminal path, and the membership carries the request's campus after approval.
5. Advance availability beyond seven days. Confirm the 24-hour warning, feed/search/contact/render exclusion at expiry, `needs_confirmation` status after maintenance, and one-tap reactivation.
6. Submit a contact request. Confirm no number is present before approval, only its buyer receives the WhatsApp URL afterward, unanswered requests expire at 72 hours, and sold/filled/closed/expired content invalidates access.
7. Seed identical timestamps across two campuses. Confirm the student's own campus is first, followed by the explicit other-campus section, with serial/UUID tie-breaking stable between requests.
8. Call every Godview campus endpoint as a non-admin Clerk session and confirm server-side 403 responses.
9. In Godview, switch colleges, add and remove a landmark, save, reload, and confirm the change stuck for that college only.
10. Queue identical Marketplace and Housing snapshots twice. Confirm deterministic durations and frames, silent MP4 output, and all six posting-pack artifacts: MP4, cover, caption, manifest, deep links, and ZIP.
11. Test 320px, 390px, 768px and desktop widths with keyboard-only operation, a screen reader, 200% text zoom, reduced motion, slow network throttling, expired posts and empty campus inventory.
