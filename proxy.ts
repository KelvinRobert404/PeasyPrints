import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { isFixtureMode } from '@/lib/firebase/fixtureMode';
import { DEMO_VISITOR_COOKIE } from '@/lib/demo/contract';
import { isDemoMode } from '@/lib/demo/mode';
import { isAllowedOrigin } from '@/lib/utils/origin';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';

// Next.js 16 runs this file as the request proxy (formerly middleware).
const isPublicRoute = createRouteMatcher([
  '/',
  '/upload(.*)',
  '/orders(.*)',
  '/shops(.*)',
  '/shopfront(.*)',
  '/login(.*)',
  '/register(.*)',
  '/sso-callback(.*)',
  '/about(.*)',
  '/privacy',
  '/terms',
  // Shop owners sign in with Firebase, not Clerk, and need the helper download page.
  '/helper',
  // Support must stay reachable for signed-out users (e.g. after a failed payment).
  '/contact',
  // Demo mode only: the demo's own pages (start, not-included) need no sign-in.
  ...(isDemoMode() ? ['/demo(.*)'] : [])
]);

// Unsafe /api methods must come from an allowed origin, except routes that
// verify their own signature or token.
function rejectCrossOriginApiWrite(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const unsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const usesIndependentSignature = pathname.startsWith('/api/razorpay/webhook') || pathname.startsWith('/api/internal/');
  if (unsafeMethod && pathname.startsWith('/api/') && !usesIndependentSignature) {
    const fetchSite = req.headers.get('sec-fetch-site');
    const validOrigin = isAllowedOrigin(req.url, req.headers.get('origin'), req.headers.get('x-forwarded-host'), req.headers.get('x-forwarded-proto'));
    if (fetchSite === 'cross-site' || !validOrigin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  return null;
}

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/sounds') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico' ||
    /\.(png|jpg|jpeg|gif|svg|webp|avif|ico|mp3|wav|ogg|js|mjs|css|otf|ttf|woff2?)$/.test(pathname)
  );
}

// Market "see all" pages: an unknown section is a real 404, not a 200 page that
// renders not-found inside the streamed loading shell. Keep in step with MARKET_SECTIONS.
const MARKET_SEE_ALL = /^\/(?:girls-space\/)?marketplace\/all\/([^/]+)\/?$/;
const MARKET_SECTION_IDS: ReadonlySet<string> = new Set(['clearing-out', 'seats', 'near-you', 'wanted']);

function unknownMarketSection(req: NextRequest): NextResponse | null {
  const match = MARKET_SEE_ALL.exec(req.nextUrl.pathname);
  if (!match || MARKET_SECTION_IDS.has(match[1])) return null;
  // Rewrite to a path with no route, so Next renders its not-found page with a 404 status.
  return NextResponse.rewrite(new URL('/_swoop/not-found', req.url));
}

const clerkProxy = clerkMiddleware(async (auth, req) => {
  const { pathname, searchParams } = req.nextUrl;
  const { userId } = await auth();

  const rejected = rejectCrossOriginApiWrite(req);
  if (rejected) return rejected;

  // Allow static assets through without auth checks
  if (isStaticAssetPath(pathname)) {
    return NextResponse.next();
  }

  // If already signed in and visiting /login, bounce to intended target
  if (pathname.startsWith('/login') && userId) {
    // Parse as a URL so a target with a query string isn't encoded into the pathname.
    const target = safeRedirectPath(searchParams.get('redirect_url'));
    return NextResponse.redirect(new URL(target, req.url));
  }

  // Allow Razorpay webhook to pass without auth (it uses its own signature verification)
  if (pathname.startsWith('/api/razorpay/webhook')) {
    return NextResponse.next();
  }

  // Allow PostHog proxy endpoints to pass without auth
  if (pathname.startsWith('/ph')) {
    return NextResponse.next();
  }

  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // Shop logos are public storefront assets; uploads are authenticated in the route.
  if (pathname.startsWith('/api/shops/') && pathname.endsWith('/logo')) {
    return NextResponse.next();
  }

  // This endpoint intentionally reports a signed-out campus session to the home UI.
  if (pathname === '/api/campus/session') {
    return NextResponse.next();
  }

  // Allow print-jobs API (it validates with its own Bearer token)
  if (pathname.startsWith('/api/print-jobs')) {
    return NextResponse.next();
  }

  // The compositor authenticates these endpoints with its own shared worker token.
  if (pathname.startsWith('/api/internal/render-jobs')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/internal/campus-users')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/internal/campus-maintenance')) {
    return NextResponse.next();
  }

  // API handlers return JSON 401/403 responses themselves. Avoid turning an
  // expired client session into an HTML sign-in redirect inside fetch().
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (!isPublicRoute(req)) {
    if (!userId) {
      const signInUrl = new URL('/login', req.url);
      signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(signInUrl);
    }
  }

  // After the sign-in bounce, so signed-out visitors still go to /login first.
  return unknownMarketSection(req) ?? undefined;
});

