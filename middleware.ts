import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/upload(.*)',
  '/orders(.*)',
  '/shops(.*)',
  '/shopfront(.*)',
  '/api/(.*)',
  '/login',
  // no standalone register page; sign-up handled via SSO callback
  '/otp'
]);

export default clerkMiddleware((auth, req) => {
  const { pathname, searchParams } = req.nextUrl;
  const { userId } = auth();

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


