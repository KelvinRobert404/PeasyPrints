"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useOrdersStore } from '@/lib/stores/ordersStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { OrderCard } from '@/components/orders/OrderCard';
import { useUser } from '@clerk/nextjs';
 

export default function OrdersPage() {
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { orders, subscribeByUser, loading, error } = useOrdersStore();
  // Figma design shows a simple list; no status filters on customer app

  useEffect(() => {
    // Prefer Clerk userId (used when creating orders) and fall back to Firebase uid
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

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto px-4 py-6">
        {!(isClerkLoaded ? clerkUser : user) && (
          <div className="text-sm text-gray-500">Please sign in</div>
        )}
        {(isClerkLoaded ? clerkUser : user) && (
          <>
            {loading && <div className="text-sm text-gray-500">Loading...</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            {(todayOrders.length > 0) && (
              <div className="mb-2 text-xs font-semibold text-gray-700">Today</div>
            )}
            {todayOrders.map((o, i) => <OrderCard key={`t-${i}`} order={o} />)}
            {(olderOrders.length > 0) && (
              <div className="mt-4 mb-2 text-xs font-semibold text-gray-700">Older</div>
            )}
            {olderOrders.map((o, i) => <OrderCard key={`o-${i}`} order={o} />)}
            {!loading && orders.length === 0 && (
              <div className="text-sm text-gray-500">No orders yet</div>
            )}
          </>
        )}
      </main>
      <BottomNavigation />
    </div>
  );
}
