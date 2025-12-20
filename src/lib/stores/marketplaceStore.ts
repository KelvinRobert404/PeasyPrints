"use client";

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Listing, ListingCategory } from '@/types/models';
import { useCollegeStore } from './collegeStore';

interface MarketplaceState {
  listings: Listing[];
  loading: boolean;
  error: string | null;
  subscribe: () => () => void;
}

export const useMarketplaceStore = create<MarketplaceState>()(
  immer((set) => ({
    listings: [],
    loading: false,
    error: null,
    subscribe: () => {
      set((s) => {
        s.loading = true;
        s.error = null;
      });

      const collegeName = useCollegeStore.getState().selectedCollege;

      const q = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        where('collegeName', '==', collegeName),
        orderBy('createdAt', 'desc')
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const listings: Listing[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Listing, 'id'>),
          }));
          set((s) => {
            s.listings = listings;
            s.loading = false;
          });
        },
        (err) => {
          set((s) => {
            s.error = err.message;
            s.loading = false;
          });
        }
      );

      return unsub;
    },
  }))
);

export function filterListingsByCategory(listings: Listing[], category: ListingCategory) {
  return listings.filter((l) => l.category === category);
}









