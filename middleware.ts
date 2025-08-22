import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/upload(.*)',
  '/shops(.*)',
  '/api/(.*)',
  '/login',
  '/register',
  '/otp'
]);

export default clerkMiddleware((auth, req) => {
  const { pathname, searchParams } = req.nextUrl;
  const { userId } = auth();

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
    '/((?!.+\.[\w]+$|_next).*)',
    '/(api|trpc)(.*)'
  ]
};


