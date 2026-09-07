export function assertRequiredEnvInProd() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'NEXT_PUBLIC_RAZORPAY_KEY_ID',
    'ADMIN_EMAILS',
    'CRON_SECRET',
    'VIDEO_WORKER_TOKEN',
    'CAMPUS_ACCOUNT_HOOK_TOKEN',
    'NEXT_PUBLIC_ALLOWED_ORIGINS',
    // PostHog server key is optional; if provided we also expect host optionally
    // 'POSTHOG_API_KEY' is optional, do not enforce here
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];

  const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
  if (missing.length > 0) {
    // Fail fast with clear message; do not leak secrets
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }

  if (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID !== process.env.RAZORPAY_KEY_ID) {
    throw new Error('NEXT_PUBLIC_RAZORPAY_KEY_ID must match RAZORPAY_KEY_ID');
  }
  const adminPrivateKey = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY).replace(/\\n/g, '\n');
  if (!adminPrivateKey.includes('-----BEGIN PRIVATE KEY-----') || !adminPrivateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY must be a PEM-encoded private key');
  }
  for (const key of ['RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'CRON_SECRET', 'VIDEO_WORKER_TOKEN', 'CAMPUS_ACCOUNT_HOOK_TOKEN']) {
    if (String(process.env[key]).length < 24) throw new Error(`${key} must be at least 24 characters`);
  }
  const admins = String(process.env.ADMIN_EMAILS).split(',').map((value) => value.trim()).filter(Boolean);
  if (admins.length === 0 || admins.some((email) => !/^\S+@\S+\.\S+$/.test(email))) {
    throw new Error('ADMIN_EMAILS must contain a comma-separated list of valid email addresses');
  }
  const origins = String(process.env.NEXT_PUBLIC_ALLOWED_ORIGINS).split(',').map((value) => value.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some((origin) => {
    try { return new URL(origin).protocol !== 'https:'; } catch { return true; }
  })) {
    throw new Error('NEXT_PUBLIC_ALLOWED_ORIGINS must contain production HTTPS origins');
  }
}


