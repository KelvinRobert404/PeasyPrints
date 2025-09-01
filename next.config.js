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
  }
};

module.exports = withSerwist(nextConfig);
