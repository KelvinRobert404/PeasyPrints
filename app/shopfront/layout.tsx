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
              n.onclick = () => { try { n.close(); } catch { } };
            } catch { }
            localStorage.setItem('sf_notif_onboarded', '1');
          }
        });
      }
    } catch { }
  }, [signedIn, shopChecked]);
  const items = [
    { href: '/shopfront', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/shopfront/billing', label: 'Billing', icon: DollarSign },
    { href: '/shopfront/profile', label: 'Profile', icon: Store },
    { href: '/shopfront/settings', label: 'Settings', icon: Wallet },
    { href: '/shopfront/updates', label: 'Updates', icon: History }
  ];

  return (
    <div className={`${GeistSans.className} flex h-screen flex-col bg-gray-50`} data-sf-zoom>
      {/* Single top navbar spanning full width */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200/60 support-[backdrop-filter]:bg-white/60">
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              aria-label="Toggle sidebar"
              className="rounded-full hover:bg-gray-100 p-2 text-gray-600 transition-colors"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-quinn text-2xl tracking-tight text-gray-900 pt-1">SWOOP</span>
          </div>
          {signedIn && shopChecked ? (
            <div className="flex items-center gap-3 ml-auto">
              {currentShop ? (
                <>
                  <span className="hidden sm:block uppercase text-xs font-semibold tracking-wider text-gray-500 truncate max-w-[200px]">{currentShop?.name}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={currentShop?.isOpen ? 'destructive' : 'default'}
                      className={`h-8 px-4 text-xs font-medium shadow-sm ${!currentShop?.isOpen ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      onClick={() => updateOpenStatus(!currentShop?.isOpen)}
                    >
                      {currentShop?.isOpen ? 'Close Store' : 'Open Store'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => auth.signOut()}
                      title="Logout"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </Button>
                  </div>
                </>
              ) : (
                <Button size="sm" variant="outline" className="h-8 font-semibold" onClick={() => setLoginOpen(true)}>Login</Button>
              )}
            </div>
          ) : (
            <div className="ml-auto">
              <Button size="sm" variant="outline" className="h-8 font-semibold" onClick={() => setLoginOpen(true)}>Login</Button>
            </div>
          )}
        </div>
      </div>

      {/* Main content with sidebar below navbar */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`hidden md:flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[70px]' : 'w-60'
            }`}
        >
          <nav className="flex-1 p-3 space-y-1">
            {items.map((it) => {
              const Icon = it.icon;
              const active = it.href === '/shopfront'
                ? (pathname === '/shopfront' || pathname === '/shopfront/')
                : Boolean(pathname?.startsWith(it.href));
              const isDashboard = it.href === '/shopfront';
              return (
                <Link key={it.href} href={it.href} className="block group" title={sidebarCollapsed ? it.label : undefined}>
                  <div
                    className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${active
                        ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100 ring-1 ring-blue-100'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } ${!active && isDashboard && hasNewOrder ? 'animate-pulse ring-1 ring-blue-200 bg-blue-50/50' : ''}`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`} />
                    {!sidebarCollapsed && (
                      <span className="truncate">{isDashboard && hasNewOrder && !active ? 'Dashboard • New' : it.label}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-100">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-xs font-medium text-gray-400`}>
              <Clock className="h-4 w-4" />
              {!sidebarCollapsed && <span>{formatTime(now)}</span>}
            </div>
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto relative bg-gray-50/50 scroll-smooth">
          <main className="w-full max-w-7xl mx-auto p-4 md:p-6">{signedIn == null ? null : children}</main>
          {signedIn && currentShop && currentShop.isOpen === false && (
            <ClosedOverlay onOpenNow={() => updateOpenStatus(true)} />
          )}
          <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Shopfront Login</DialogTitle>
              </DialogHeader>
              <ShopfrontLoginForm onSuccess={() => setLoginOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}


