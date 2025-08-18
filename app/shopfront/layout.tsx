"use client";

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LayoutDashboard, History, DollarSign, Store, Wallet } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

export default function ShopfrontLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setSignedIn(!!u));
    return () => unsub();
  }, []);
  const isAuthRoute = useMemo(() => pathname?.startsWith('/shopfront/login') || pathname?.startsWith('/shopfront/register'), [pathname]);
  useEffect(() => {
    if (signedIn == null) return;
    if (!signedIn && !isAuthRoute) router.replace('/shopfront/login');
    if (signedIn && isAuthRoute) router.replace('/shopfront/dashboard');
  }, [signedIn, isAuthRoute, router]);
  const items = [
    { href: '/shopfront/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/shopfront/history', label: 'History', icon: History },
    { href: '/shopfront/pricing', label: 'Pricing', icon: DollarSign },
    { href: '/shopfront/profile', label: 'Shop Profile', icon: Store },
    { href: '/shopfront/withdraw', label: 'Withdraw', icon: Wallet }
  ];

  return (
    <div className="flex h-screen">
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-white">
        <div className="p-4 font-quinn text-xl">Swoop Shopfront</div>
        <nav className="flex-1 p-2 space-y-1">
          {items.map((it) => {
            const Icon = it.icon;
            const active = pathname?.startsWith(it.href);
            return (
              <Link key={it.href} href={it.href} className="block">
                <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                  <Icon className="h-4 w-4" />
                  <span>{it.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="md:hidden sticky top-0 z-10 bg-white border-b">
          <div className="container mx-auto max-w-7xl p-3 flex items-center justify-between">
            <div className="font-semibold text-lg">Swoop Shop</div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <nav className="p-2 space-y-1">
                  {items.map((it) => {
                    const Icon = it.icon;
                    const active = pathname?.startsWith(it.href);
                    return (
                      <Link key={it.href} href={it.href} className="block">
                        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                          <Icon className="h-4 w-4" />
                          <span>{it.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <main className="container mx-auto max-w-7xl p-4">
          {signedIn == null ? null : children}
        </main>
      </div>
    </div>
  );
}


