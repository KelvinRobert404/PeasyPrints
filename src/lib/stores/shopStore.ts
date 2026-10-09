"use client";

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { db } from '@/lib/firebase/config';
import { firebaseAuthHeaders } from '@/lib/firebase/authHeaders';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import type { OrderDoc, Shop, ShopPricing } from '@/types/models';

interface ShopState {
  currentShop: Shop | null;
  orders: OrderDoc[];
  pendingOrders: OrderDoc[];
  historyOrders: OrderDoc[];
  receivableAmount: number;
  reservedPayoutAmount: number;
  payoutRequests: Array<{ id: string; amount: number; status: 'requested'|'processing'|'paid'|'cancelled'; expectedAt?: any; requestedAt: any }>;
  payouts: Array<{ id: string; amount: number; createdAt: any }>;

  fetchShopData: (uid: string) => Promise<void>;
  fetchOrders: (shopId: string) => Promise<() => void>;
  updateOrderStatus: (orderId: string, status: OrderDoc['status']) => Promise<void>;
  markPrinted: (orderId: string) => Promise<void>;
  markCollected: (orderId: string) => Promise<void>;
  revertToProcessing: (orderId: string) => Promise<void>;
  undoCollected: (orderId: string, order: OrderDoc) => Promise<void>;
  undoCancelled: (orderId: string, order: OrderDoc) => Promise<void>;
  completeOrder: (orderId: string, order: OrderDoc) => Promise<void>;
  cancelOrder: (orderId: string, order: OrderDoc) => Promise<void>;
  updatePricing: (pricing: ShopPricing) => Promise<void>;
  updateOpenStatus: (isOpen: boolean) => Promise<void>;
  subscribePayoutRequests: (shopId: string) => Promise<() => void>;
  subscribePayouts: (shopId: string) => Promise<() => void>;
  requestPayout: (amount: number) => Promise<void>;
}

async function mutateOrder(orderId: string, action: string) {
  const response = await fetch(`/api/shopfront/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await firebaseAuthHeaders()) },
    body: JSON.stringify({ action }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Order update failed');
}

export const useShopStore = create<ShopState>()(
  immer((set, get) => ({
    currentShop: null,
    orders: [],
    pendingOrders: [],
    historyOrders: [],
    receivableAmount: 0,
    reservedPayoutAmount: 0,
    payoutRequests: [],
    payouts: [],

    fetchShopData: async (uid: string) => {
      const ref = doc(db, 'shops', uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const shop: Shop = {
          id: snap.id,
          name: data.name ?? 'Shop',
          address: data.address ?? '',
          timing: data.timing,
          openingTime: data.openingTime,
          closingTime: data.closingTime,
          logoUrl: data.logoUrl,
          pricing: data.pricing,
          isOpen: data.isOpen,
          // Carried so a profile save doesn't blank fields the form round-trips.
          phone: data.phone ?? data.phoneNumber,
          email: data.email,
          collegeId: data.collegeId,
        } as Shop;
        set((s) => {
          s.currentShop = shop;
          s.receivableAmount = Number(data.receivableAmount ?? 0);
          s.reservedPayoutAmount = Number(data.reservedPayoutAmount ?? 0);
        });
      } else {
        set((s) => { s.currentShop = null; s.receivableAmount = 0; s.reservedPayoutAmount = 0; });
      }
    },

    fetchOrders: async (shopId: string) => {
      const qAll = query(
        collection(db, 'orders'),
        where('shopId', '==', shopId),
        orderBy('timestamp', 'desc')
      );
      const unsubAll = onSnapshot(qAll, (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })) as any as OrderDoc[];
        set((s) => { s.orders = list; });
      });

      const qPending = query(
        collection(db, 'orders'),
        where('shopId', '==', shopId),
        where('status', 'in', ['processing', 'printing', 'printed']),
        orderBy('timestamp', 'desc')
      );
      const unsubPending = onSnapshot(qPending, (snap) => {
        let list = snap.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })) as any as OrderDoc[];
        // Emergency first
        list = list.sort((a, b) => Number(b.emergency) - Number(a.emergency));
        set((s) => { s.pendingOrders = list; });
      });

      const qHistory = query(
        collection(db, 'history'),
        where('shopId', '==', shopId),
        orderBy('historyTimestamp', 'desc')
      );
      const unsubHistory = onSnapshot(qHistory, (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })) as any as OrderDoc[];
        set((s) => { s.historyOrders = list; });
      }, (err) => {
        // Index might be missing in some environments; keep store stable
        console.error('History listener error', err);
      });

      return () => { unsubAll(); unsubPending(); unsubHistory(); };
    },

    updateOrderStatus: async (orderId, status) => {
      const action = status === 'completed' ? 'complete' : status === 'cancelled' ? 'cancel' : status;
      await mutateOrder(orderId, action);
    },

    markPrinted: async (orderId) => {
      await mutateOrder(orderId, 'printed');
    },

    markCollected: async (orderId) => {
      await mutateOrder(orderId, 'complete');
    },

    revertToProcessing: async (orderId) => {
      await mutateOrder(orderId, 'processing');
    },

    undoCollected: async (orderId, _order) => {
      await mutateOrder(orderId, 'undo_complete');
    },

    undoCancelled: async (orderId, _order) => {
      await mutateOrder(orderId, 'undo_cancel');
    },

    completeOrder: async (orderId, _order) => {
      await mutateOrder(orderId, 'complete');
    },

    cancelOrder: async (orderId, _order) => {
      await mutateOrder(orderId, 'cancel');
    },

    updatePricing: async (pricing) => {
      const shop = get().currentShop;
      if (!shop) return;
      const ref = doc(db, 'shops', shop.id);
      // Write only the owner-managed parts: replacing the whole map would wipe the
      // platform fees (convenienceFee/convenienceFeeTiers) Godview sets.
      await updateDoc(ref, {
        'pricing.services': pricing.services,
        'pricing.tiers': pricing.tiers ?? [],
        updatedAt: serverTimestamp() as any,
      });
      set((s) => { if (s.currentShop) s.currentShop.pricing = { ...(s.currentShop.pricing ?? {}), services: pricing.services, tiers: pricing.tiers ?? [] }; });
    },

    updateOpenStatus: async (isOpen) => {
      const shop = get().currentShop;
      if (!shop) return;
      const ref = doc(db, 'shops', shop.id);
      await updateDoc(ref, { isOpen, updatedAt: serverTimestamp() as any });
      set((s) => { if (s.currentShop) s.currentShop.isOpen = isOpen; });
    },

    subscribePayoutRequests: async (shopId: string) => {
      const qReq = query(
        collection(db, 'payout_requests'),
        where('shopId', '==', shopId),
        orderBy('requestedAt', 'desc')
      );
      const unsub = onSnapshot(qReq, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
        set((s) => { s.payoutRequests = list as any; });
      });
      return () => { unsub(); };
    },

    subscribePayouts: async (shopId: string) => {
      const qP = query(
        collection(db, 'payouts'),
        where('shopId', '==', shopId),
        orderBy('createdAt', 'desc')
      );
      const unsub = onSnapshot(qP, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
        set((s) => { s.payouts = list as any; });
      });
      return () => { unsub(); };
    },

    requestPayout: async (amount: number) => {
      const shop = get().currentShop;
      if (!shop) return;
      const safeAmount = Math.max(0, Math.floor(Number(amount)));
      if (!safeAmount) return;
      const response = await fetch('/api/shopfront/payouts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await firebaseAuthHeaders()) }, body: JSON.stringify({ amount: safeAmount })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Payout request failed');
      await get().fetchShopData(shop.id);
    }
  }))
);


