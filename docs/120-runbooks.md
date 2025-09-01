### Purpose
Incident response playbooks.

### At a glance
- Common failure modes and step-by-step checklists.

### Payment captured but order not created
- Check payment verification logs for `payment_id`.
- Confirm payment ledger (TODO) includes `payment_id`.
- If verify passed:
  - Search client logs for createOrder failure.
  - Manually create `orders` doc with exact fields; notify Shopfront.
- Prevent recurrence: migrate to server-created orders on verify.

### Webhook/verify signature mismatch
- Validate `RAZORPAY_KEY_SECRET` in env.
- Compute local HMAC for sample payload; compare.
- Check for whitespace/encoding issues.
- Replay? Ensure ledger denies duplicates.

### Storage write failures
- Check Admin credentials; verify Storage bucket env.
- Size/type limits: reject non-PDF or too large files.
- Fallback path logs (client SDK) and browser errors.

### Shopfront not receiving live updates
- Firestore indexes present?
- Security rules blocking read?
- Network tab: `listen` requests status?
- Check onSnapshot unsub/resubscribe patterns.

### Communications template
- Provide incident summary, impact, timeline, and recovery steps to stakeholders.


