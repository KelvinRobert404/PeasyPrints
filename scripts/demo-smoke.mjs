#!/usr/bin/env node
// Smoke test for the Swoop demo on sample data. Run it against a running demo:
//
//   npm run demo            (in one terminal)
//   npm run demo:smoke      (in another; or: node scripts/demo-smoke.mjs [base URL])
//
// It uses a fresh visitor world, keeps one cookie jar per sample student, and checks:
//   1. the page list, signed out and as each sample student (status, redirect or 404,
//      and no Next error markers in the HTML);
//   2. the API checks for the KADA-18 ids SEAMROUTES, CONTACT, NTF, GAMES, LOST, MACT,
//      CRON and COPY, plus sign-in and onboarding.
// One PASS or FAIL line per check. Exits 1 on any FAIL.
// Node 22, fetch only, no dependencies. Never talks to any host but the base URL.

const BASE = (process.argv.slice(2).find((arg) => !arg.startsWith('-')) || 'http://localhost:3019').replace(/\/+$/, '');
const BASE_URL = new URL(BASE);
if (!['localhost', '127.0.0.1', '[::1]'].includes(BASE_URL.hostname)) {
  console.error(`[smoke] The demo runs on localhost only, not ${BASE_URL.hostname}.`);
  process.exit(1);
}

// Keep in step with src/lib/demo/contract.ts and scripts/demo.mjs.
const VISITOR_COOKIE = 'swoop_demo_visitor';
const SESSION_COOKIE = 'swoop_demo_session';
// The launcher's placeholder cron value (scripts/demo.mjs). Override with CRON_SECRET.
const CRON_SECRET = process.env.CRON_SECRET || 'swoop-demo-cron-secret';
const REQUEST_TIMEOUT_MS = 240_000;

const PERSONAS = {
  sana: 'verified-kju-main',
  kabir: 'verified-kju-airport',
  ananya: 'girls-approved',
  meera: 'pending-id-card',
};

const MAIN_LANDMARK = 'kju-main-st-marys-church';

// A fresh world for this run, shared by every jar so the personas see each other.
const VISITOR = `smoke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------------------
// Cookie jars and requests

class Jar {
  constructor(name, cookies = {}) {
    this.name = name;
    this.cookies = new Map(Object.entries(cookies));
  }

  header() {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  store(response) {
    const lines = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const line of lines) {
      const [pair, ...attributes] = line.split(';');
      const index = pair.indexOf('=');
      if (index < 0) continue;
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute)) || value === '';
      if (expired) this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
  }
}

/** One request. Never follows redirects, so each check sees the real answer. */
async function call(jar, method, path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const cookie = jar ? jar.header() : '';
  if (cookie) headers.cookie = cookie;
  // Writes must come from the demo's own origin (proxy origin check).
  if (method !== 'GET' && method !== 'HEAD' && !headers.origin) headers.origin = BASE;
  let body;
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form;
  }
  const response = await fetch(BASE + path, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (jar) jar.store(response);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: response.status, location: response.headers.get('location'), text, data };
}

const get = (jar, path, options) => call(jar, 'GET', path, options);
const post = (jar, path, json, options = {}) => call(jar, 'POST', path, { ...options, json });
const patch = (jar, path, json, options = {}) => call(jar, 'PATCH', path, { ...options, json });

// ---------------------------------------------------------------------------
// Reporting

const results = [];

class CheckFailure extends Error {}

function fail(message) {
  throw new CheckFailure(message);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

function brief(response) {
  if (!response) return '';
  const error = response.data && typeof response.data === 'object' ? response.data.error : null;
  return error ? `${response.status} (${error})` : String(response.status);
}

function expectStatus(response, wanted, what) {
  const list = Array.isArray(wanted) ? wanted : [wanted];
  if (!list.includes(response.status)) fail(`${what}: wanted ${list.join(' or ')}, got ${brief(response)}`);
}

async function check(id, name, fn) {
  const label = `${id.padEnd(10)} ${name}`;
  try {
    const note = await fn();
    results.push({ ok: true });
    console.log(`PASS ${label}${note ? ` (${note})` : ''}`);
  } catch (error) {
    results.push({ ok: false });
    const message = error instanceof CheckFailure ? error.message : error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.log(`FAIL ${label}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Pages

const MARKET_DETAIL = 'mkt-headphones';
const HOUSING_DETAIL = 'hsg-pg-falcon';

/** Public without sign-in (proxy isPublicRoute plus the demo pages). */
const PUBLIC_PAGES = new Set(['/', '/demo', '/login', '/upload', '/orders', '/shops', '/about', '/contact', '/privacy', '/terms']);

const PAGES = [
  '/',
  '/demo',
  '/login',
  '/marketplace',
  '/marketplace/all/clearing-out',
  '/marketplace/all/seats',
  '/marketplace/all/near-you',
  '/marketplace/all/wanted',
  '/marketplace/all/x',
  '/marketplace/new',
  `/marketplace/${MARKET_DETAIL}`,
  '/housing',
  '/housing/new',
  `/housing/${HOUSING_DETAIL}`,
  '/girls-space',
  '/campus/activity',
  '/campus/deals',
  '/campus/lost-found',
  '/campus/blood',
  '/campus/games',
  '/campus/verify',
  '/upload',
  '/orders',
  '/shops',
  '/profile',
  '/settings/privacy',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/godview',
];

