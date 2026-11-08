#!/usr/bin/env node
// Runs the Swoop demo on sample data: http://localhost:3019, no env needed.
//
//   npm run demo          start the demo and pre-load the main routes
//   npm run demo:check    start it, GET every static page, exit 1 on any 500
//
// Plain Node, no shell, so it works the same on Windows, macOS and Linux.

import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Keep in step with DEMO_PORT and the cookie names in src/lib/demo/contract.ts.
const PORT = 3019;
const ORIGIN = `http://localhost:${PORT}`;
const VISITOR_COOKIE = 'swoop_demo_visitor';
const SESSION_COOKIE = 'swoop_demo_session';
const WARMUP_VISITOR = 'warmup';
const SANA_UID = 'verified-kju-main';

const MAIN_ROUTES = ['/', '/demo', '/login', '/campus', '/marketplace', '/housing', '/shops', '/upload', '/orders', '/profile'];
const READY_TIMEOUT_MS = 180_000;
const PAGE_TIMEOUT_MS = 240_000;

const check = process.argv.includes('--check');

// Every service value is overridden here so a real .env.local can never reach
// a live service. Next never overrides a variable that is already set.
const demoEnv = {
  NEXT_PUBLIC_SWOOP_DEMO: '1',
  NEXT_PUBLIC_SWOOP_FIXTURES: '1',
  NEXT_PUBLIC_ALLOWED_ORIGINS: ORIGIN,
  // Clerk and Firebase are replaced by stand-ins; blank keys keep the SDKs inert.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
  CLERK_SECRET_KEY: '',
  NEXT_PUBLIC_FIREBASE_API_KEY: '',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'swoop-demo',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'swoop-demo.test',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '',
  NEXT_PUBLIC_FIREBASE_APP_ID: '',
  FIREBASE_ADMIN_PROJECT_ID: '',
  FIREBASE_ADMIN_CLIENT_EMAIL: '',
  FIREBASE_ADMIN_PRIVATE_KEY: '',
  // Razorpay placeholders: the demo stand-in signs and checks with these.
  RAZORPAY_KEY_ID: 'demo_razorpay_key_id',
  NEXT_PUBLIC_RAZORPAY_KEY_ID: 'demo_razorpay_key_id',
  // pdf.js worker from public/, so the previewer never asks unpkg.com.
  NEXT_PUBLIC_PDF_WORKER_URL: '/pdf.worker.min.mjs',
  RAZORPAY_KEY_SECRET: 'swoop-demo-razorpay-secret',
  RAZORPAY_WEBHOOK_SECRET: 'swoop-demo-webhook-secret',
  // Cron and internal tokens: placeholders, never real.
  CRON_SECRET: 'swoop-demo-cron-secret',
  CAMPUS_MAINTENANCE_TOKEN: 'swoop-demo-maintenance-token',
  VIDEO_WORKER_TOKEN: 'swoop-demo-video-token',
  CAMPUS_ACCOUNT_HOOK_TOKEN: 'swoop-demo-account-hook-token',
  ADMIN_EMAILS: '',
  // Analytics off.
  NEXT_PUBLIC_POSTHOG_KEY: '',
  NEXT_PUBLIC_POSTHOG_HOST: '',
  POSTHOG_API_KEY: '',
  POSTHOG_HOST: '',
  NEXT_TELEMETRY_DISABLED: '1',
};

function childEnv() {
  const env = { ...process.env, ...demoEnv };
  // next dev sets NODE_ENV itself; a stray production value must not leak in.
  delete env.NODE_ENV;
  delete env.TURBOPACK;
  return env;
}

function sessionCookie(uid) {
  return Buffer.from(JSON.stringify({ uid }), 'utf8').toString('base64url');
}

const WARMUP_COOKIES = [
  `${VISITOR_COOKIE}=${WARMUP_VISITOR}`,
  `${SESSION_COOKIE}=${sessionCookie(SANA_UID)}`,
].join('; ');

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

/** Static app routes: every page file with no dynamic segment. */
function staticPages() {
  const appDir = path.join(ROOT, 'app');
  const pages = [];
  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const name = entry.name;
        if (name.startsWith('_') || name.startsWith('@') || name.includes('[') || name === 'api') continue;
        const isGroup = name.startsWith('(') && name.endsWith(')');
        walk(path.join(dir, name), isGroup ? segments : [...segments, name]);
      } else if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(entry.name)) {
        pages.push('/' + segments.join('/'));
      }
    }
  };
  walk(appDir, []);
  return [...new Set(pages)].sort();
}

async function get(route) {
  const started = Date.now();
  try {
    const response = await fetch(ORIGIN + route, {
      headers: { cookie: WARMUP_COOKIES },
      redirect: 'manual',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    await response.arrayBuffer();
    return { route, status: response.status, ms: Date.now() - started };
  } catch (error) {
    return { route, status: 0, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

function report(result) {
  const detail = result.error ? ` (${result.error})` : '';
  console.log(`[demo] ${String(result.status || 'ERR').padEnd(3)} ${result.route} ${result.ms} ms${detail}`);
}

async function main() {
  const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!existsSync(nextBin)) {
    console.error('[demo] Next is not installed. Run npm install first.');
    process.exit(1);
  }
  if (!(await portIsFree(PORT))) {
    console.error(`[demo] Port ${PORT} is busy. Stop whatever runs there and try again.`);
    process.exit(1);
  }

  console.log(`[demo] Starting the Swoop demo on sample data at ${ORIGIN}`);
  const child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '-p', String(PORT)], {
    cwd: ROOT,
    env: childEnv(),
    stdio: ['inherit', 'pipe', 'inherit'],
  });

  let exiting = false;
  const stop = (code) => {
    if (exiting) return;
    exiting = true;
    if (child.exitCode === null) child.kill();
    process.exitCode = code;
  };
  process.on('SIGINT', () => stop(0));
  process.on('SIGTERM', () => stop(0));

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Not ready after ${READY_TIMEOUT_MS / 1000} s`)), READY_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      if (/Ready in/i.test(chunk.toString())) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`next dev exited with code ${code}`));
    });
  });

  child.once('exit', (code) => {
    if (!exiting) {
      exiting = true;
      process.exit(code ?? 1);
    }
  });

  try {
    await ready;
  } catch (error) {
    console.error(`[demo] ${error instanceof Error ? error.message : error}`);
    stop(1);
    return;
  }

  console.log('[demo] Pre-loading the main routes as Sana (sample data)');
  for (const route of MAIN_ROUTES) {
    if (exiting) return;
    report(await get(route));
  }

  if (!check) {
    console.log(`[demo] Open ${ORIGIN}. Everything here is sample data. Ctrl+C stops it.`);
    return;
  }

  const pages = staticPages();
  console.log(`[demo] Checking ${pages.length} static pages`);
  const failures = [];
  for (const route of pages) {
    if (exiting) return;
    const result = await get(route);
    report(result);
    if (result.status === 0 || result.status >= 500) failures.push(result);
  }
  if (failures.length > 0) {
    console.error(`[demo] ${failures.length} page(s) failed: ${failures.map((f) => f.route).join(', ')}`);
    stop(1);
  } else {
    console.log('[demo] Every static page answered without a 500');
    stop(0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
