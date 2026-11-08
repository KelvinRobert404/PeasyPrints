import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

interface Alias {
  request: string;
  shim: string;
  pattern: RegExp;
}

const buildConfig = require('../../src/lib/demo/build-config.cjs') as {
  DEMO_ALIASES: readonly { request: string; shim: string }[];
  PHASE_DEVELOPMENT_SERVER: string;
  PHASE_PRODUCTION_BUILD: string;
  PHASE_PRODUCTION_SERVER: string;
  aliasPattern(request: string): RegExp;
  applyDemoConfig(config: Record<string, any>, options: Record<string, unknown>): Record<string, any>;
  demoAliases(rootDir: string, exists?: (file: string) => boolean): Alias[];
};

const { DEMO_ALIASES, PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, aliasPattern, applyDemoConfig, demoAliases } =
  buildConfig;

const ROOT = '/repo';
const allExist = () => true;
const quiet = () => {};
const DEV_ENV = { NEXT_PUBLIC_SWOOP_DEMO: '1', NODE_ENV: 'development' };

function baseConfig() {
  return {
    reactStrictMode: true,
    allowedDevOrigins: ['http://localhost:3000'],
    async headers() {
      return [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: 'connect-src https://*.clerk.com' }] }];
    },
    async rewrites() {
      return [
        { source: '/ph/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
        { source: '/ph/:path*', destination: 'https://us.i.posthog.com/:path*' },
        { source: '/keep', destination: '/kept' },
      ];
    },
  };
}

class FakeReplacementPlugin {
  pattern: RegExp;
  replace: (resource: { request: string }) => void;
  constructor(pattern: RegExp, replace: (resource: { request: string }) => void) {
    this.pattern = pattern;
    this.replace = replace;
  }
}

function runWebpack(config: Record<string, any>, dev = true) {
  const context = { dev, isServer: false, webpack: { NormalModuleReplacementPlugin: FakeReplacementPlugin } };
  return config.webpack({ plugins: [] }, context) as { plugins: FakeReplacementPlugin[] };
}

/** What a request resolves to after the demo plugins run. */
function resolveWith(plugins: FakeReplacementPlugin[], request: string): string {
  const resource = { request };
  for (const plugin of plugins) if (plugin.pattern.test(resource.request)) plugin.replace(resource);
  return resource.request;
}

test('flag off: config is unchanged in every phase', () => {
  for (const phase of [PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER]) {
    for (const env of [{ NODE_ENV: 'development' }, { NEXT_PUBLIC_SWOOP_DEMO: 'true', NODE_ENV: 'development' }, { NODE_ENV: 'production' }]) {
      const config = baseConfig();
      assert.equal(applyDemoConfig(config, { phase, env, rootDir: ROOT, exists: allExist, log: quiet }), config);
    }
  }
});

test('flag on: production build, production server and Turbopack refuse plainly', () => {
  assert.throws(() => applyDemoConfig(baseConfig(), { phase: PHASE_PRODUCTION_BUILD, env: DEV_ENV, rootDir: ROOT, log: quiet }), /Demo mode is dev only/);
  assert.throws(() => applyDemoConfig(baseConfig(), { phase: PHASE_PRODUCTION_SERVER, env: DEV_ENV, rootDir: ROOT, log: quiet }), /Demo mode is dev only/);
  assert.throws(
    () => applyDemoConfig(baseConfig(), { phase: PHASE_DEVELOPMENT_SERVER, env: { ...DEV_ENV, NODE_ENV: 'production' }, rootDir: ROOT, log: quiet }),
    /Demo mode is dev only/
  );
  assert.throws(
    () => applyDemoConfig(baseConfig(), { phase: PHASE_DEVELOPMENT_SERVER, env: { ...DEV_ENV, TURBOPACK: '1' }, rootDir: ROOT, log: quiet }),
    /Turbopack/
  );
});

