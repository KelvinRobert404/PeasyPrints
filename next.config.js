const isProd = process.env.NODE_ENV === 'production';

let withSerwist = (cfg) => cfg;
if (isProd) {
  withSerwist = require('@serwist/next').default({
    swSrc: 'service-worker.js',
    swDest: 'public/sw.js'
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react']
  },
  // Allow local network dev origins (Next.js 15+ deprecation warning)
  // Update IPs/hosts as needed for your environment
  allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://10.170.218.153:3000', 'https://dev.theswoop.club'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**'
      }
    ]
  },
  async redirects() {
    return [
      {
        source: '/upload/:shopId',
        destination: '/upload?shopId=:shopId',
        permanent: false
      }
    ];
  },
  async headers() {
    // React/Turbopack need eval() for dev debugging; never allow it in production.
    const devEval = isProd ? '' : " 'unsafe-eval'";
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https://firebasestorage.googleapis.com https://img.clerk.com https://*.clerk.com; font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net https://fonts.cdnfonts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net https://fonts.cdnfonts.com; script-src 'self' 'unsafe-inline'" + devEval + " https://checkout.razorpay.com https://www.googletagmanager.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.peasyprints.com; connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.com https://clerk-telemetry.com https://clerk.peasyprints.com https://www.google-analytics.com https://region1.google-analytics.com https://vitals.vercel-insights.com; frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com https://*.clerk.accounts.dev https://*.clerk.com; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests" },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ];
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: '/ph/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      {
        source: '/ph/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      }
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true
};

module.exports = withSerwist(nextConfig);
