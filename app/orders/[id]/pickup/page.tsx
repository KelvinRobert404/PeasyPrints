"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { OrderDoc } from '@/types/models';
import { haptics } from '@/lib/utils/haptics';
import { EmptyState, IconButton, ListRow, IconTile, Tag } from '@/components/swoop/primitives';
import { SwoopLogo } from '@/components/swoop/Logo';
import { BackIcon, DocIcon, HelpIcon, OrdersIcon } from '@/components/swoop/icons';
import { formatOrderDate, formatOrderTime, orderStatusMeta } from '@/components/orders/orderStatus';

function TopBar() {
  return (
    <div className="flex h-12 items-center justify-between px-3 pt-1.5">
      <IconButton label="Back to orders" icon={BackIcon} href="/orders" />
      <SwoopLogo size={15} />
      <span className="h-8 w-8" aria-hidden />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-[12px] bg-surface py-2.5">
      <span className="font-heading text-[16px] leading-none tabular-nums text-ink">{value}</span>
      <span className="text-[10.5px] font-semibold text-slate">{label}</span>
    </div>
  );
}

export default function PickupPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params?.id;
    if (!id) return;
    const ref = doc(db, 'orders', id);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as OrderDoc | undefined;
      setOrder(data ? { ...data, id: snap.id } : null);
      setLoading(false);
    }, () => {
      // Permission denied (not your order, or the session isn't bridged yet): show not-found.
      setOrder(null);
      setLoading(false);
    });
    return () => unsub();
  }, [params?.id]);

  // Fire a success haptic when the order is ready. Must be before any early returns
  useEffect(() => {
    if (order && (order.status === 'printed' || (order as any).status === 'printed_ready')) {
      haptics.success();
    }
  }, [order]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        <TopBar />
        <div className="flex flex-1 items-center justify-center" aria-busy="true">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-royal border-t-transparent" aria-label="Loading order" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        <TopBar />
        <div className="px-3 pt-6">
          <EmptyState icon={OrdersIcon} title="Order not found" body="This order doesn't exist or isn't on your account." />
        </div>
      </div>
    );
  }

  const meta = orderStatusMeta(order.status);
  const placed = [formatOrderDate(order.timestamp), formatOrderTime(order.timestamp)].filter(Boolean).join(', ');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <TopBar />

      <main className="flex flex-1 flex-col gap-3 px-3 pt-2 pb-4">
        {/* Hero: the name the shop matches at the counter */}
        <section className={`flex flex-col gap-2 rounded-[14px] px-4 pt-3.5 pb-4 ${meta.ready ? 'bg-royal text-white' : 'bg-ink text-white'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-white/80">Show this at the counter</span>
            <Tag tone={meta.ready ? 'go' : 'white'}>{meta.label}</Tag>
          </div>
          <p className="font-heading break-words text-[36px] leading-[0.95]">{order.userName}</p>
          <p className="truncate text-[12px] font-semibold text-white/80">at {order.shopName}</p>
        </section>

        <div className="grid grid-cols-4 gap-1.5">
          <Stat label="Paper" value={order.printSettings?.paperSize || 'A4'} />
          <Stat label="Copies" value={order.printSettings?.copies ?? 1} />
          <Stat label="Pages" value={order.totalPages} />
          <Stat label="Paid" value={`₹${order.totalCost}`} />
        </div>

        <div className="flex flex-col">
          <ListRow
            leading={<IconTile icon={DocIcon} shape="square" size={36} iconSize={18} />}
            title={order.fileName}
            subtitle={[order.printSettings?.printColor, order.printSettings?.printFormat, placed].filter(Boolean).join(' · ')}
          />
          <ListRow
            href="/contact"
            divider={false}
            leading={<IconTile icon={HelpIcon} shape="square" size={36} iconSize={18} />}
            title="Something wrong with this order?"
            subtitle="Contact us"
          />
        </div>

        <div className="mt-auto flex items-end gap-2 pt-2">
          <img
            src="/figma/3282e2fcd344b844a08c5e470da99b46d1dc9445.png"
            alt=""
            aria-hidden
            className="pointer-events-none h-[92px] w-[88px] select-none object-contain"
          />
          <p className="pb-2 text-[11.5px] text-slate">Show this screen at the counter. Our kitten pal will wait with you.</p>
        </div>
      </main>
    </div>
  );
}
