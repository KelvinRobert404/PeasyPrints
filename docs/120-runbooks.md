### Purpose
Incident response playbooks.

### At a glance
- Common failure modes and step-by-step checklists.

### Set admin claim for godview (production)
Prereq: FIREBASE_ADMIN_* env configured locally.

Steps:
1. Create `scripts/set-admin-claim.js` with Admin SDK (see snippet below).
2. Run: `node scripts/set-admin-claim.js <UID>`
3. Ask user to sign out/in.

Snippet:
```js
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
async function main(uid){
  await admin.auth().setCustomUserClaims(uid, { admin: true, role: 'super_admin', roles: ['SUPER_ADMIN'] });
  await admin.auth().revokeRefreshTokens(uid);
  console.log('Admin claim set for', uid);
}
main(process.argv[2]).catch(e => { console.error(e); process.exit(1); });
```

### Enable godview passphrase mode (development)
1. Set `NEXT_PUBLIC_MASTER_GODVIEW=true`
2. Optionally set `NEXT_PUBLIC_GODVIEW_PASSPHRASE=...`
3. Visit `/godview`, enter passphrase

### 500 on /api/godview/snapshot
- Ensure `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` are set
- On Windows, ensure `\n` newlines in the private key
- Restart dev server after adding envs

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


