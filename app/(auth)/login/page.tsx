'use client';

export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { SignIn } from '@clerk/nextjs';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';
import { AuthShell } from '@/components/auth/AuthShell';
import { clerkAppearance } from '@/components/auth/clerkAppearance';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectPath(searchParams?.get('redirect_url'));
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(redirect);
    }
  }, [isLoaded, isSignedIn, redirect, router]);

  return (
    <AuthShell>
      {/* Clerk's header (title + subtitle) is the hero, so it can follow each sign-in step. */}
      <SignIn
        routing="hash"
        appearance={clerkAppearance}
        signUpUrl={`/register?redirect_url=${encodeURIComponent(redirect)}`}
        afterSignInUrl={`/sso-callback?redirect_url=${encodeURIComponent(redirect)}`}
        afterSignUpUrl={`/sso-callback?redirect_url=${encodeURIComponent(redirect)}`}
      />
    </AuthShell>
  );
}
