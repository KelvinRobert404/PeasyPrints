"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSignIn, useSignUp, useAuth } from '@clerk/nextjs';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';
import { SwoopLogo } from '@/components/swoop/Logo';

export default function SsoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectPath(searchParams?.get('redirect_url'));
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
        const res = await (signIn as any)?.handleRedirectCallback?.();
        if (res?.createdSessionId) {
          await setActive({ session: res.createdSessionId });
          router.replace(redirect);
          return;
        }
      } catch {}
      try {
        const res = await (signUp as any)?.handleRedirectCallback?.();
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
    <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-5">
      <SwoopLogo size={28} className="animate-pulse" />
      <p className="text-[12.5px] font-semibold text-slate">Finishing sign in…</p>
    </div>
  );
}
