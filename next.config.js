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
