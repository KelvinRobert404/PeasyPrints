'use client';

export const dynamic = 'force-dynamic';

import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';
import { SignUp } from '@clerk/nextjs';
import { useEffect } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { clerkAppearance } from '@/components/auth/clerkAppearance';

export default function RegisterPage() {
  const { verificationId, resetRecaptcha } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirectPath(searchParams?.get('redirect_url'));

  useEffect(() => {
    if (verificationId) router.replace('/otp');
  }, [verificationId, router]);

  useEffect(() => {
    return () => {
      // cleanup recaptcha for this page instance
      resetRecaptcha('recaptcha-container-register');
    };
  }, [resetRecaptcha]);

  return (
    <AuthShell>
      {/* Clerk's header (title + subtitle) is the hero, so it can follow each sign-up step. */}
      <SignUp
        routing="hash"
        appearance={clerkAppearance}
        signInUrl={`/login?redirect_url=${encodeURIComponent(redirect)}`}
        afterSignUpUrl={`/sso-callback?redirect_url=${encodeURIComponent(redirect)}`}
      />
    </AuthShell>
  );
}
