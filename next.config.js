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
  experimental: {
    optimizePackageImports: ['lucide-react']
  },
  // Allow local network dev origins (Next.js 15+ deprecation warning)
  // Update IPs/hosts as needed for your environment
  allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://10.170.218.153:3000'],
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
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      }
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true
};

module.exports = withSerwist(nextConfig);
