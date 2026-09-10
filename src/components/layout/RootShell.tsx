"use client";

import { ReactNode } from 'react';
import { SwoopNavbar } from '@/components/layout/SwoopNavbar';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { usePathname } from 'next/navigation';

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isShopfront = pathname?.startsWith('/shopfront');
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/otp';
  const isPickup = pathname?.startsWith('/orders/') && pathname?.includes('/pickup');

  const isGodview = pathname?.startsWith('/godview');
  // Market + print surfaces own their header (back + title + actions) — no stacked bars.
  const hideNavbar = pathname?.startsWith('/marketplace') || pathname?.startsWith('/girls-space') || pathname?.startsWith('/upload');

  if (isShopfront || isGodview) {
    return (
      <div className="min-h-screen bg-surface">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex justify-center">
      <div className="w-full max-w-[428px] bg-white shadow-lg min-h-screen flex flex-col">
        {!isAuthPage && !isPickup && !hideNavbar && <SwoopNavbar />}
        {children}
        {!isAuthPage && !isPickup && <BottomNavigation />}
      </div>
    </div>
  );
}


