"use client";
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { usePathname, useRouter } from 'next/navigation';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { user, initialized } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthRoute = useMemo(() => {
    return pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/otp');
  }, [pathname]);

  const isProtectedRoute = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname === '/dashboard' ||
      pathname === '/orders' ||
      pathname === '/profile' ||
      pathname.startsWith('/upload')
    );
  }, [pathname]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !initialized) return;
    if (isProtectedRoute && !user) {
      router.replace('/login');
      return;
    }
    if (isAuthRoute && user) {
      router.replace('/dashboard');
    }
  }, [mounted, initialized, isProtectedRoute, isAuthRoute, user, router]);

  if (!mounted) return null;
  return <>{children}</>;
}
