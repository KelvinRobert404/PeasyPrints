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
  const [status, setStatus] = useState<'all' | 'pending' | 'processing' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    // Prefer Clerk userId (used when creating orders) and fall back to Firebase uid
    const userId = (isClerkLoaded && clerkUser?.id) || user?.uid;
    if (!userId) return;
    const unsub = subscribeByUser(userId);
    return () => unsub();
  }, [isClerkLoaded, clerkUser, user, subscribeByUser]);

  const filteredOrders = useMemo(() => {
    if (status === 'all') return orders;
    return orders.filter((o) => o.status === status);
  }, [orders, status]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Orders</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6">
        {!(isClerkLoaded ? clerkUser : user) && (
          <div className="text-sm text-gray-500">Please sign in</div>
        )}
        {(isClerkLoaded ? clerkUser : user) && (
          <>
            <div className="mb-4 flex gap-2 text-sm">
              {(['all','pending','processing','completed','cancelled'] as const).map((s) => (
                <button
                  key={s}
                  className={`px-3 h-9 rounded border ${status===s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}
                  onClick={() => setStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {loading && <div className="text-sm text-gray-500">Loading...</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            {filteredOrders.map((o, i) => <OrderCard key={i} order={o} />)}
            {!loading && filteredOrders.length === 0 && (
              <div className="text-sm text-gray-500">No orders yet</div>
            )}
          </>
        )}
      </main>
      <BottomNavigation />
    </div>
  );
}
