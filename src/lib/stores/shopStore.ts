"use client";

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { db } from '@/lib/firebase/config';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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

  fetchShopData: (uid: string) => Promise<void>;
  fetchOrders: (shopId: string) => Promise<() => void>;
  updateOrderStatus: (orderId: string, status: OrderDoc['status']) => Promise<void>;
  completeOrder: (orderId: string, order: OrderDoc) => Promise<void>;
  cancelOrder: (orderId: string, order: OrderDoc) => Promise<void>;
  updatePricing: (pricing: ShopPricing) => Promise<void>;
}

export const useShopStore = create<ShopState>()(
  immer((set, get) => ({
    currentShop: null,
    orders: [],
    pendingOrders: [],
    historyOrders: [],
    receivableAmount: 0,

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
          logoUrl: data.logoUrl,
          pricing: data.pricing,
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
        where('status', 'in', ['processing', 'printing']),
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
        orderBy('timestamp', 'desc')
      );
      const unsubHistory = onSnapshot(qHistory, (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })) as any as OrderDoc[];
        set((s) => { s.historyOrders = list; });
      });

      return () => { unsubAll(); unsubPending(); unsubHistory(); };
    },

    updateOrderStatus: async (orderId, status) => {
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() as any });
    },

    completeOrder: async (orderId, order) => {
      const ref = doc(db, 'orders', orderId);
      const historyRef = doc(collection(db, 'history'));
      // Mirror to history with historyTimestamp
      const completedPayload = { ...order, status: 'completed', shopId: order.shopId, orderId: orderId, historyTimestamp: serverTimestamp() } as any;
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
      const cancelledPayload = { ...order, status: 'cancelled', shopId: order.shopId, orderId: orderId, historyTimestamp: serverTimestamp() } as any;
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
    }
  }))
);


