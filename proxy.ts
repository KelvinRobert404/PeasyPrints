import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
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
  '/otp',
  '/about(.*)',
  '/privacy',
  '/terms',
  // Shop owners sign in with Firebase, not Clerk, and need the helper download page.
  '/helper',
  // Support must stay reachable for signed-out users (e.g. after a failed payment).
  '/contact'
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname, searchParams } = req.nextUrl;
  const { userId } = await auth();

  const unsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const usesIndependentSignature = pathname.startsWith('/api/razorpay/webhook') || pathname.startsWith('/api/internal/');
  if (unsafeMethod && pathname.startsWith('/api/') && !usesIndependentSignature) {
    const fetchSite = req.headers.get('sec-fetch-site');
    const validOrigin = isAllowedOrigin(req.url, req.headers.get('origin'), req.headers.get('x-forwarded-host'), req.headers.get('x-forwarded-proto'));
    if (fetchSite === 'cross-site' || !validOrigin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  // Allow static assets through without auth checks
  const isStaticAssetRequest =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/sounds') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico' ||
    /\.(png|jpg|jpeg|gif|svg|webp|avif|ico|mp3|wav|ogg|js|mjs|css|otf|ttf|woff2?)$/.test(pathname);
  if (isStaticAssetRequest) {
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

  // Allow announcements API for signed-out users
  if (pathname.startsWith('/api/announcements')) {
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
});

export const config = {
  matcher: [
    // Backslashes must be doubled in a JS string: the previous single-escaped
    // pattern skipped the proxy for any path ending in "w" (/godview, /marketplace/new).
    '/((?!_next|images|fonts|[^?]*\\.(?:html?|css|js(?!on)|mjs|jpe?g|webp|avif|png|gif|svg|ico|ttf|otf|woff2?|mp3|wav|ogg|txt|xml|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};


