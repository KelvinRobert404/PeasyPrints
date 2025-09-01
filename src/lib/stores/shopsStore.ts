"use client";

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { Shop, ShopPricing } from '@/types/models';

interface ShopsState {
  shops: Shop[];
  loading: boolean;
  error: string | null;
  subscribe: () => () => void;
}

export const useShopsStore = create<ShopsState>()(
  immer((set) => ({
    shops: [],
    loading: false,
    error: null,
    subscribe: () => {
      set((s) => { s.loading = true; s.error = null; });
      const ref = collection(db, 'shops');
      const unsub = onSnapshot(ref, (snap: QuerySnapshot<DocumentData>) => {
        const shops: Shop[] = snap.docs.map((d) => {
          const data = d.data();
          const pricing = adaptShopPricing(data);
          return {
            id: d.id,
            name: data.name ?? 'Shop',
            address: data.address ?? '',
            timing: data.timing,
            logoUrl: data.logoUrl,
            pricing
          } as Shop;
        });
        set((s) => { s.shops = shops; s.loading = false; });
      }, (err) => {
        set((s) => { s.error = err.message; s.loading = false; });
      });
      return unsub;
    }
  }))
);

function adaptShopPricing(data: any): ShopPricing | undefined {
  // If already in new format, return as-is
  if (data?.pricing?.a4 && data?.pricing?.a3) return data.pricing as ShopPricing;

  // Legacy flat fields from Flutter/older schema
  const hasLegacy =
    typeof data?.A4SingBlaWh === 'number' ||
    typeof data?.A4SingColor === 'number' ||
    typeof data?.A4DoubBlaWh === 'number' ||
    typeof data?.A4DoubColor === 'number' ||
    typeof data?.A3SingBlaWh === 'number' ||
    typeof data?.A3SingColor === 'number' ||
    typeof data?.A3DoubBlaWh === 'number' ||
    typeof data?.A3DoubColor === 'number';

  if (!hasLegacy) return undefined;

  const pricing: ShopPricing = {
    a4: {
      singleBW: data.A4SingBlaWh ?? 0,
      doubleBW: data.A4DoubBlaWh ?? 0,
      singleColor: data.A4SingColor ?? 0,
      doubleColor: data.A4DoubColor ?? 0
    },
    a3: {
      singleBW: data.A3SingBlaWh ?? 0,
      doubleBW: data.A3DoubBlaWh ?? 0,
      singleColor: data.A3SingColor ?? 0,
      doubleColor: data.A3DoubColor ?? 0
    },
    services: {
      softBinding: data.SoftBinding ?? data.softBinding ?? 0,
      spiralBinding: data.SpiralBinding ?? data.spiralBinding ?? 0,
      hardBinding: data.HardBinding ?? data.hardBinding ?? 0,
      emergency: data.EmergencyPr ?? data.emergency ?? 0,
      afterDark: data.AfterDarkPr ?? data.afterDark ?? data.afterdark ?? 0
    }
  };

  return pricing;
}
