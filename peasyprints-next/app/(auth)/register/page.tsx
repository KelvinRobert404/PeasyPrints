'use client';

export const dynamic = 'force-dynamic';

import { useAuthStore } from '@/lib/stores/authStore';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneRegister } from '@/components/auth/PhoneRegister';
import { useEffect } from 'react';

export default function RegisterPage() {
  const { verificationId, resetRecaptcha } = useAuthStore();
  const router = useRouter();

  if (verificationId) router.replace('/otp');

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
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
          </CardHeader>
          <CardContent>
            <PhoneRegister />
          </CardContent>
        </Card>
      </main>
      <BottomNavigation />
    </div>
  );
}
