"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSignIn, useSignUp, useAuth } from '@clerk/nextjs';

export default function SsoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect_url') || '/';
  const { isSignedIn } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  useEffect(() => {
    if (isSignedIn) {
      router.replace(redirect);
      return;
    }
    if (!signInLoaded || !signUpLoaded) return;
    (async () => {
      try {
        const res = await signIn.handleRedirectCallback();
        if (res?.createdSessionId) {
          await setActive({ session: res.createdSessionId });
          router.replace(redirect);
          return;
        }
      } catch {}
      try {
        const res = await signUp.handleRedirectCallback();
        if ((res as any)?.createdSessionId) {
          await setActive({ session: (res as any).createdSessionId });
          router.replace(redirect);
          return;
        }
      } catch {}
      router.replace('/login?redirect_url=' + encodeURIComponent(redirect));
    })();
  }, [isSignedIn, signInLoaded, signUpLoaded, signIn, signUp, setActive, router, redirect]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-600">Finishing sign in…</p>
    </div>
  );
}


