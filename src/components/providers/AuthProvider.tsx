"use client";
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAuth, useUser } from '@clerk/nextjs';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { usePathname, useRouter } from 'next/navigation';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { initialized, setUser } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const [bridgeAttempted, setBridgeAttempted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthRoute = useMemo(() => {
    return pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/otp');
  }, [pathname]);

  const isProtectedRoute = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname === '/shops' ||
      pathname.startsWith('/shops') ||
      pathname === '/orders' ||
      pathname === '/profile' ||
      pathname.startsWith('/upload')
    );
  }, [pathname]);

  useEffect(() => setMounted(true), []);

  // Bridge Clerk user to Firebase via custom token so existing Firestore/Storage usage continues to work
  useEffect(() => {
    if (!isClerkLoaded || bridgeAttempted) return;
    const current = useAuthStore.getState().user;
    if (clerkUser && !current) {
      setBridgeAttempted(true);
      (async () => {
        try {
          const res = await fetch('/api/auth/firebase-custom-token', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          const token = data?.token;
          if (token) {
            await signInWithCustomToken(auth, token);
          }
          // Upsert user doc to mirror Flutter _processAfterSignIn
          await fetch('/api/users/upsert', { method: 'POST' });
        } catch {
          // swallow; user stays signed in with Clerk only
        }
      })();
    }
  }, [isClerkLoaded, clerkUser, bridgeAttempted]);

  useEffect(() => {
    if (!mounted || !isClerkLoaded) return;
    if (isProtectedRoute && !isSignedIn) {
      const params = new URLSearchParams();
      params.set('redirect_url', pathname || '/');
      router.replace(`/login?${params.toString()}`);
    }
  }, [mounted, isClerkLoaded, isProtectedRoute, isSignedIn, pathname, router]);

  if (!mounted) return null;
  return <>{children}</>;
}
