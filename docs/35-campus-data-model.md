### Purpose
Every Firestore collection the Swoop campus app uses: what is in it, who writes
it, and how long it lives. Print-shop collections (shops, orders, history,
payouts) are in [30-data-models.md](./30-data-models.md).

### Ground rules
- All campus collections are server-only. Clients never read or write them;
  `firestore.rules` denies every name below, and routes use Firebase Admin after
  checking the Clerk session and campus membership.
- Use `CAMPUS_COLLECTIONS` (`src/lib/campus/constants.ts`) for names in code.
- Field types live in `src/types/` (`campus.ts`, `market.ts`, `housing.ts`,
  `utilities.ts`, `notifications.ts`). Dates are Firestore Timestamps.
- Not launched: the model may change freely, with no backfill.
- Composite indexes are in `firestore.indexes.json`. Never deploy from a branch.

### Collection names: constant vs routes
`CAMPUS_COLLECTIONS` and the routes that exist today do not agree yet. Until one
set wins, rules deny both and indexes cover the names queries use.

| Data | `CAMPUS_COLLECTIONS` | Routes and plan today |
| --- | --- | --- |
| Market listings | `market_listings` | `marketplace_listings` |
| Housing posts | `housing_listings` | `housing_posts` |
| Contact requests | `contact_requests` | `campus_contact_requests` |
| Reports | `campus_reports` | `campus_content_reports` |
| Deals | `campus_deals` | `student_deals` |
| Lost and found | `lost_found` | `lost_found_items` |
| Pickup games | `campus_games` | `pickup_games` |
| Inbox | `notifications` | `campus_notifications` |

`src/lib/campus/notify.ts` and `/api/campus/notifications` use
`CAMPUS_COLLECTIONS.notifications`, so the inbox follows the constant.

### Membership and config

| Collection | Doc id | Key fields | Writer | Retention |
| --- | --- | --- | --- | --- |
| `college_configs` | collegeId | flags, launchState, campuses, overrides | Godview config API | Kept |
| `campus_memberships` | userId | collegeId, campusId, displayName, stay, course, studentVerification, girlsSpaceVerification, blocked | Onboarding, verification, Godview | Until account purge |
| `campus_verification_requests` | auto | userId, kind, status, method, card path | Verification API, Godview review | Purged with the user; card image dropped on expiry |
| `campus_verification_locks` | `{userId}_{kind}` | lock for one open request | Verification API | Purged with the user |
| `campus_private_profiles` | userId | private profile fields | Server routes | Purged with the user |
| `campus_private_contacts` | auto | authorId, phone or WhatsApp | Post create routes | Purged with the user |
| `campus_admin_audit` | auto | adminId, action, target, at | Godview APIs | Kept |

### Posts

| Collection | Doc id | Key fields | Writer | Retention |
| --- | --- | --- | --- | --- |
| Market listings | auto | authorId, serial, collegeId, campusId, audience, kind, category, status, title, price, priceTerms, previousPrice, images, place, reservedBy, reservedUntil, createdAt, availabilityExpiresAt | Market routes, maintenance cron | Expired after the availability window; removed with the author |
| Housing posts | auto | authorId, serial, collegeId, campusId, audience, postedAs, stayType, status, rentPp, deposit, bedsLeft, whoCanStay, houseRules, images, place, createdAt, availabilityExpiresAt | Housing routes, maintenance cron | Same as market |
| Deals | auto | collegeId or campusId, category, status, merchantName, title, offer, code, validUntil, createdBy | Admin only | Hidden after validUntil |
| Lost and found | auto | authorId, campusId, kind, category, status, title, place, happenedAt, createdAt | Lost and found routes | Closed items hidden; removed with the author |
| `blood_requests` | auto | authorId, campusId, bloodGroup, units, urgency, status, hospital, neededBy | Blood routes | Closed after neededBy |
| `blood_donors` | userId | collegeId or campusId, bloodGroup, opted in or available, lastDonatedAt | The donor | Deleted on opt-out or purge |
| Pickup games | auto | authorId, campusId, sport, level, status, startsAt, playersNeeded, playerIds | Games routes | Done after startsAt; user removed from playerIds on purge |
| `campus_media` | auto | ownerId, collegeId, audience, path, contentType | Upload API | Unused drafts cleaned up; removed with the owner |
| `campus_serial_reservations` | serial | collegeCode, product, contentId | Post create (transaction) | Kept so serials never repeat |
| `campus_serial_metrics` | `{code}-{M or H}` | reserved, capacity | Post create (transaction) | Kept |
| `campus_render_packs` | auto | content ref, status, artifacts | Godview, render worker | Lease reset by cron |

### Activity

| Collection | Doc id | Key fields | Writer | Retention |
| --- | --- | --- | --- | --- |
| Contact requests | auto | contentType, contentId, serial, buyerId, sellerId, status, expiresAt | Contact routes, maintenance cron | Expire after 72 hours pending |
| `campus_saves` | `{userId}_{contentType}_{contentId}` | userId, contentType, contentId, createdAt | Save action | Deleted on unsave or purge |
| Reports | `{reporterId}_{contentType}_{contentId}` | reporterId, contentType, contentId, serial, reason, status | Report action, Godview | Kept for moderation |
| Inbox (`notifications`) | dedupe key | userId, campusId, kind, title, body, href, ref, actorDisplayName, read, readAt, createdAt, deliverAfter, urgent | `notify.ts` only; inbox PATCH sets read | Purged with the user; old read items can be cleared by cron |
| `notification_prefs` | userId | push, kinds (per-kind switch, missing means on) | Settings route | Purged with the user |

### Inbox queue
- `enqueue(userIds, payload)` writes one doc per user. The id is
  `dedupeKey({ userId, type: kind, targetId: 'refType/refId', slot })` from
  `notifySlots.ts`, so a repeat for the same slot is skipped (`create` only).
- `deliverAfter` is `nextSlot(now)`: 12:30 or 19:30 IST, never in quiet hours.
  Urgent items go out now, or at 07:00 IST during quiet hours.
- Users who set `kinds[kind] = false` in `notification_prefs` are skipped.
- Titles are clamped to 9 words. No push is sent.
- `notifySavers(contentType, contentId, kind, payload)` reads `campus_saves`
  and skips the post's owner.
- `GET /api/campus/notifications`: the viewer's due items, newest first,
  at most 50. An item is due when `deliverAfter <= now`; items without
  `deliverAfter` (seeded fixtures) are due from `createdAt`. The route scans
  the viewer's newest 200 by `createdAt` (index: userId asc, createdAt desc)
  and filters in memory. `PATCH { ids }` marks the viewer's own items read.
