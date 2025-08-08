import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { Shop } from '@/types/models';

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
          return {
            id: d.id,
            name: data.name ?? 'Shop',
            address: data.address ?? '',
            timing: data.timing,
            logoUrl: data.logoUrl,
            pricing: data.pricing
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
