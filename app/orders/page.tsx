"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useOrdersStore } from '@/lib/stores/ordersStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { OrderCard } from '@/components/orders/OrderCard';
import { useUser } from '@clerk/nextjs';

// Material Symbol icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-rounded ${className}`}>
      {name}
    </span>
  );
}

export default function OrdersPage() {
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { orders, subscribeByUser, loading, error } = useOrdersStore();

  useEffect(() => {
    const userId = (isClerkLoaded && clerkUser?.id) || user?.uid;
    if (!userId) return;
    const unsub = subscribeByUser(userId);
    return () => unsub();
  }, [isClerkLoaded, clerkUser, user, subscribeByUser]);

  function isToday(ts: any) {
    try {
      const d = (ts?.toDate ? ts.toDate() : new Date(ts)) as Date;
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    } catch {
      return false;
    }
  }

  const { todayOrders, olderOrders } = useMemo(() => {
    const todayOrders = orders.filter((o) => isToday(o.timestamp));
    const olderOrders = orders.filter((o) => !isToday(o.timestamp));
    return { todayOrders, olderOrders };
  }, [orders]);

  const isSignedIn = isClerkLoaded ? clerkUser : user;

  return (
    <div className="min-h-screen flex flex-col bg-white pb-20">
      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {/* Not signed in */}
        {!isSignedIn && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Icon name="person" className="text-2xl text-blue-600" />
            </div>
            <p className="text-sm text-gray-500">Please sign in to view your orders</p>
          </div>
        )}

        {/* Signed in */}
        {isSignedIn && (
          <>
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Today's orders */}
            {todayOrders.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Today</p>
                <div className="space-y-2.5">
                  {todayOrders.map((o, i) => <OrderCard key={`t-${i}`} order={o} />)}
                </div>
              </div>
            )}

            {/* Older orders */}
            {olderOrders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Earlier</p>
                <div className="space-y-2.5">
                  {olderOrders.map((o, i) => <OrderCard key={`o-${i}`} order={o} />)}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && orders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <Icon name="package_2" className="text-2xl text-blue-600" />
                </div>
                <p className="text-base font-medium text-gray-900">No orders yet</p>
                <p className="text-sm text-gray-500 mt-1">Your orders will appear here</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-4 left-4 right-4 max-w-[396px] mx-auto">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 py-3.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 text-white font-medium active:scale-[0.98] transition-transform"
        >
          <span className="material-symbols-rounded text-xl">home</span>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
