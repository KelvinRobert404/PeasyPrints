"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { OrderDoc } from '@/types/models';
import Link from 'next/link';
import Image from 'next/image';

function isToday(ts: any) {
  try {
    const d = (ts?.toDate ? ts.toDate() : new Date(ts)) as Date;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  } catch {
    return false;
  }
}

function formatMoney(n: number | undefined) {
  if (typeof n !== 'number') return '';
  return `₹${n}`;
}

export default function PickupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
    });
    return () => unsub();
  }, [params?.id]);

  const statusDisplay = useMemo(() => {
    if (!order) return { label: '', color: 'text-white' };
    const map: Record<string, { label: string; color: string }> = {
      printed: { label: 'ready to collect', color: 'text-[#3eda46]' },
      printed_ready: { label: 'ready to collect', color: 'text-[#3eda46]' },
      collected: { label: 'collected', color: 'text-[#3eda46]' },
      processing: { label: 'processing', color: 'text-yellow-300' },
      printing: { label: 'printing', color: 'text-yellow-300' },
      cancelled: { label: 'cancelled', color: 'text-red-400' },
      completed: { label: 'completed', color: 'text-white' }
    };
    return map[order.status] || { label: order.status?.toUpperCase?.() || '', color: 'text-white' };
  }, [order]);

  if (loading) return <div className="p-6 text-sm text-gray-100 bg-[#155dfc] min-h-screen">Loading...</div>;
  if (!order) return <div className="p-6 text-sm text-gray-100 bg-[#155dfc] min-h-screen">Order not found</div>;

  const showCta = isToday(order.timestamp);

  return (
    <div className="relative h-[100dvh] bg-[#155dfc] text-white overflow-hidden">
      {/* Home button */}
      <div className="absolute left-3 top-3">
        <Link href="/orders" className="block rounded-2xl bg-[#101828] w-[61px] h-[54px] grid place-items-center">
          <img src="/figma/e4702269c114f68dcff879aecd2445c1fe9c83c8.svg" alt="home" className="w-[27px] h-[27px]" />
        </Link>
      </div>

      {/* Stub card */}
      <div className="px-3 pt-[104px]">
        <div className="rounded-[27px] bg-[#101828] px-5 pt-5 pb-6 text-[#fcf6b1]">
          <div className="text-[40px] font-quinn text-[#fcf6b1] leading-none mb-2">{order.userName?.toUpperCase?.()}</div>
          <div className="text-white lowercase text-[24px] leading-6 mb-4">
            <div><span className="text-white">shop</span>: {order.shopName}</div>
            <div><span className="text-white">filename</span>: {order.fileName}</div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-[#101828]">
            <div className="rounded-2xl bg-[#fcf6b1] h-[103px] grid place-items-center">
              <div className="text-[48px] font-quinn leading-none">{order.printSettings?.paperSize || 'A4'}</div>
            </div>
            <div className="rounded-2xl bg-[#fcf6b1] h-[103px] grid place-items-center">
              <div className="text-center">
                <div className="text-[48px] font-quinn leading-none">{order.printSettings?.copies ?? 1}</div>
                <div className="text-[13px]">copies</div>
              </div>
            </div>
            <div className="rounded-2xl bg-[#fcf6b1] h-[103px] grid place-items-center">
              <div className="text-center">
                <div className="text-[48px] font-quinn leading-none">{order.totalPages}</div>
                <div className="text-[13px]">pages</div>
              </div>
            </div>
            <div className="rounded-2xl bg-[#fcf6b1] h-[103px] grid place-items-center">
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <span className="text-[28px] font-quinn leading-none">₹</span>
                  <span className="text-[48px] font-quinn leading-none">{order.totalCost}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 text-[#fcf6b1]">
            <span className="text-[40px] lowercase">status</span>
            <span className="text-[40px]">: </span>
            <span className={`text-[28px] ${statusDisplay.color}`}>{statusDisplay.label}</span>
          </div>
        </div>
      </div>

      {/* Cat graphic */}
      <img
        src="/figma/3282e2fcd344b844a08c5e470da99b46d1dc9445.png"
        alt="cat"
        className="absolute left-[5px] bottom-0 w-[214px] h-[220px] object-contain select-none pointer-events-none"
      />

      {/* Footer message - as per Figma */}
      <div className="absolute bottom-4 right-2 w-[260px] text-center text-[#fcf6b1] px-2">
        <div className="font-quinn text-[64px] leading-none">SWOOP</div>
        <div className="text-[13px] lowercase max-w-[254px] mx-auto">
          show this screen at the counter, our kitten pal will wait with you
        </div>
      </div>
    </div>
  );
}


