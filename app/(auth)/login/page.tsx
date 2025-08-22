'use client';

export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
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
    <div className="relative min-h-screen bg-[#1155EE] flex items-center justify-center px-4">
      <div className="absolute top-6 left-4 md:top-10 md:left-10 text-white">
        <h1 className="text-2xl md:text-5xl font-extrabold leading-tight tracking-tight uppercase">
          Queues suck,
          <br />
          College doesn't.
          <br />
          Lets keep it that way.
        </h1>
      </div>

      <SignIn forceRedirectUrl={redirect} signUpUrl="/register" />

      <div className="pointer-events-none fixed inset-x-0 bottom-3 md:bottom-6 text-center">
        <span className="font-quinn text-white text-[40px] md:text-[30px] font-extrabold tracking-[0.02em]">
          SWOOP
        </span>
      </div>
    </div>
  );
}
