// Demo build wiring, called by next.config.js.
//
// With NEXT_PUBLIC_SWOOP_DEMO=1 in `next dev --webpack` only, this:
// - builds into .next-demo so the demo can run beside `npm run dev`,
// - swaps Clerk, Firebase and Razorpay for the stand-ins in src/lib/demo/shims,
//   one webpack alias per shim file that exists,
// - sets a same-origin CSP and drops the PostHog /ph rewrites,
// - allows the demo origin on port 3019.
// The flag meeting a production build or server, or Turbopack, is an error.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEMO_PORT = 3019;
const DEMO_DIST_DIR = '.next-demo';
const SHIM_DIR_PARTS = ['src', 'lib', 'demo', 'shims'];

const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';
const PHASE_PRODUCTION_BUILD = 'phase-production-build';
const PHASE_PRODUCTION_SERVER = 'phase-production-server';
const PHASE_EXPORT = 'phase-export';

/** Package request -> shim file name in src/lib/demo/shims. */
const DEMO_ALIASES = Object.freeze([
  { request: '@clerk/nextjs', shim: 'clerk-client.tsx' },
  { request: '@clerk/nextjs/server', shim: 'clerk-server.ts' },
  { request: '@clerk/nextjs/errors', shim: 'clerk-errors.ts' },
  { request: 'firebase/app', shim: 'firebase-app.ts' },
  { request: 'firebase/auth', shim: 'firebase-auth.ts' },
  { request: 'firebase/firestore', shim: 'firebase-firestore.ts' },
  { request: 'firebase/storage', shim: 'firebase-storage.ts' },
  { request: 'razorpay', shim: 'razorpay-server.ts' },
]);

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Matches the bare request ('firebase/app') and Next's barrel-optimised form
 * ('__barrel_optimize__?names=x!=!firebase/app'), never a subpath or a
 * look-alike package ('firebase/app-check', '@clerk/nextjs/server' for '@clerk/nextjs').
 */
function aliasPattern(request) {
  return new RegExp(`(?:^|!=!)${escapeRegExp(request)}$`);
}

function isDemoFlagOn(env) {
  return (env || process.env).NEXT_PUBLIC_SWOOP_DEMO === '1';
}

/** Throws a plain error if the demo flag meets anything but `next dev --webpack`. */
function assertDemoAllowed(phase, env) {
  const e = env || process.env;
  if (!isDemoFlagOn(e)) return;
  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER || phase === PHASE_EXPORT) {
    throw new Error(
      'Demo mode is dev only. NEXT_PUBLIC_SWOOP_DEMO=1 cannot be used with next build or next start. ' +
        'Unset it, or run `npm run demo`.'
    );
  }
  if (e.NODE_ENV === 'production') {
    throw new Error('Demo mode is dev only. NEXT_PUBLIC_SWOOP_DEMO=1 cannot be used with NODE_ENV=production.');
  }
  if (e.TURBOPACK) {
    throw new Error(
      'Demo mode needs webpack. NEXT_PUBLIC_SWOOP_DEMO=1 cannot be used with Turbopack. ' +
        'Run `npm run demo` (next dev --webpack).'
    );
  }
}

/** True only for the flag in a development server, outside production. */
function isDemoBuild(phase, env) {
  const e = env || process.env;
  return isDemoFlagOn(e) && phase === PHASE_DEVELOPMENT_SERVER && e.NODE_ENV !== 'production' && !e.TURBOPACK;
}

/** The aliases whose shim file exists, with absolute shim paths. */
function demoAliases(rootDir, exists) {
  const fileExists = exists || fs.existsSync;
  const shimDir = path.join(rootDir, ...SHIM_DIR_PARTS);
  return DEMO_ALIASES.map((alias) => ({
    request: alias.request,
    shim: path.join(shimDir, alias.shim),
    pattern: aliasPattern(alias.request),
  })).filter((alias) => fileExists(alias.shim));
}

/** Webpack plugins that swap each live alias for its shim. */
function demoReplacementPlugins(webpack, aliases) {
  return aliases.map(
    (alias) =>
      new webpack.NormalModuleReplacementPlugin(alias.pattern, (resource) => {
        resource.request = alias.shim;
      })
  );
}

function demoSecurityHeaders() {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // Dev only: React and webpack need eval() for debugging.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "connect-src 'self' blob:", // pdf.js reads the picked file through a blob: URL
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}

function isPosthogRewrite(rule) {
  return Boolean(rule && typeof rule.source === 'string' && rule.source.startsWith('/ph'));
}

function withoutPosthogRewrites(rewrites) {
  if (Array.isArray(rewrites)) return rewrites.filter((rule) => !isPosthogRewrite(rule));
  if (rewrites && typeof rewrites === 'object') {
    const out = {};
    for (const key of Object.keys(rewrites)) {
      out[key] = Array.isArray(rewrites[key]) ? rewrites[key].filter((rule) => !isPosthogRewrite(rule)) : rewrites[key];
    }
    return out;
  }
  return rewrites;
}

/**
 * Returns nextConfig unchanged unless the demo flag is on in `next dev --webpack`.
 * Throws if the flag meets a production build or server, or Turbopack.
 * options: { phase, env?, rootDir?, exists?, log? }
 */
function applyDemoConfig(nextConfig, options) {
  const opts = options || {};
  const env = opts.env || process.env;
  assertDemoAllowed(opts.phase, env);
  if (!isDemoBuild(opts.phase, env)) return nextConfig;

  const rootDir = opts.rootDir || process.cwd();
  const log = opts.log || ((line) => console.log(line));
  const aliases = demoAliases(rootDir, opts.exists);
  log(`[demo] Swoop demo on sample data: build folder ${DEMO_DIST_DIR}, port ${DEMO_PORT}`);
  if (aliases.length === 0) log('[demo] No stand-ins yet');
  for (const alias of aliases) log(`[demo] ${alias.request} -> ${path.relative(rootDir, alias.shim)}`);

  const baseWebpack = nextConfig.webpack;
  const baseRewrites = nextConfig.rewrites;
  const devOrigins = [`localhost:${DEMO_PORT}`, `127.0.0.1:${DEMO_PORT}`];

  return {
    ...nextConfig,
    distDir: DEMO_DIST_DIR,
    devIndicators: false,
    allowedDevOrigins: devOrigins,
    async headers() {
      return [{ source: '/(.*)', headers: demoSecurityHeaders() }];
    },
    async rewrites() {
      if (typeof baseRewrites !== 'function') return [];
      return withoutPosthogRewrites(await baseRewrites());
    },
    webpack(config, context) {
      const out = typeof baseWebpack === 'function' ? baseWebpack(config, context) : config;
      if (!context.dev) throw new Error('Demo mode is dev only. The demo aliases cannot be used in a production build.');
      out.plugins = [...(out.plugins || []), ...demoReplacementPlugins(context.webpack, aliases)];
      return out;
    },
  };
}

module.exports = {
  DEMO_ALIASES,
  DEMO_DIST_DIR,
  DEMO_PORT,
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
  aliasPattern,
  applyDemoConfig,
  assertDemoAllowed,
  demoAliases,
  demoReplacementPlugins,
  demoSecurityHeaders,
  isDemoBuild,
  isDemoFlagOn,
};
