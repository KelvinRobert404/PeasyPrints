'use client';

export const dynamic = 'force-dynamic';

import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneRegister } from '@/components/auth/PhoneRegister';
import { SignUp } from '@clerk/nextjs';
import { useEffect } from 'react';

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
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Register</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Account with Clerk</CardTitle>
          </CardHeader>
          <CardContent>
            <SignUp
              routing="hash"
              signInUrl={`/login?redirect_url=${encodeURIComponent(redirect)}`}
              afterSignUpUrl={`/sso-callback?redirect_url=${encodeURIComponent(redirect)}`}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
