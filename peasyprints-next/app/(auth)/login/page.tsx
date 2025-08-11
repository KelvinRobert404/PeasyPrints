'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useEffect, useState } from 'react';
import { PhoneLogin } from '@/components/auth/PhoneLogin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  const { loginWithEmail, loading, error, sendPasswordReset, registerWithEmail, resetRecaptcha } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    return () => {
      // cleanup recaptcha for this page instance
      resetRecaptcha('recaptcha-container-login');
    };
  }, [resetRecaptcha]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Login</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign in with Clerk</CardTitle>
          </CardHeader>
          <CardContent>
            <SignIn routing="hash" afterSignInUrl="/dashboard" signUpUrl="/register" />
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-500">OR</div>
        <Card>
          <CardHeader>
            <CardTitle>Phone Login</CardTitle>
          </CardHeader>
          <CardContent>
            <PhoneLogin />
          </CardContent>
        </Card>
      </main>
      <BottomNavigation />
    </div>
  );
}
