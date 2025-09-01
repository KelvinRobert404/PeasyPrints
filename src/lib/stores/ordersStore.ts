"use client";

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { OrderDoc } from '@/types/models';

interface OrdersState {
  orders: OrderDoc[];
  loading: boolean;
  error: string | null;
  subscribeByUser: (userId: string) => () => void;
}

export const useOrdersStore = create<OrdersState>()(
  immer((set) => ({
    orders: [],
    loading: false,
    error: null,
    subscribeByUser: (userId: string) => {
      set((s) => { s.loading = true; s.error = null; });
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );
      const unsub = onSnapshot(q, (snap) => {
        const orders = snap.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })).map((o) => ({
          ...o,
          // Presentational mapping for customer app
          status: o.status === 'printed' ? 'printed_ready' as any : (o.status === 'collected' ? 'collected' : o.status)
        }));
        set((s) => { s.orders = orders; s.loading = false; });
      }, (err) => {
        set((s) => { s.error = err.message; s.loading = false; });
      });
      return unsub;
    }
  }))
);
