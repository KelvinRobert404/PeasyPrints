export function assertRequiredEnvInProd() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'CLERK_SECRET_KEY',
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
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
}


