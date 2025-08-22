'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect_url') || '/';
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(redirect);
    }
  }, [isLoaded, isSignedIn, redirect, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Login</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <SignIn forceRedirectUrl={redirect} signUpUrl="/register" />
          </CardContent>
        </Card>
      </main>
      <BottomNavigation />
    </div>
  );
}
