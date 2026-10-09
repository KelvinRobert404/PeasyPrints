"use client";

import { ReactNode } from 'react';
import { SwoopNavbar } from '@/components/layout/SwoopNavbar';
import { Dock } from '@/components/layout/Dock';
import { usePathname } from 'next/navigation';
import { useDockStore } from '@/lib/stores/dockStore';

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dockHidden = useDockStore((s) => s.hidden);
  const hasSlot = useDockStore((s) => Boolean(s.slot));

  const isShopfront = pathname?.startsWith('/shopfront');
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/otp' || pathname === '/sso-callback';
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

  const showDock = !isAuthPage && !isPickup && !dockHidden;

  return (
    <div className="min-h-screen bg-surface flex justify-center">
      <div className="w-full max-w-[428px] bg-white min-h-screen flex flex-col shadow-[0_0_0_1px_var(--line)]">
        {!isAuthPage && !isPickup && !hideNavbar && <SwoopNavbar />}
        {children}
        {/* Keeps the last content clear of the fixed dock (tab bar 52px, live slot +46px). */}
        {showDock && <div aria-hidden className={hasSlot ? 'h-[calc(118px+env(safe-area-inset-bottom))] shrink-0' : 'h-[calc(66px+env(safe-area-inset-bottom))] shrink-0'} />}
        {showDock && <Dock />}
      </div>
    </div>
  );
}
