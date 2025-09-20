"use client";

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { db } from '@/lib/firebase/config';
import { recordAdminAction } from '@/lib/utils/audit';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import type { OrderDoc, Shop } from '@/types/models';

export type OrderStatusFilter = 'all' | 'processing' | 'printing' | 'printed' | 'collected' | 'completed' | 'cancelled';

interface GodviewState {
  shops: Shop[];
  orders: OrderDoc[];
  pendingOrders: OrderDoc[];
  historyOrders: OrderDoc[];
  loading: boolean;
  error: string | null;

  // UI filters
  selectedShopIds: string[];
  statusFilter: OrderStatusFilter;
  searchText: string;

  subscribe: () => () => void;
  pollSnapshot: (passphrase: string) => () => void;
  setSelectedShopIds: (ids: string[]) => void;
  setStatusFilter: (status: OrderStatusFilter) => void;
  setSearchText: (text: string) => void;

  toggleShopOpen: (shopId: string, open: boolean) => Promise<void>;
  bulkToggleShops: (shopIds: string[], open: boolean) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderDoc['status']) => Promise<void>;
  setOrderEmergency: (orderId: string, emergency: boolean) => Promise<void>;
  cancelOrder: (order: OrderDoc) => Promise<void>;
}

export const useGodviewStore = create<GodviewState>()(
  immer((set, get) => ({
    shops: [],
    orders: [],
    pendingOrders: [],
    historyOrders: [],
    loading: false,
    error: null,
    selectedShopIds: [],
    statusFilter: 'all',
    searchText: '',

    subscribe: () => {
      set((s) => { s.loading = true; s.error = null; });

      // Shops subscription (all shops)
      const unsubShops = onSnapshot(collection(db, 'shops'), (snap) => {
        const list: Shop[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? 'Shop',
            address: data.address ?? '',
            timing: data.timing,
            openingTime: data.openingTime,
            closingTime: data.closingTime,
            logoUrl: data.logoUrl,
            pricing: data.pricing,
            isOpen: data.isOpen,
          } as Shop;
        });
        set((s) => { s.shops = list; s.loading = false; });
      }, (err) => {
        set((s) => { s.error = err.message; s.loading = false; });
      });

      // Global orders stream (all shops) - limited for safety
      const unsubOrders = onSnapshot(
        query(collection(db, 'orders'), orderBy('timestamp', 'desc'), limit(500)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })) as any as OrderDoc[];
          set((s) => { s.orders = list; });
        }
      );

      // Pending queue across all shops
      const unsubPending = onSnapshot(
        query(
          collection(db, 'orders'),
          where('status', 'in', ['processing', 'printing', 'printed']),
          orderBy('timestamp', 'desc'),
          limit(500)
        ),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })) as any as OrderDoc[];
          set((s) => { s.pendingOrders = list.sort((a: any, b: any) => Number(b.emergency) - Number(a.emergency)); });
        }
      );

      // History stream (completed/cancelled) across all shops
      const unsubHistory = onSnapshot(
        query(collection(db, 'history'), orderBy('historyTimestamp', 'desc'), limit(500)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })) as any as OrderDoc[];
          set((s) => { s.historyOrders = list; });
        },
        () => {}
      );

      return () => { unsubShops(); unsubOrders(); unsubPending(); unsubHistory(); };
    },

    // Passphrase-only mode: poll server snapshot instead of direct listeners
    pollSnapshot: (passphrase: string) => {
      set((s) => { s.loading = true; s.error = null; });
      let active = true;
      async function fetchOnce() {
        try {
          const res = await fetch(`/api/godview/snapshot?pass=${encodeURIComponent(passphrase)}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!active) return;
          set((s) => {
            s.shops = data.shops || [];
            s.orders = (data.orders || []).map((o: any) => ({ ...o, timestamp: o.timestamp ? new Date(o.timestamp) : o.timestamp }));
            s.pendingOrders = (data.pendingOrders || []).map((o: any) => ({ ...o, timestamp: o.timestamp ? new Date(o.timestamp) : o.timestamp }));
            s.historyOrders = (data.historyOrders || []).map((o: any) => ({ ...o, historyTimestamp: o.historyTimestamp ? new Date(o.historyTimestamp) : o.historyTimestamp }));
            s.loading = false;
          });
        } catch (e: any) {
          if (!active) return;
          set((s) => { s.error = e?.message || 'Failed to load'; s.loading = false; });
        }
      }
      void fetchOnce();
      const id = setInterval(fetchOnce, 5000);
      return () => { active = false; clearInterval(id); };
    },

    setSelectedShopIds: (ids) => set((s) => { s.selectedShopIds = ids; }),
    setStatusFilter: (status) => set((s) => { s.statusFilter = status; }),
    setSearchText: (text) => set((s) => { s.searchText = text; }),

    toggleShopOpen: async (shopId, open) => {
      const ref = doc(db, 'shops', shopId);
      await updateDoc(ref, { isOpen: open, updatedAt: serverTimestamp() as any });
      try { await recordAdminAction('shop_toggle', { shopId, isOpen: open }); } catch {}
    },

    bulkToggleShops: async (shopIds, open) => {
      for (const id of shopIds) {
        try {
          const ref = doc(db, 'shops', id);
          await updateDoc(ref, { isOpen: open, updatedAt: serverTimestamp() as any });
        } catch {}
      }
      try { await recordAdminAction('shop_bulk_toggle', { shopIds, isOpen: open, count: shopIds.length }); } catch {}
    },

    updateOrderStatus: async (orderId, status) => {
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() as any });
      try { await recordAdminAction('order_status_update', { orderId, status }); } catch {}
    },

    setOrderEmergency: async (orderId, emergency) => {
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { emergency, updatedAt: serverTimestamp() as any });
      try { await recordAdminAction('order_emergency_toggle', { orderId, emergency }); } catch {}
    },

    cancelOrder: async (order) => {
      const ref = doc(db, 'orders', (order as any).id as string);
      const historyRef = doc(collection(db, 'history'));
      const cancelledPayload: any = {
        ...order,
        status: 'cancelled',
        shopId: order.shopId,
        orderId: (order as any).id,
        historyTimestamp: serverTimestamp() as any,
        fileUrl: (order as any).fileUrl,
      };
      await setDoc(historyRef, cancelledPayload as any);
      await updateDoc(ref, { status: 'cancelled', updatedAt: serverTimestamp() as any });
      try { await recordAdminAction('order_cancelled', { orderId: (order as any).id, shopId: order.shopId }); } catch {}
    },
  }))
);


