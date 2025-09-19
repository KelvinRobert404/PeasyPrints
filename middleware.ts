import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/upload(.*)',
  '/orders(.*)',
  '/shops(.*)',
  '/shopfront(.*)',
  '/login(.*)',
  '/register(.*)',
  '/sso-callback(.*)',
  '/otp'
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname, searchParams } = req.nextUrl;
  const { userId } = await auth();

  // Allow static assets through without auth checks
  const isStaticAssetRequest =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico' ||
    /\.(png|jpg|jpeg|gif|svg|webp|avif|ico)$/.test(pathname);
  if (isStaticAssetRequest) {
    return NextResponse.next();
  }

  // If already signed in and visiting /login, bounce to intended target
  if (pathname.startsWith('/login') && userId) {
    const target = searchParams.get('redirect_url') || '/';
    req.nextUrl.pathname = target || '/';
    req.nextUrl.search = '';
    return NextResponse.redirect(req.nextUrl);
  }

  // Allow Razorpay webhook to pass without auth (it uses its own signature verification)
  if (pathname.startsWith('/api/razorpay/webhook')) {
    return NextResponse.next();
  }

  // Allow PostHog ingest/proxy endpoints to pass without auth
  if (pathname.startsWith('/ingest')) {
    return NextResponse.next();
  }

  // Allow announcements API for signed-out users
  if (pathname.startsWith('/api/announcements')) {
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
    '/((?!.+\.[\w]+$|_next|images|fonts|sw\.js|manifest\.json|favicon\.ico).*)',
    '/(api|trpc)(.*)'
  ]
};


