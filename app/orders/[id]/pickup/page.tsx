"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { OrderDoc } from '@/types/models';
import { haptics } from '@/lib/utils/haptics';
import { EmptyState, IconButton, ListRow, IconTile, Tag, swButton } from '@/components/swoop/primitives';
import { SwoopLogo } from '@/components/swoop/Logo';
import { PickupWaitArt } from '@/components/swoop/illustrations';
import { BackIcon, DocIcon, HelpIcon, OrdersIcon } from '@/components/swoop/icons';
import { formatOrderDate, formatOrderTime, orderStatusMeta } from '@/components/orders/orderStatus';
import { formatPrice } from '@/lib/format/price';
import { isDemoMode } from '@/lib/demo/mode';

function TopBar() {
  return (
    <div className="flex h-12 items-center justify-between px-3 pt-1.5">
      <IconButton label="Back to orders" icon={BackIcon} href="/orders" />
      <SwoopLogo size={15} />
      <span className="h-8 w-8" aria-hidden />
    </div>
  );
}

/** 'Rs 80' via formatPrice; print totals can carry paise ('Rs 7.5'), so keep them. */
function paidLabel(total: unknown): string {
  const rupees = Math.round(Math.max(0, Number(total) || 0) * 100) / 100;
  return Number.isInteger(rupees) ? formatPrice(rupees) : `Rs ${rupees.toFixed(2).replace(/0$/, '')}`;
}

/** The line beside the pickup art, by order state. */
function artCaption(meta: { ready: boolean; active: boolean }): string {
  if (meta.ready) return 'The shop matches your name.';
  if (meta.active) return 'This page updates by itself.';
  return 'All done here.';
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-[12px] bg-surface py-2.5">
      <span className="font-heading text-[16px] leading-none tabular-nums text-ink">{value}</span>
      <span className="text-[10.5px] font-semibold text-slate">{label}</span>
    </div>
  );
}

/**
 * Demo only: stands in for the shop at the counter. Marks the visitor's own
 * ready order collected on the sample data.
 */
function DemoHandOverButton({ orderId, onCollected }: { orderId: string; onCollected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handOver() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/demo/orders/${encodeURIComponent(orderId)}/collect`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const body = (await res.json().catch(() => null)) as { status?: string; error?: string } | null;
      if (!res.ok || body?.status !== 'collected') throw new Error(body?.error || 'Could not hand it over');
      onCollected();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not hand it over');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handOver}
        disabled={busy}
        className={`${swButton({ variant: 'surface', size: 'md' })} w-full`}
      >
        {busy ? 'Handing it over…' : 'Shop hands it over (demo)'}
      </button>
      {error ? (
        <p role="alert" className="text-center text-[11px] text-market">{error}</p>
      ) : (
        <p className="text-center text-[11px] text-slate">Sample data. No real shop is involved.</p>
      )}
    </div>
  );
}

/** The demo's stand-in for the shop's hand-over; absent outside the demo. */
const DemoHandOver = isDemoMode() ? DemoHandOverButton : null;

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

  // Fire a success haptic when the order turns ready while this page is open
  // (not on first load: browsers block vibrate before a tap). Must be before any early returns.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = order ? String(order.status) : null;
    const isReady = (value: string | null) => value === 'printed' || value === 'printed_ready';
    if (lastStatus.current !== null && !isReady(lastStatus.current) && isReady(status)) {
      haptics.success();
    }
    lastStatus.current = status;
  }, [order]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--demo-bar-h,0px))] flex-col bg-white">
        <TopBar />
        <div className="flex flex-1 items-center justify-center" aria-busy="true">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-royal border-t-transparent" aria-label="Loading order" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--demo-bar-h,0px))] flex-col bg-white">
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
    <div className="flex min-h-[calc(100dvh-var(--demo-bar-h,0px))] flex-col bg-white">
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
          <Stat label="Paid" value={paidLabel(order.totalCost)} />
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

        {DemoHandOver && meta.ready && (
          <DemoHandOver
            orderId={order.id ?? params?.id ?? ''}
            onCollected={() => setOrder((current) => (current ? { ...current, status: 'collected' } : current))}
          />
        )}

        <div className="mt-auto flex items-end gap-2 pt-2">
          <PickupWaitArt width={88} height={81} className="pointer-events-none shrink-0 select-none" />
          <p className="pb-2 text-[11.5px] text-slate">{artCaption(meta)}</p>
        </div>
      </main>
    </div>
  );
}
