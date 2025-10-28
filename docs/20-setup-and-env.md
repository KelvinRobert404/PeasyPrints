### Purpose
End-to-end local setup and environment configuration for engineers.

### At a glance
- Configure Clerk, Firebase (client + Admin), Razorpay.
- Provide `.env.local` and deployment guidance.

### Prerequisites
- Node 18+
- Firebase project with Firestore + Storage
- Clerk application
- Razorpay account (test keys)
- Vercel or similar hosting

### Environment matrix

#### Client variables (public)
| Key | Description | Example |
| --- | --- | --- |
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase web API key | abc... |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Auth domain | your-project.firebaseapp.com |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Project ID | your-project |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Storage bucket | your-project.appspot.com |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Sender ID | 123456 |
| NEXT_PUBLIC_FIREBASE_APP_ID | Web app ID | 1:...:web:... |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk publishable key | pk_test_... |
| NEXT_PUBLIC_RAZORPAY_KEY_ID | Razorpay key ID (public) | rzp_test_... |
| NEXT_PUBLIC_MASTER_GODVIEW | Enable godview UI | true/false |
| NEXT_PUBLIC_GODVIEW_PASSPHRASE | Dev-only passphrase for godview | swoopistheking |

#### Server secrets
| Key | Description |
| --- | --- |
| CLERK_SECRET_KEY | Clerk secret key |
| FIREBASE_ADMIN_PROJECT_ID | GCP project ID |
| FIREBASE_ADMIN_CLIENT_EMAIL | Service account client email |
| FIREBASE_ADMIN_PRIVATE_KEY | Private key (escaped newlines `\n`) |
| RAZORPAY_KEY_ID | Server copy of key id (optional) |
| RAZORPAY_KEY_SECRET | Razorpay secret (server only) |

### Example `.env.local`
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Godview feature + optional passphrase-only mode (dev)
NEXT_PUBLIC_MASTER_GODVIEW=true
NEXT_PUBLIC_GODVIEW_PASSPHRASE=swoopistheking

FIREBASE_ADMIN_PROJECT_ID=your-project
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Local steps
1. Create Firebase project; enable Auth, Firestore, Storage.
2. Create service account; download JSON; map into env vars.
3. Set Firestore/Storage rules (see docs/40-security-and-auth.md).
4. Create Clerk application; configure dev origins.
5. Create Razorpay test keys.
6. Install deps and run:
```bash
npm i
npm run dev
```

7. Godview (development convenience)
- Ensure `NEXT_PUBLIC_MASTER_GODVIEW=true` and optionally set `NEXT_PUBLIC_GODVIEW_PASSPHRASE`
- Visit `/godview`, enter the passphrase, data is served via `/api/godview/snapshot`
- For production, use admin custom claims instead of passphrase

### Vercel deployment notes
- Set the same env keys in project settings.
- For `FIREBASE_ADMIN_PRIVATE_KEY`, use multiline secret with `\n` escapes.
- Use Node runtime for upload/verify endpoints.

### Admin claims (production)
To allow an operator access to `/godview` without passphrase, set a custom claim on their Firebase user:

```js
// one-off script using Admin SDK
await admin.auth().setCustomUserClaims('<UID>', { admin: true, role: 'super_admin', roles: ['SUPER_ADMIN'] });
await admin.auth().revokeRefreshTokens('<UID>');
```
Have the user sign out/in to refresh their token. See docs/120-runbooks.md for a ready script.

### Timezone & timestamps
- Use Firestore `serverTimestamp()` for all created/updated fields.
- Display in local user timezone; store ISO-8601 for logs.
- Consider 5-minute clock skew tolerance in verification processes.

### TODO
- Add staging environment matrix and service accounts with least privilege.


