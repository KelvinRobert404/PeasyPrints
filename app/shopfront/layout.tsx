"use client";

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { GeistSans } from 'geist/font/sans';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ClosedOverlay } from '@/components/layout/ClosedOverlay';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShopfrontLoginForm } from '@/components/shopfront/ShopfrontLoginForm';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LayoutDashboard, History, DollarSign, Store, Wallet, Clock } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { useShopStore } from '@/lib/stores/shopStore';
import { useNewOrderAlerts } from '@/hooks/useNewOrderAlerts';

export default function ShopfrontLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const { currentShop, fetchShopData, updateOpenStatus } = useShopStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [now, setNow] = useState<Date>(new Date());
  const [shopChecked, setShopChecked] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  function formatTime(d: Date): string {
    let h = d.getHours();
    const m = d.getMinutes();
    const s = d.getSeconds();
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${suffix}`;
  }
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setSignedIn(!!u));
    return () => unsub();
  }, []);
  const isAuthRoute = useMemo(() => pathname?.startsWith('/shopfront/login'), [pathname]);
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    if (signedIn == null) return;
    // Disable route redirects; use modal instead
  }, [signedIn, isAuthRoute, router, currentShop, shopChecked]);

  useEffect(() => {
    if (!signedIn) { setShopChecked(true); return; }
    const uid = auth.currentUser?.uid;
    if (!uid) { setShopChecked(true); return; }
    (async () => {
      if (!currentShop) {
        await fetchShopData(uid);
      }
      setShopChecked(true);
    })();
  }, [signedIn, currentShop, fetchShopData]);

  const { hasNewOrder, clearNewOrderFlag } = useNewOrderAlerts({ shopId: (currentShop as any)?.id });
  useEffect(() => {
    const onDashboard = pathname === '/shopfront' || pathname === '/shopfront/';
    if (onDashboard && hasNewOrder) clearNewOrderFlag();
  }, [pathname, hasNewOrder, clearNewOrderFlag]);

  // After login: request notifications if not yet granted, and show onboarding notification once
  useEffect(() => {
    if (!signedIn || !shopChecked) return;
    if (typeof window === 'undefined' || !("Notification" in window)) return;
    try {
      const alreadyOnboarded = localStorage.getItem('sf_notif_onboarded') === '1';
      const alreadyRequested = localStorage.getItem('sf_notif_requested') === '1';
      if (Notification.permission === 'granted') {
        // Do not show onboarding if permission was already granted previously
        return;
      }
      if (!alreadyRequested && Notification.permission === 'default') {
        localStorage.setItem('sf_notif_requested', '1');
        Notification.requestPermission().then((p) => {
          if (p === 'granted' && !alreadyOnboarded) {
            try {
              const n = new Notification('Notifications Enables', { body: 'You will receive notifications from now on' });
              n.onclick = () => { try { n.close(); } catch {} };
            } catch {}
            localStorage.setItem('sf_notif_onboarded', '1');
          }
        });
      }
    } catch {}
  }, [signedIn, shopChecked]);
  const items = [
    { href: '/shopfront', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/shopfront/billing', label: 'Billing', icon: DollarSign },
    { href: '/shopfront/profile', label: 'Profile', icon: Store },
    { href: '/shopfront/settings', label: 'Settings', icon: Wallet },
    { href: '/shopfront/updates', label: 'Updates', icon: History }
  ];

  return (
    <div className={`${GeistSans.className} flex h-screen flex-col`} data-sf-zoom>
      {/* Single top navbar spanning full width */}
      <div className="sticky top-0 z-20 bg-blue-600 text-white">
        <div className="h-12 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              aria-label="Toggle sidebar"
              className="rounded hover:bg-white/10 p-1.5"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-quinn text-3xl">SWOOP</span>
          </div>
          {signedIn && shopChecked ? (
            <div className="flex items-center gap-2 ml-auto">
              {currentShop ? (
                <>
                  <span className="uppercase text-sm sm:text-base truncate max-w-[40vw] sm:max-w-[55%]">{currentShop?.name}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={currentShop?.isOpen ? 'destructive' : 'success'}
                      className="h-8"
                      onClick={() => updateOpenStatus(!currentShop?.isOpen)}
                    >
                      {currentShop?.isOpen ? 'Close store' : 'Open store now'}
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8" onClick={() => auth.signOut()}>Logout</Button>
                  </div>
                </>
              ) : (
                <Button size="sm" variant="outline" className="h-8 bg-white text-blue-600 hover:bg-white/90 border-transparent font-[coolvetica] font-bold" onClick={() => setLoginOpen(true)}>LOGIN</Button>
              )}
            </div>
          ) : (
            <div className="ml-auto">
              <Button size="sm" variant="outline" className="h-8 bg-white text-blue-600 hover:bg-white/90 border-transparent font-[coolvetica] font-bold" onClick={() => setLoginOpen(true)}>LOGIN</Button>
            </div>
          )}
        </div>
      </div>

      {/* Main content with sidebar below navbar */}
      <div className="flex flex-1">
        <aside className={`hidden md:flex ${sidebarCollapsed ? 'md:w-16' : 'md:w-52'} md:flex-col md:border-r md:border-gray-300 md:bg-white`}>
          <nav className="flex-1 p-2 space-y-1">
            {items.map((it) => {
              const Icon = it.icon;
              const active = it.href === '/shopfront'
                ? (pathname === '/shopfront' || pathname === '/shopfront/')
                : Boolean(pathname?.startsWith(it.href));
              const isDashboard = it.href === '/shopfront';
              return (
                <Link key={it.href} href={it.href} className="block" title={sidebarCollapsed ? it.label : undefined}>
                  <div
                    className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'} rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'hover:bg-blue-50 hover:text-blue-700'
                    } ${!active && isDashboard && hasNewOrder ? 'animate-pulse' : ''}`}
                  >
                    <Icon className="h-5 w-5" />
                    {!sidebarCollapsed && (
                      <span className="font-medium">{isDashboard && hasNewOrder && !active ? 'Dashboard • New' : it.label}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
          <div className="p-2 border-t md:border-gray-300 text-xs text-gray-700">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{formatTime(now)}</span>
            </div>
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto relative">
          <main className="w-full pl-[10px] pr-[5px] pt-[10px]">{signedIn == null ? null : children}</main>
          {signedIn && currentShop && currentShop.isOpen === false && (
            <ClosedOverlay onOpenNow={() => updateOpenStatus(true)} />
          )}
          <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Shopfront login</DialogTitle>
              </DialogHeader>
              <ShopfrontLoginForm onSuccess={() => setLoginOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}


