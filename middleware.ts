import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/shops(.*)',
  '/api/(.*)',
  '/login',
  '/register',
  '/otp'
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    const { userId } = auth();
    if (!userId) {
      const signInUrl = new URL('/login', req.url);
      // Optionally send the original path to return after sign-in
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


