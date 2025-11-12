"use client";

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { db } from '@/lib/firebase/config';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
  confirmPayoutSettlement: (requestId: string, amount: number) => Promise<void>;
}

export const useShopStore = create<ShopState>()(
  immer((set, get) => ({
    currentShop: null,
    orders: [],
    pendingOrders: [],
    historyOrders: [],
    receivableAmount: 0,
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
        } as Shop;
        set((s) => {
          s.currentShop = shop;
          s.receivableAmount = Number(data.receivableAmount ?? 0);
        });
      } else {
        set((s) => { s.currentShop = null; s.receivableAmount = 0; });
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
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() as any });
    },

    markPrinted: async (orderId) => {
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { status: 'printed', updatedAt: serverTimestamp() as any });
    },

    markCollected: async (orderId) => {
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { status: 'collected', updatedAt: serverTimestamp() as any });
    },

    revertToProcessing: async (orderId) => {
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { status: 'processing', updatedAt: serverTimestamp() as any });
    },

    undoCollected: async (orderId, order) => {
      // Remove matching history entry if exists and revert status, adjusting receivable
      try {
        const q = query(collection(db, 'history'), where('orderId', '==', orderId), where('status', '==', 'completed'));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'history', d.id));
        }
      } catch {}
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { status: 'printed', updatedAt: serverTimestamp() as any });
      // Adjust receivable amount back
      try {
        const shopRef = doc(db, 'shops', order.shopId);
        const snap = await getDoc(shopRef);
        const prev = Number(snap.data()?.receivableAmount ?? 0);
        const next = Math.max(0, prev - Number(order.totalCost ?? 0));
        await updateDoc(shopRef, { receivableAmount: next, updatedAt: serverTimestamp() as any });
        set((s) => { s.receivableAmount = next; });
      } catch {}
    },

    undoCancelled: async (orderId, order) => {
      // Remove matching cancelled history entries and revert status back to processing
      try {
        const q = query(collection(db, 'history'), where('orderId', '==', orderId), where('status', '==', 'cancelled'));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'history', d.id));
        }
      } catch {}
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { status: 'processing', updatedAt: serverTimestamp() as any });
    },

    completeOrder: async (orderId, order) => {
      const ref = doc(db, 'orders', orderId);
      const historyRef = doc(collection(db, 'history'));
      // Mirror to history with historyTimestamp
      const completedPayload = { ...order, status: 'completed', shopId: order.shopId, orderId: orderId, historyTimestamp: serverTimestamp(), fileUrl: order.fileUrl } as any;
      await setDoc(historyRef, completedPayload);
      await updateDoc(ref, { status: 'completed' });
      // Update receivableAmount on shop
      const shopId = order.shopId;
      try {
        const shopRef = doc(db, 'shops', shopId);
        const snap = await getDoc(shopRef);
        const prev = Number(snap.data()?.receivableAmount ?? 0);
        const next = prev + Number(order.totalCost ?? 0);
        await updateDoc(shopRef, { receivableAmount: next, updatedAt: serverTimestamp() as any });
        set((s) => { s.receivableAmount = next; });
      } catch {}
    },

    cancelOrder: async (orderId, order) => {
      const ref = doc(db, 'orders', orderId);
      const historyRef = doc(collection(db, 'history'));
      const cancelledPayload = { ...order, status: 'cancelled', shopId: order.shopId, orderId: orderId, historyTimestamp: serverTimestamp(), fileUrl: order.fileUrl } as any;
      await setDoc(historyRef, cancelledPayload);
      await updateDoc(ref, { status: 'cancelled' });
      // No receivable update on cancel
    },

    updatePricing: async (pricing) => {
      const shop = get().currentShop;
      if (!shop) return;
      const ref = doc(db, 'shops', shop.id);
      await updateDoc(ref, { pricing, updatedAt: serverTimestamp() as any });
      set((s) => { if (s.currentShop) s.currentShop.pricing = pricing; });
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
      const ref = doc(collection(db, 'payout_requests'));
      await setDoc(ref, {
        shopId: shop.id,
        amount: safeAmount,
        status: 'requested',
        requestedAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any
      } as any);
    },

    confirmPayoutSettlement: async (requestId: string, amount: number) => {
      const shop = get().currentShop;
      if (!shop) return;
      const safeAmount = Math.max(0, Math.floor(Number(amount)));
      const payoutRef = doc(collection(db, 'payouts'));
      await setDoc(payoutRef, {
        shopId: shop.id,
        amount: safeAmount,
        requestId,
        createdAt: serverTimestamp() as any
      } as any);
      try {
        const shopRef = doc(db, 'shops', shop.id);
        const snap = await getDoc(shopRef);
        const prev = Number(snap.data()?.receivableAmount ?? 0);
        const next = Math.max(0, prev - safeAmount);
        await updateDoc(shopRef, { receivableAmount: next, updatedAt: serverTimestamp() as any });
        set((s) => { s.receivableAmount = next; });
      } catch {}
    }
  }))
);


