"use client";
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { usePathname, useRouter } from 'next/navigation';
import { usePosthog } from '@/hooks/usePosthog';
import { useUploadStore } from '@/lib/stores/uploadStore';

async function mintFirebaseToken(): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('/api/auth/firebase-custom-token', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.token) return data.token as string;
      if (res.status === 401) return null;
    } catch { }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { capture } = usePosthog();
  const clerkUserId = clerkUser?.id ?? null;

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

  // Keep the Firebase session (used for Firestore/Storage) in lockstep with Clerk.
  // Only Clerk-bridged sessions are managed here: they come from custom tokens and
  // have no sign-in providers. Shopfront owners sign in to Firebase directly with
  // email/password, and those sessions are left alone.
  useEffect(() => {
    if (!isClerkLoaded) return;
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      if (cancelled) return;
      const current = auth.currentUser;
      const isBridged = Boolean(current && current.providerData.length === 0);

      if (!clerkUserId) {
        // Signed out of Clerk: drop the bridged session so the next person to sign
        // in on this device never runs Firestore as the previous user.
        if (current && isBridged) {
          await signOut(auth).catch(() => undefined);
          useUploadStore.getState().reset();
        }
        return;
      }
      if (current && (!isBridged || current.uid === clerkUserId)) return;

      if (current) {
        await signOut(auth).catch(() => undefined);
        useUploadStore.getState().reset();
      }
      const token = await mintFirebaseToken();
      if (cancelled || !token) return;
      try {
        await signInWithCustomToken(auth, token);
        // Upsert user doc to mirror Flutter _processAfterSignIn
        await fetch('/api/users/upsert', { method: 'POST' });
        capture('feature_flag_ready', { userId: clerkUserId });
      } catch {
        // The user stays signed in with Clerk only; Firestore-backed views will retry on next load.
      }
    })();
    return () => { cancelled = true; };
  }, [isClerkLoaded, clerkUserId]);

  useEffect(() => {
    if (!mounted || !isClerkLoaded) return;
    if (isProtectedRoute && !isSignedIn) {
      const params = new URLSearchParams();
      params.set('redirect_url', `${pathname || '/'}${window.location.search}`);
      router.replace(`/login?${params.toString()}`);
    }
  }, [mounted, isClerkLoaded, isProtectedRoute, isSignedIn, pathname, router]);

  if (!mounted) return null;
  return <>{children}</>;
}
