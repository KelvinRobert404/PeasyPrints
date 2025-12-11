"use client";

import { ReactNode } from 'react';
import { SwoopNavbar } from '@/components/layout/SwoopNavbar';
import { usePathname } from 'next/navigation';

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isShopfront = pathname?.startsWith('/shopfront');
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/otp';
  const isPickup = pathname?.startsWith('/orders/') && pathname?.includes('/pickup');

  const isGodview = pathname?.startsWith('/godview');

  if (isShopfront || isGodview) {
    return (
      <div className="min-h-screen bg-gray-100">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-[428px] bg-white shadow-lg min-h-screen flex flex-col">
        {!isAuthPage && !isPickup && <SwoopNavbar />}
        {children}
      </div>
    </div>
  );
}


