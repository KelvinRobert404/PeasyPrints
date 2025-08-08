'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useOrdersStore } from '@/lib/stores/ordersStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { OrderCard } from '@/components/orders/OrderCard';

export default function OrdersPage() {
  const { user } = useAuthStore();
  const { orders, subscribeByUser, loading, error } = useOrdersStore();

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeByUser(user.uid);
    return () => unsub();
  }, [user, subscribeByUser]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Orders</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6">
        {!user && <div className="text-sm text-gray-500">Please sign in</div>}
        {user && loading && <div className="text-sm text-gray-500">Loading...</div>}
        {user && error && <div className="text-sm text-red-600">{error}</div>}
        {user && orders.map((o, i) => <OrderCard key={i} order={o} />)}
        {user && !loading && orders.length === 0 && <div className="text-sm text-gray-500">No orders yet</div>}
      </main>
      <BottomNavigation />
    </div>
  );
}