test('flag on in dev: build folder, origins, CSP and rewrites', async () => {
  const config = applyDemoConfig(baseConfig(), { phase: PHASE_DEVELOPMENT_SERVER, env: DEV_ENV, rootDir: ROOT, exists: allExist, log: quiet });
  assert.equal(config.distDir, '.next-demo');
  assert.equal(config.reactStrictMode, true);
  assert.ok(config.allowedDevOrigins.includes('localhost:3019'));
  const headers = await config.headers();
  const csp = headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value as string;
  assert.match(csp, /connect-src 'self' blob:(;|$)/);
  assert.doesNotMatch(csp, /https?:/);
  assert.deepEqual(await config.rewrites(), [{ source: '/keep', destination: '/kept' }]);
});

test('flag on in dev: one replacement per alias whose shim exists', () => {
  const present = new Set([path.join(ROOT, 'src/lib/demo/shims/clerk-server.ts'), path.join(ROOT, 'src/lib/demo/shims/firebase-app.ts')]);
  const logs: string[] = [];
  const config = applyDemoConfig(baseConfig(), {
    phase: PHASE_DEVELOPMENT_SERVER,
    env: DEV_ENV,
    rootDir: ROOT,
    exists: (file: string) => present.has(file),
    log: (line: string) => logs.push(line),
  });
  const { plugins } = runWebpack(config);
  assert.equal(plugins.length, 2);
  assert.ok(logs.some((line) => line.includes('@clerk/nextjs/server')));
  assert.equal(resolveWith(plugins, '@clerk/nextjs/server'), path.join(ROOT, 'src/lib/demo/shims/clerk-server.ts'));
  assert.equal(resolveWith(plugins, 'firebase/app'), path.join(ROOT, 'src/lib/demo/shims/firebase-app.ts'));
  assert.equal(resolveWith(plugins, '@clerk/nextjs'), '@clerk/nextjs');
  assert.equal(resolveWith(plugins, 'razorpay'), 'razorpay');
});

test('flag on: the webpack hook refuses a non-dev compile', () => {
  const config = applyDemoConfig(baseConfig(), { phase: PHASE_DEVELOPMENT_SERVER, env: DEV_ENV, rootDir: ROOT, exists: allExist, log: quiet });
  assert.throws(() => runWebpack(config, false), /dev only/);
});

test('every contract alias is wired, matching bare and barrel requests only', () => {
  assert.deepEqual(
    DEMO_ALIASES.map((a) => [a.request, a.shim]),
    [
      ['@clerk/nextjs', 'clerk-client.tsx'],
      ['@clerk/nextjs/server', 'clerk-server.ts'],
      ['@clerk/nextjs/errors', 'clerk-errors.ts'],
      ['firebase/app', 'firebase-app.ts'],
      ['firebase/auth', 'firebase-auth.ts'],
      ['firebase/firestore', 'firebase-firestore.ts'],
      ['firebase/storage', 'firebase-storage.ts'],
      ['razorpay', 'razorpay-server.ts'],
    ]
  );
  const aliases = demoAliases(ROOT, allExist);
  assert.equal(aliases.length, 8);
  const { plugins } = runWebpack(applyDemoConfig(baseConfig(), { phase: PHASE_DEVELOPMENT_SERVER, env: DEV_ENV, rootDir: ROOT, exists: allExist, log: quiet }));
  for (const alias of aliases) {
    assert.equal(resolveWith(plugins, alias.request), alias.shim);
    assert.equal(resolveWith(plugins, `__barrel_optimize__?names=a,b!=!${alias.request}`), alias.shim);
  }
  const clerk = aliasPattern('@clerk/nextjs');
  assert.equal(clerk.test('@clerk/nextjs/server'), false);
  assert.equal(clerk.test('@clerk/nextjs-extra'), false);
  assert.equal(clerk.test('not-@clerk/nextjs'), false);
  assert.equal(aliasPattern('firebase/app').test('firebase/app-check'), false);
  assert.equal(aliasPattern('firebase/app').test('@firebase/app'), false);
  assert.equal(aliasPattern('razorpay').test('razorpay/dist/razorpay'), false);
  assert.equal(aliasPattern('razorpay').test('__barrel_optimize__?names=default!=!razorpay'), true);
});