// ---------------------------------------------------------------------------
// Demo mode (dev only, `npm run demo`). The demo build aliases @clerk/nextjs/server
// to src/lib/demo/shims/clerk-server.ts, so clerkProxy above runs on the demo
// session cookie and its login bounce and redirect_url logic stay as they are.

const DEMO_VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
// Same shape the demo world accepts (src/lib/demo/server/world.ts).
const DEMO_VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// Areas the demo leaves out: shop owner tools and the admin console.
const DEMO_EXCLUDED_AREA = /^\/(godview|shopfront)(?:\/|$)/;

function isDemoPath(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/');
}

/** A browser page load: not an API call, an asset or a demo page. */
function isDemoPageRequest(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (pathname.startsWith('/api/') || pathname === '/api' || pathname.startsWith('/trpc') || pathname.startsWith('/ph')) return false;
  return !isStaticAssetPath(pathname) && !isDemoPath(pathname);
}

/** The request's Cookie header with the visitor cookie set to id. */
function cookieHeaderWithVisitor(raw: string | null, id: string): string {
  const kept = (raw ?? '')
    .split(';')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0 && pair.split('=')[0].trim() !== DEMO_VISITOR_COOKIE);
  return [...kept, `${DEMO_VISITOR_COOKIE}=${id}`].join('; ');
}

/** Forwards the minted cookie to the app, so this request already reads its own world. */
function forwardVisitorCookie(res: NextResponse, req: NextRequest, id: string): void {
  if (!res.headers.has('x-middleware-next') && !res.headers.has('x-middleware-rewrite')) return;
  const cookie = cookieHeaderWithVisitor(req.headers.get('cookie'), id);
  const existing = res.headers.get('x-middleware-override-headers');
  if (existing !== null) {
    const keys = existing.split(',').map((key) => key.trim()).filter(Boolean);
    if (!keys.includes('cookie')) keys.push('cookie');
    res.headers.set('x-middleware-override-headers', keys.join(','));
    res.headers.set('x-middleware-request-cookie', cookie);
    return;
  }
  const headers = new Headers(req.headers);
  headers.set('cookie', cookie);
  const template = NextResponse.next({ request: { headers } });
  for (const [key, value] of template.headers) {
    if (key === 'x-middleware-override-headers' || key.startsWith('x-middleware-request-')) res.headers.set(key, value);
  }
}

function setVisitorCookie(res: NextResponse, id: string): void {
  res.cookies.set(DEMO_VISITOR_COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: DEMO_VISITOR_MAX_AGE });
}

async function demoProxy(req: NextRequest, event: NextFetchEvent): Promise<Response> {
  const rejected = rejectCrossOriginApiWrite(req);
  if (rejected) return rejected;

  const { pathname, search } = req.nextUrl;
  const current = req.cookies.get(DEMO_VISITOR_COOKIE)?.value;
  const hasVisitor = typeof current === 'string' && DEMO_VISITOR_ID_PATTERN.test(current);
  const mintedId = hasVisitor ? null : crypto.randomUUID();

  let res: NextResponse;
  if (DEMO_EXCLUDED_AREA.test(pathname)) {
    const area = pathname.startsWith('/godview') ? 'godview' : 'shopfront';
    const url = new URL('/demo/not-included', req.url);
    url.searchParams.set('area', area);
    res = NextResponse.redirect(url);
  } else if (!hasVisitor && isDemoPageRequest(req)) {
    // First visit: start on the demo page, then carry on to where they were going.
    const url = new URL('/demo', req.url);
    url.searchParams.set('next', pathname + search);
    res = NextResponse.redirect(url);
  } else {
    const out = await clerkProxy(req, event);
    // A plain Response may have read-only headers: copy it so the cookie can be added.
    res = !out ? NextResponse.next() : out instanceof NextResponse ? out : new NextResponse(out.body, out);
  }

  if (mintedId) {
    forwardVisitorCookie(res, req, mintedId);
    setVisitorCookie(res, mintedId);
  }
  return res;
}

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Demo mode (dev only): visitor cookie, first-visit start page, areas kept out, demo sign-in.
  if (isDemoMode()) return demoProxy(req, event);
  // Offline fixture mode (dev only): no Clerk. Keep the origin check, let everything else through.
  if (isFixtureMode()) return rejectCrossOriginApiWrite(req) ?? unknownMarketSection(req) ?? NextResponse.next();
  return clerkProxy(req, event);
}

export const config = {
  matcher: [
    // Backslashes must be doubled in a JS string: the previous single-escaped
    // pattern skipped the proxy for any path ending in "w" (/godview, /marketplace/new).
    '/((?!_next|images|fonts|[^?]*\\.(?:html?|css|js(?!on)|mjs|jpe?g|webp|avif|png|gif|svg|ico|ttf|otf|woff2?|mp3|wav|ogg|txt|xml|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};