/**
 * Next error markers in a page that should render. A streamed notFound() or
 * forbidden() shows as NEXT_HTTP_ERROR_FALLBACK; a crash shows the error shell.
 */
const ERROR_MARKERS = [
  { label: 'error shell', pattern: /id="__next_error__"/ },
  { label: 'HTTP error fallback', pattern: /NEXT_HTTP_ERROR_FALLBACK;\d+/ },
  { label: 'Internal Server Error', pattern: /Internal Server Error/ },
  { label: 'Unhandled Runtime Error', pattern: /Unhandled Runtime Error/ },
  { label: 'Application error', pattern: /Application error: a (?:server|client)-side exception/ },
  { label: 'Not in the demo', pattern: /Not in the demo: / },
  // A server component error streamed as an RSC error row: <id>:E{"digest":"<number>",...}
  { label: 'server error in the page', pattern: /[0-9a-f]+:E\{\\?"digest\\?":\\?"\d/ },
  { label: 'streamed redirect', pattern: /NEXT_REDIRECT;/ },
];

const SOFT_404 = /NEXT_HTTP_ERROR_FALLBACK;404/;

function markersIn(html) {
  return ERROR_MARKERS.filter((marker) => marker.pattern.test(html)).map((marker) => marker.label);
}

function pathOf(location) {
  if (!location) return '';
  const url = new URL(location, BASE);
  return url.pathname + url.search;
}

/** What a page should answer for this viewer. */
function expectationFor(route, signedIn) {
  if (route === '/godview') return { kind: 'redirect', to: (to) => to.startsWith('/demo/not-included') };
  if (signedIn && route === '/login') return { kind: 'redirect', to: (to) => !to.startsWith('/login') };
  if (!signedIn && !PUBLIC_PAGES.has(route)) {
    return { kind: 'redirect', to: (to) => to.startsWith('/login?') && new URL(to, BASE).searchParams.get('redirect_url') === route };
  }
  if (route === '/marketplace/all/x') return { kind: 'notFound' };
  return { kind: 'ok' };
}

async function checkPage(jar, route, signedIn) {
  const want = expectationFor(route, signedIn);
  const response = await get(jar, route);
  if (want.kind === 'redirect') {
    expect([301, 302, 303, 307, 308].includes(response.status), `wanted a redirect, got ${response.status}`);
    const to = pathOf(response.location);
    expect(want.to(to), `redirected to ${to || 'nowhere'}`);
    return `${response.status} to ${to}`;
  }
  if (want.kind === 'notFound') {
    // app/loading.tsx streams the shell first, so Next can only send a soft 404
    // (status 200 with the not-found fallback) unless the status is already 404.
    if (response.status === 404) return '404';
    expect(response.status === 200 && SOFT_404.test(response.text), `wanted 404, got ${response.status} without the not-found fallback`);
    return '404 (streamed: status 200 with the not-found page)';
  }
  expect(response.status === 200, `wanted 200, got ${response.status}${response.location ? ` to ${pathOf(response.location)}` : ''}`);
  const markers = markersIn(response.text);
  expect(markers.length === 0, `Next error markers: ${markers.join(', ')}`);
  return '200';
}

// ---------------------------------------------------------------------------
// Sign-in

function sessionValue(uid) {
  return Buffer.from(JSON.stringify({ uid }), 'utf8').toString('base64url');
}

function newJar(name) {
  return new Jar(name, { [VISITOR_COOKIE]: VISITOR });
}

async function signIn(jar, body) {
  const response = await post(jar, '/api/demo/session', body);
  expectStatus(response, 200, 'POST /api/demo/session');
  expect(response.data?.signedIn === true, 'session says signed out');
  expect(jar.cookies.has(SESSION_COOKIE), 'no session cookie set');
  return response;
}

async function campusSession(jar) {
  const response = await get(jar, '/api/campus/session');
  expectStatus(response, 200, 'GET /api/campus/session');
  return response.data;
}

/** A tiny JPEG header: enough for the upload route's file type check. */
function sampleIdCard() {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
  return new Blob([bytes], { type: 'image/jpeg' });
}

// ---------------------------------------------------------------------------
// Main

async function waitForServer() {
  try {
    const response = await fetch(`${BASE}/api/demo/session`, { redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    await response.arrayBuffer();
    if (response.status === 404) {
      console.error('[smoke] /api/demo/session answered 404: the server is not in demo mode. Start it with npm run demo.');
      process.exit(1);
    }
  } catch (error) {
    console.error(`[smoke] Cannot reach ${BASE}: ${error instanceof Error ? error.message : error}. Start it with npm run demo.`);
    process.exit(1);
  }
}

async function main() {
  console.log(`[smoke] Swoop demo smoke on ${BASE}, sample data, visitor ${VISITOR}`);
  await waitForServer();

  const jars = {
    out: newJar('signed out'),
    sana: newJar('Sana'),
    kabir: newJar('Kabir'),
    ananya: newJar('Ananya'),
    meera: newJar('Meera'),
    riya: newJar('Riya'),
  };

  // ---- Session and onboarding ---------------------------------------------

  await check('SESSION', 'first visit goes to /demo?next=', async () => {
    const response = await get(null, '/marketplace');
    expect([302, 307].includes(response.status), `wanted a redirect, got ${response.status}`);
    const to = pathOf(response.location);
    expect(to.startsWith('/demo?') && new URL(to, BASE).searchParams.get('next') === '/marketplace', `redirected to ${to}`);
    return to;
  });

  await check('SESSION', 'signed out session API', async () => {
    const response = await get(jars.out, '/api/demo/session');
    expectStatus(response, 200, 'GET /api/demo/session');
    expect(response.data?.signedIn === false, 'signed in without a cookie');
    const session = await campusSession(jars.out);
    expect(session?.signedIn === false, 'campus session signed in without a cookie');
  });

  for (const [persona, uid] of Object.entries(PERSONAS)) {
    await check('SESSION', `sign in as ${persona}`, async () => {
      const response = await signIn(jars[persona], { persona });
      expect(response.data.uid === uid, `uid ${response.data.uid}, wanted ${uid}`);
      const session = await campusSession(jars[persona]);
      expect(session?.signedIn === true, 'campus session signed out');
      if (persona === 'meera') {
        expect(session.verifiedStudent === false, 'Meera reads as verified');
        expect(session.membership?.student?.status === 'pending', `Meera's card is ${session.membership?.student?.status}`);
      } else {
        expect(session.verifiedStudent === true, `${persona} is not verified`);
      }
      if (persona === 'ananya') expect(session.girlsSpaceApproved === true, "Ananya has no Girls' space");
      if (persona === 'sana') expect(session.campus?.id === 'kju-main', `Sana's campus is ${session.campus?.id}`);
      if (persona === 'kabir') expect(session.campus?.id === 'kju-airport-road', `Kabir's campus is ${session.campus?.id}`);
      return session.campus?.label ?? 'no campus';
    });
  }

  await check('SESSION', 'unknown sample student is 400', async () => {
    const response = await post(newJar('bad'), '/api/demo/session', { persona: 'nobody' });
    expectStatus(response, 400, 'POST /api/demo/session');
  });

  await check('SESSION', 'Riya, college Google: onboarding approves', async () => {
    const response = await signIn(jars.riya, { google: 'college' });
    expect(response.data.uid === 'new-user', `uid ${response.data.uid}`);
    const before = await campusSession(jars.riya);
    expect(before.verifiedStudent === false, 'Riya is verified before onboarding');
    const college = await post(jars.riya, '/api/campus/onboarding', { collegeId: 'kju', campusId: 'kju-main' });
    expectStatus(college, 200, 'POST /api/campus/onboarding (college)');
    expect(college.data?.domainMismatch === false, 'college email did not match KJU');
    expect(college.data?.session?.verifiedStudent === true, 'not verified after the college step');
    const course = await post(jars.riya, '/api/campus/onboarding', { course: { programmeId: 'bcom', semester: 3, specialisation: null } });
    expectStatus(course, 200, 'POST /api/campus/onboarding (course)');
    const stay = await post(jars.riya, '/api/campus/onboarding', { stay: { type: 'pg', distanceM: 1200 } });
    expectStatus(stay, 200, 'POST /api/campus/onboarding (stay)');
    return 'college, course and stay saved';
  });

  await check('SESSION', 'Riya, personal Google: domain mismatch', async () => {
    await signIn(jars.riya, { google: 'personal' });
    const college = await post(jars.riya, '/api/campus/onboarding', { collegeId: 'kju', campusId: 'kju-main' });
    expectStatus(college, 200, 'POST /api/campus/onboarding');
    expect(college.data?.domainMismatch === true, 'a gmail.test address passed the KJU domain check');
    expect(college.data?.session?.verifiedStudent === false, 'verified with a personal email');
  });

  await check('VERIFY', 'ID card upload, then the demo reviewer approves', async () => {
    const form = new FormData();
    form.set('kind', 'student');
    form.set('file', sampleIdCard(), 'id-card.jpg');
    const upload = await call(jars.riya, 'POST', '/api/campus/verifications', { form });
    expectStatus(upload, 201, 'POST /api/campus/verifications');
    expect(upload.data?.status === 'pending', `upload status ${upload.data?.status}`);
    const pending = await campusSession(jars.riya);
    expect(pending.membership?.student?.status === 'pending', `card is ${pending.membership?.student?.status} after upload`);
    const again = await call(jars.riya, 'POST', '/api/campus/verifications', { form });
    expectStatus(again, 409, 'second upload while pending');
    const approve = await post(jars.riya, '/api/demo/session/card', {});
    expectStatus(approve, 200, 'POST /api/demo/session/card');
    const after = await campusSession(jars.riya);
    expect(after.verifiedStudent === true, 'not verified after the card was approved');
    return 'pending, then approved';
  });

  await check('VERIFY', 'email code sign-in and add college email', async () => {
    const jar = newJar('Riya email');
    await signIn(jar, { emailCode: { email: 'riya.t@gmail.test' } });
    const added = await patch(jar, '/api/demo/session', { addEmail: 'riya@kju.test' });
    expectStatus(added, 200, 'PATCH /api/demo/session');
    expect(added.data?.emails?.some((email) => email.address === 'riya@kju.test' && email.verified), 'college email not on the account');
    const out = await call(jar, 'DELETE', '/api/demo/session');
    expectStatus(out, 200, 'DELETE /api/demo/session');
    expect(!jar.cookies.has(SESSION_COOKIE), 'session cookie kept after sign out');
  });

  // ---- Pages ----------------------------------------------------------------

  const pageViewers = [
    ['signed out', jars.out, false],
    ['sana', jars.sana, true],
    ['kabir', jars.kabir, true],
    ['ananya', jars.ananya, true],
    ['meera', jars.meera, true],
  ];
  for (const [who, jar, signedIn] of pageViewers) {
    for (const route of PAGES) {
      await check('PAGE', `${route} as ${who}`, () => checkPage(jar, route, signedIn));
    }
  }

  await check('PAGE', '/demo/not-included as signed out', async () => {
    const response = await get(jars.out, '/demo/not-included?area=godview');
    expectStatus(response, 200, 'GET /demo/not-included');
    const markers = markersIn(response.text);
    expect(markers.length === 0, `Next error markers: ${markers.join(', ')}`);
  });

  // ---- SEAMROUTES and MACT: create, edit and serial -------------------------

  let marketId = null;
  let marketSerial = null;
  await check('SEAMROUTES', 'market create gets a serial', async () => {
    const response = await post(jars.sana, '/api/marketplace/listings', {
      kind: 'item',
      title: `Smoke test desk lamp ${VISITOR.slice(-6)}`,
      description: 'Sample post from the demo smoke.',
      category: 'hostel_essentials',
      price: 300,
      priceTerms: 'fixed',
      landmarkId: MAIN_LANDMARK,
      condition: 'good',
      brand: null,
      whatsappNumber: '9876500001',
    });
    expectStatus(response, 201, 'POST /api/marketplace/listings');
    marketId = response.data?.id;
    marketSerial = response.data?.serial;
    expect(typeof marketId === 'string' && marketId, 'no id');
    expect(/^KJU-M\d{4}$/.test(String(marketSerial)), `serial ${marketSerial}`);
    return marketSerial;
  });

  await check('SEAMROUTES', 'market post reads back with its serial', async () => {
    expect(marketId, 'no post');
    const response = await get(jars.sana, `/api/marketplace/listings/${marketId}`);
    expectStatus(response, 200, 'GET listing');
    expect(response.data?.item?.serial === marketSerial, `serial ${response.data?.item?.serial}`);
    expect(response.data?.item?.isOwner === true, 'Sana is not the owner');
    const mine = await get(jars.sana, '/api/marketplace/listings?mine=1');
    expectStatus(mine, 200, 'GET mine');
    expect(mine.data?.items?.some((item) => item.id === marketId), 'not in My posts');
    const feed = await get(jars.kabir, '/api/marketplace/listings');
    expectStatus(feed, 200, 'GET feed as Kabir');
    expect(feed.data?.items?.some((item) => item.id === marketId), 'not in the college feed');
  });

  await check('MACT', 'market edit: lower price and reserve', async () => {
    expect(marketId, 'no post');
    const lower = await patch(jars.sana, `/api/marketplace/listings/${marketId}`, { action: 'lower_price', price: 250 });
    expectStatus(lower, 200, 'lower_price');
    const higher = await patch(jars.sana, `/api/marketplace/listings/${marketId}`, { action: 'lower_price', price: 400 });
    expectStatus(higher, 400, 'lower_price above the price');
    const read = await get(jars.sana, `/api/marketplace/listings/${marketId}`);
    expect(read.data?.item?.price === 250 && read.data?.item?.previousPrice === 300, `price ${read.data?.item?.price}, was ${read.data?.item?.previousPrice}`);
    const notOwner = await patch(jars.kabir, `/api/marketplace/listings/${marketId}`, { action: 'close' });
    expectStatus(notOwner, [403, 404], 'close by someone else');
    const reserve = await patch(jars.sana, `/api/marketplace/listings/${marketId}`, { action: 'reserve' });
    expectStatus(reserve, 200, 'reserve');
    expect(reserve.data?.status === 'reserved', `status ${reserve.data?.status}`);
    const unreserve = await patch(jars.sana, `/api/marketplace/listings/${marketId}`, { action: 'unreserve' });
    expectStatus(unreserve, 200, 'unreserve');
  });

  await check('MACT', 'wanted post cannot be reserved', async () => {
    const wanted = await patch(jars.kabir, '/api/marketplace/listings/mkt-wanted-calculator', { action: 'reserve' });
    expectStatus(wanted, 400, 'reserve a wanted post');
  });

  let housingId = null;
  let housingSerial = null;
  await check('SEAMROUTES', 'housing create gets a serial', async () => {
    const response = await post(jars.sana, '/api/housing/posts', {
      kind: 'room',
      postedAs: 'tenant',
      stayType: 'pg',
      title: `Smoke test room near campus ${VISITOR.slice(-6)}`,
      description: 'Sample post from the demo smoke.',
      whoCanStay: 'anyone',
      houseRules: ['no_smoking'],
      moveIn: 'now',
      bedsLeft: 1,
      rentPp: 8000,
      rentTerms: 'fixed',
      place: { landmarkId: MAIN_LANDMARK },
      whatsappNumber: '9876500002',
    });
    expectStatus(response, 201, 'POST /api/housing/posts');
    housingId = response.data?.id;
    housingSerial = response.data?.serial;
    expect(typeof housingId === 'string' && housingId, 'no id');
    expect(/^KJU-H\d{4}$/.test(String(housingSerial)), `serial ${housingSerial}`);
    return housingSerial;
  });

  await check('SEAMROUTES', 'housing edit: lower rent and beds', async () => {
    expect(housingId, 'no post');
    const read = await get(jars.sana, `/api/housing/posts/${housingId}`);
    expectStatus(read, 200, 'GET housing post');
    expect(read.data?.item?.serial === housingSerial, `serial ${read.data?.item?.serial}`);
    const lower = await patch(jars.sana, `/api/housing/posts/${housingId}`, { action: 'lower_price', rentPp: 7500 });
    expectStatus(lower, 200, 'lower_price');
    expect(lower.data?.item?.rentPp === 7500, `rent ${lower.data?.item?.rentPp}`);
    const beds = await patch(jars.sana, `/api/housing/posts/${housingId}`, { action: 'beds', bedsLeft: 2 });
    expectStatus(beds, 200, 'beds');
    expect(beds.data?.item?.bedsLeft === 2, `beds ${beds.data?.item?.bedsLeft}`);
    const other = await patch(jars.kabir, `/api/housing/posts/${housingId}`, { action: 'close' });
    expectStatus(other, 403, 'close by someone else');
  });

  // ---- SEAMROUTES: save, share and report on v2 collections -----------------

  for (const [type, id, path] of [
    ['marketplace', 'mkt-drawing-board', '/api/marketplace/listings/mkt-drawing-board'],
    ['housing', 'hsg-pg-falcon', '/api/housing/posts/hsg-pg-falcon'],
  ]) {
    await check('SEAMROUTES', `save and unsave a ${type} post`, async () => {
      const save = await post(jars.sana, '/api/campus/actions', { action: 'save', contentType: type, contentId: id });
      expectStatus(save, 200, 'save');
      const saved = await get(jars.sana, path);
      expectStatus(saved, 200, 'GET post');
      expect(saved.data?.item?.isSaved === true, 'not saved');
      const unsave = await post(jars.sana, '/api/campus/actions', { action: 'unsave', contentType: type, contentId: id });
      expectStatus(unsave, 200, 'unsave');
      const after = await get(jars.sana, path);
      expect(after.data?.item?.isSaved === false, 'still saved');
      const missing = await post(jars.sana, '/api/campus/actions', { action: 'save', contentType: type, contentId: 'no-such-post' });
      expectStatus(missing, 404, 'save a missing post');
    });

    await check('SEAMROUTES', `report a ${type} post once`, async () => {
      const report = await post(jars.ananya, '/api/campus/actions', { action: 'report', contentType: type, contentId: id, reason: 'Smoke test report' });
      expectStatus(report, 200, 'report');
      const again = await post(jars.ananya, '/api/campus/actions', { action: 'report', contentType: type, contentId: id, reason: 'Smoke test report' });
      expectStatus(again, 409, 'second report');
      const noReason = await post(jars.kabir, '/api/campus/actions', { action: 'report', contentType: type, contentId: id });
      expectStatus(noReason, 400, 'report without a reason');
    });
  }

  await check('SEAMROUTES', 'share links open the post', async () => {
    expect(marketId && housingId, 'no posts to share');
    for (const path of [`/marketplace/${marketId}`, `/housing/${housingId}`]) {
      const response = await get(jars.kabir, path);
      expectStatus(response, 200, path);
      const markers = markersIn(response.text);
      expect(markers.length === 0, `${path}: Next error markers: ${markers.join(', ')}`);
    }
  });

  // ---- CONTACT --------------------------------------------------------------

  let askId = null;
  await check('CONTACT', 'create an ask on a listing', async () => {
    const response = await post(jars.kabir, '/api/contact-requests', { contentType: 'marketplace', contentId: 'mkt-study-lamp' });
    expectStatus(response, 201, 'POST /api/contact-requests');
    expect(response.data?.status === 'pending', `status ${response.data?.status}`);
    expect(response.data?.intent === 'ask', `intent ${response.data?.intent}`);
    askId = response.data.id;
    const repeat = await post(jars.kabir, '/api/contact-requests', { contentType: 'marketplace', contentId: 'mkt-study-lamp' });
    expectStatus(repeat, 200, 'second ask');
    const own = await post(jars.sana, '/api/contact-requests', { contentType: 'marketplace', contentId: 'mkt-study-lamp' });
    expectStatus(own, 409, 'ask on your own post');
    return askId;
  });

  await check('CONTACT', 'seller list shows seeded and new asks', async () => {
    const response = await get(jars.sana, '/api/contact-requests?role=seller');
    expectStatus(response, 200, 'GET seller asks');
    const ids = (response.data?.items ?? []).map((item) => item.id);
    expect(ids.includes('cr-calculator-kabir'), `seeded ask missing (got ${ids.join(', ') || 'none'})`);
    expect(askId && ids.includes(askId), 'new ask missing');
    const buyer = await get(jars.kabir, '/api/contact-requests?role=buyer');
    expectStatus(buyer, 200, 'GET buyer asks');
    const buyerIds = (buyer.data?.items ?? []).map((item) => item.id);
    expect(buyerIds.includes('cr-mattress-kabir'), `seeded sent ask missing (got ${buyerIds.join(', ') || 'none'})`);
    const sent = await get(jars.sana, '/api/contact-requests?role=buyer');
    expect((sent.data?.items ?? []).some((item) => item.id === 'cr-roommate-sana'), "Sana's seeded housing ask missing");
    return `${ids.length} received`;
  });

  await check('CONTACT', 'seller approves; buyer gets the WhatsApp link', async () => {
    expect(askId, 'no ask');
    const stranger = await patch(jars.ananya, `/api/contact-requests/${askId}`, { action: 'approve' });
    expectStatus(stranger, 404, 'approve by someone else');
    const approve = await patch(jars.sana, `/api/contact-requests/${askId}`, { action: 'approve' });
    expectStatus(approve, 200, 'approve the new ask');
    const seeded = await patch(jars.sana, '/api/contact-requests/cr-calculator-kabir', { action: 'approve' });
    expectStatus(seeded, 200, 'approve the seeded ask');
    const buyer = await get(jars.kabir, '/api/contact-requests?role=buyer');
    const items = buyer.data?.items ?? [];
    for (const id of [askId, 'cr-calculator-kabir']) {
      const item = items.find((entry) => entry.id === id);
      expect(item?.status === 'approved', `${id} is ${item?.status ?? 'missing'}`);
      expect(typeof item.whatsappUrl === 'string' && item.whatsappUrl.startsWith('https://wa.me/'), `${id} has no WhatsApp link`);
    }
    const twice = await patch(jars.sana, `/api/contact-requests/${askId}`, { action: 'decline' });
    expectStatus(twice, 409, 'decide twice');
  });

  await check('CONTACT', 'housing ask: create and decline', async () => {
    const response = await post(jars.kabir, '/api/contact-requests', { contentType: 'housing', contentId: housingId ?? 'hsg-pg-falcon' });
    expectStatus(response, 201, 'POST housing ask');
    const owner = housingId ? jars.sana : null;
    if (owner) {
      const decline = await patch(owner, `/api/contact-requests/${response.data.id}`, { action: 'decline' });
      expectStatus(decline, 200, 'decline');
      const again = await post(jars.kabir, '/api/contact-requests', { contentType: 'housing', contentId: housingId });
      expectStatus(again, 409, 'ask again after a decline');
    }
  });

  await check('CONTACT', 'reserved post answers 409', async () => {
    const response = await post(jars.sana, '/api/contact-requests', { contentType: 'marketplace', contentId: 'mkt-mattress' });
    expectStatus(response, 409, 'ask on a reserved post');
  });

  await check('CONTACT', 'wanted post stores an offer', async () => {
    const response = await post(jars.sana, '/api/contact-requests', { contentType: 'marketplace', contentId: 'mkt-wanted-cycle' });
    expectStatus(response, 201, 'offer on a wanted post');
    expect(response.data?.intent === 'offer', `intent ${response.data?.intent}`);
    const sent = await get(jars.sana, '/api/contact-requests?role=buyer');
    const item = (sent.data?.items ?? []).find((entry) => entry.id === response.data.id);
    expect(item?.intent === 'offer', `listed intent ${item?.intent}`);
  });

  await check('CONTACT', 'unverified student cannot ask', async () => {
    const response = await post(jars.meera, '/api/contact-requests', { contentType: 'marketplace', contentId: 'mkt-drawing-board' });
    expectStatus(response, 403, 'ask as Meera');
  });

  // ---- NTF ------------------------------------------------------------------

  await check('NTF', 'inbox GET and PATCH mark read', async () => {
    const inbox = await get(jars.sana, '/api/campus/notifications');
    expectStatus(inbox, 200, 'GET notifications');
    const items = inbox.data?.notifications ?? [];
    expect(items.length > 0, 'inbox is empty');
    const now = Date.now();
    expect(items.every((item) => Date.parse(item.deliverAfter) <= now), 'a future item is showing');
    const unread = items.find((item) => !item.read);
    expect(unread, 'no unread item');
    const before = inbox.data.unread;
    const mark = await patch(jars.sana, '/api/campus/notifications', { ids: [unread.id] });
    expectStatus(mark, 200, 'PATCH notifications');
    expect(mark.data?.updated === 1, `updated ${mark.data?.updated}`);
    const after = await get(jars.sana, '/api/campus/notifications');
    expect(after.data?.notifications?.find((item) => item.id === unread.id)?.read === true, 'still unread');
    expect(after.data?.unread === before - 1, `unread ${after.data?.unread}, was ${before}`);
    const foreign = await patch(jars.kabir, '/api/campus/notifications', { ids: [unread.id] });
    expect(foreign.status === 200 && foreign.data?.updated === 0, "Kabir changed Sana's item");
    const bad = await patch(jars.sana, '/api/campus/notifications', { ids: [] });
    expectStatus(bad, 400, 'PATCH with no ids');
    return `${items.length} items`;
  });

  await check('NTF', 'a new ask lands in the seller inbox', async () => {
    const inbox = await get(jars.sana, '/api/campus/notifications');
    const found = (inbox.data?.notifications ?? []).some((item) => item.kind === 'contact_request' && item.ref?.id === askId);
    if (found) return 'in the inbox now';
    // Normal items wait for the next 12:30 or 19:30 IST slot, and the inbox hides
    // them until then. So the item must be queued in the world for a later slot.
    const read = await post(jars.sana, '/api/demo/firestore', {
      op: 'read',
      targets: [{ kind: 'query', path: 'notifications', filters: [], orders: [], limit: null, limitToLast: null }],
    });
    expectStatus(read, 200, 'read notifications');
    const queued = (read.data?.results?.[0]?.docs ?? []).find(
      (doc) => doc.data?.userId === 'verified-kju-main' && doc.data?.kind === 'contact_request' && doc.data?.ref?.id === askId,
    );
    expect(queued, "Kabir's ask was never queued for Sana");
    const deliverMs = (queued.data.deliverAfter?.seconds ?? 0) * 1000;
    expect(deliverMs > Date.now(), 'queued item is due but missing from the inbox');
    const slot = new Date(deliverMs).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    return `queued for the ${slot} IST slot`;
  });

  await check('NTF', 'signed out inbox is 401', async () => {
    const response = await get(jars.out, '/api/campus/notifications');
    expectStatus(response, 401, 'GET notifications signed out');
  });

  // ---- GAMES ----------------------------------------------------------------

  await check('GAMES', 'join drops the free seats', async () => {
    const list = await get(jars.ananya, '/api/campus/games');
    expectStatus(list, 200, 'GET games');
    const before = (list.data?.games ?? []).find((game) => game.id === 'game-football-open');
    expect(before, 'football game missing');
    const join = await patch(jars.ananya, '/api/campus/games/game-football-open', { action: 'join' });
    expectStatus(join, 200, 'join');
    const after = join.data?.game;
    expect(after?.joined === true, 'not joined');
    expect(after.slotsLeft === before.slotsLeft - 1 && after.joinedCount === before.joinedCount + 1, `seats left ${before.slotsLeft} to ${after.slotsLeft}`);
    const twice = await patch(jars.ananya, '/api/campus/games/game-football-open', { action: 'join' });
    expectStatus(twice, 409, 'join twice');
    const leave = await patch(jars.ananya, '/api/campus/games/game-football-open', { action: 'leave' });
    expectStatus(leave, 200, 'leave');
    expect(leave.data?.game?.slotsLeft === before.slotsLeft, 'leave did not free a seat');
    return `${before.slotsLeft} seats left, then ${after.slotsLeft}`;
  });

  await check('GAMES', 'full game answers Full', async () => {
    const list = await get(jars.sana, '/api/campus/games');
    const full = (list.data?.games ?? []).find((game) => game.id === 'game-badminton-full');
    expect(full, 'badminton game missing');
    expect(full.full === true && full.slotsLeft === 0 && full.canJoin === false, `full ${full.full}, ${full.slotsLeft} left`);
    const join = await patch(jars.sana, '/api/campus/games/game-badminton-full', { action: 'join' });
    expectStatus(join, 409, 'join a full game');
  });

  await check('GAMES', 'other campus game is hidden; Meera is gated', async () => {
    const other = await patch(jars.sana, '/api/campus/games/game-chess-airport', { action: 'join' });
    expectStatus(other, 404, 'join a game on another campus');
    const meera = await get(jars.meera, '/api/campus/games');
    expectStatus(meera, 403, 'GET games as Meera');
  });

  // ---- LOST -----------------------------------------------------------------

  await check('LOST', 'ID card post is redacted for others', async () => {
    const list = await get(jars.sana, '/api/campus/lost-found');
    expectStatus(list, 200, 'GET lost-found');
    const card = (list.data?.items ?? []).find((item) => item.id === 'lf-id-card');
    expect(card, 'ID card post missing');
    expect(card.redacted === true, 'ID card post not redacted');
    expect(card.title !== 'Found a KJU ID card near the library', 'ID card title shown in full');
    expect(card.title.startsWith('ID card'), `title '${card.title}' is not the generic one`);
    expect(Array.isArray(card.images) && card.images.length === 0, 'photos shown');
    expect(!/\d{4,}|@/.test(`${card.title} ${card.description ?? ''}`), 'numbers or emails shown');
    expect(!('contact' in card) || card.contact === null, 'contact shown before approval');
    expect(!('claimAnswer' in card) || card.claimAnswer === null, 'claim answer shown');
    return `${list.data.items.length} open posts`;
  });

  await check('LOST', 'claim sent and approved', async () => {
    const claim = await patch(jars.ananya, '/api/campus/lost-found/lf-keys', { action: 'claim', answer: 'Red keychain, three keys' });
    expectStatus(claim, 200, 'claim');
    expect(claim.data?.item?.myClaim?.status === 'pending', `claim is ${claim.data?.item?.myClaim?.status}`);
    const twice = await patch(jars.ananya, '/api/campus/lost-found/lf-keys', { action: 'claim', answer: 'Again' });
    expectStatus(twice, 409, 'claim twice');
    const own = await patch(jars.sana, '/api/campus/lost-found/lf-keys', { action: 'claim', answer: 'Mine' });
    expectStatus(own, 403, 'claim your own post');
    const owner = await get(jars.sana, '/api/campus/lost-found');
    const post = (owner.data?.items ?? []).find((item) => item.id === 'lf-keys');
    const claims = Array.isArray(post?.claims) ? post.claims : Object.values(post?.claims ?? {});
    const pending = claims.find((item) => item.status === 'pending');
    expect(pending?.id, 'owner does not see the claim');
    const approve = await patch(jars.sana, '/api/campus/lost-found/lf-keys', { action: 'approve_claim', claimId: pending.id });
    expectStatus(approve, 200, 'approve_claim');
    const after = await get(jars.ananya, '/api/campus/lost-found');
    const mine = (after.data?.items ?? []).find((item) => item.id === 'lf-keys');
    expect(mine?.myClaim?.status === 'approved', `claim is ${mine?.myClaim?.status} after approval`);
  });

  await check('LOST', 'claim on the ID card post', async () => {
    const claim = await patch(jars.sana, '/api/campus/lost-found/lf-id-card', { action: 'claim', answer: 'It is mine, BCom second year' });
    expectStatus(claim, 200, 'claim the ID card');
    expect(claim.data?.item?.redacted === true, 'ID card unredacted before approval');
  });

  // ---- Blood ----------------------------------------------------------------

  await check('BLOOD', 'opt in and out', async () => {
    const optIn = await post(jars.kabir, '/api/campus/blood', { action: 'opt_in', group: 'O+', consent: true });
    expectStatus(optIn, 200, 'opt_in');
    expect(optIn.data?.me?.optedIn === true && optIn.data.me.bloodGroup === 'O+', 'not opted in');
    const noConsent = await post(jars.kabir, '/api/campus/blood', { action: 'opt_in', group: 'O+', consent: false });
    expectStatus(noConsent, 400, 'opt_in without consent');
    const view = await get(jars.kabir, '/api/campus/blood');
    expectStatus(view, 200, 'GET blood');
    expect(view.data?.me?.optedIn === true, 'GET says not opted in');
    const sana = await get(jars.sana, '/api/campus/blood');
    expect((sana.data?.requests ?? []).some((item) => item.id === 'blood-open'), 'open B+ request missing');
    const meera = await get(jars.meera, '/api/campus/blood');
    expectStatus(meera, 403, 'GET blood as Meera');
  });

  // ---- Deals ----------------------------------------------------------------

  await check('DEAL', 'deals by distance; Meera gets 403', async () => {
    const response = await get(jars.sana, '/api/campus/student-deals');
    expectStatus(response, 200, 'GET deals');
    const deals = response.data?.deals ?? [];
    expect(deals.length > 0, 'no deals');
    const distances = deals.map((deal) => deal.distanceM).filter((value) => typeof value === 'number');
    expect(distances.length > 0, 'no distances');
    expect(distances.every((value, index) => index === 0 || value >= distances[index - 1]), `not nearest first: ${distances.join(', ')}`);
    expect(deals.every((deal) => deal.sample === true), 'a deal is not marked as sample data');
    const meera = await get(jars.meera, '/api/campus/student-deals');
    expectStatus(meera, 403, 'GET deals as Meera');
    return `${deals.length} deals`;
  });

  // ---- COPY: account deletion confirm --------------------------------------

  await check('COPY', 'deletion confirm is case-insensitive', async () => {
    const wrong = await post(jars.ananya, '/api/users/me/deletion-request', { confirmation: 'delete account' });
    expectStatus(wrong, 400, 'wrong phrase');
    const mixed = await post(jars.ananya, '/api/users/me/deletion-request', { confirmation: '  Delete My ACCOUNT ' });
    expectStatus(mixed, 200, 'mixed case phrase');
    const out = await post(jars.out, '/api/users/me/deletion-request', { confirmation: 'delete my account' });
    expectStatus(out, 401, 'signed out');
  });

  // ---- CRON -----------------------------------------------------------------

  await check('CRON', 'campus maintenance with the cron value', async () => {
    const none = await get(jars.out, '/api/internal/campus-maintenance');
    expectStatus(none, 403, 'no token');
    const wrong = await get(jars.out, '/api/internal/campus-maintenance', { headers: { authorization: 'Bearer wrong' } });
    expectStatus(wrong, 403, 'wrong token');
    const response = await get(jars.out, '/api/internal/campus-maintenance', { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expectStatus(response, 200, 'GET with the cron value');
    expect(response.data?.ok === true, 'not ok');
    expect(response.data?.lifecycle && typeof response.data.lifecycle === 'object', 'no lifecycle counts');
    return `${response.data.updatedRecords} updated, ${response.data.expiredEphemeralRecords} removed`;
  });

  await check('CRON', 'world still answers after maintenance', async () => {
    const feed = await get(jars.sana, '/api/marketplace/listings');
    expectStatus(feed, 200, 'GET feed');
    expect((feed.data?.items ?? []).length > 0, 'feed empty after maintenance');
  });

  // ---- Demo only routes ------------------------------------------------------

  // Last: drops this run's world so the server does not keep it.
  await check('DEMO', 'reset drops the world and signs out', async () => {
    const jar = newJar('reset');
    jar.cookies.set(SESSION_COOKIE, sessionValue(PERSONAS.sana));
    const response = await post(jar, '/api/demo/reset', {});
    expectStatus(response, 200, 'POST /api/demo/reset');
    expect(jar.cookies.get(VISITOR_COOKIE) !== VISITOR, 'same visitor id after reset');
    expect(!jar.cookies.has(SESSION_COOKIE), 'still signed in after reset');
  });

  const failed = results.filter((result) => !result.ok).length;
  console.log(`[smoke] ${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
