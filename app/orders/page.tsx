"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useOrdersStore } from '@/lib/stores/ordersStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { OrderCard } from '@/components/orders/OrderCard';
import { EmptyState, swButton } from '@/components/swoop/primitives';
import { OrdersIcon, UploadIcon, UserIcon } from '@/components/swoop/icons';
import type { OrderDoc } from '@/types/models';

function OrderGroup({ title, orders }: { title: string; orders: OrderDoc[] }) {
  return (
    <section className="pt-3">
      <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">{title}</h2>
      <div className="mt-1 flex flex-col">
        {orders.map((o, i) => (
          <OrderCard key={o.id ?? `${title}-${i}`} order={o} divider={i < orders.length - 1} />
        ))}
      </div>
    </section>
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
    <div className="flex flex-1 flex-col bg-white">
      <main className="flex-1 px-3 pt-2 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-[16px] leading-[1.05] text-ink">Orders</h1>
          {isSignedIn && orders.length > 0 && (
            <Link href="/upload" className={swButton({ variant: 'surface', size: 'pill' })}>
              <UploadIcon size={15} />
              New print
            </Link>
          )}
        </div>

        {/* Not signed in */}
        {!isSignedIn && (
          <EmptyState
            className="mt-3"
            icon={UserIcon}
            title="Sign in to see your orders"
            body="Your prints and pickup screens show up here."
            action={
              <Link href="/login?redirect_url=/orders" className={swButton({ variant: 'primary', size: 'sm', className: 'mt-1' })}>
                Sign in
              </Link>
            }
          />
        )}

        {/* Signed in */}
        {isSignedIn && (
          <>
            {loading && orders.length === 0 && (
              <div className="mt-3 flex flex-col gap-2" aria-busy="true" aria-label="Loading orders">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="h-9 w-9 shrink-0 animate-pulse rounded-[10px] bg-surface" />
                    <span className="h-8 flex-1 animate-pulse rounded-[8px] bg-surface" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-[10px] bg-market-tint px-3 py-2 text-[11.5px] font-semibold text-market">{error}</p>
            )}

            {todayOrders.length > 0 && <OrderGroup title="Today" orders={todayOrders} />}
            {olderOrders.length > 0 && <OrderGroup title="Earlier" orders={olderOrders} />}

            {!loading && orders.length === 0 && (
              <EmptyState
                className="mt-3"
                icon={OrdersIcon}
                title="No orders yet"
                body="Upload a PDF, pick a shop and collect it on campus."
                action={
                  <Link href="/upload" className={swButton({ variant: 'primary', size: 'sm', className: 'mt-1' })}>
                    <UploadIcon size={15} />
                    Start a print
                  </Link>
                }
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
