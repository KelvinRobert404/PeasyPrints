'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * The dock's live slot: one ink bar above the tab bar whose content changes per screen
 * (e.g. "Print ready for pickup → View code" on Home, "Got something to sell? → Post" on Market).
 */
export type DockSlot = {
  id: string;
  title: string;
  subtitle?: string;
  /** Colour of the square status tile on the left. */
  tone?: 'go' | 'royal' | 'white';
  icon?: 'check' | 'plus' | 'tag' | 'print' | 'clock' | 'ticket';
  action?: { label: string; href: string };
  /** Where tapping the whole bar goes (defaults to action.href). */
  href?: string;
};

type DockState = {
  slot: DockSlot | null;
  hidden: boolean;
  setSlot: (slot: DockSlot | null) => void;
  clearSlot: (id: string) => void;
  setHidden: (hidden: boolean) => void;
};

export const useDockStore = create<DockState>((set, get) => ({
  slot: null,
  hidden: false,
  setSlot: (slot) => set({ slot }),
  clearSlot: (id) => {
    if (get().slot?.id === id) set({ slot: null });
  },
  setHidden: (hidden) => set({ hidden })
}));

/** Show a live slot while the calling screen is mounted. Pass null to show nothing. */
export function useDockSlot(slot: DockSlot | null) {
  const setSlot = useDockStore((s) => s.setSlot);
  const clearSlot = useDockStore((s) => s.clearSlot);
  const key = slot ? JSON.stringify(slot) : '';

  useEffect(() => {
    if (!slot) return;
    setSlot(slot);
    return () => clearSlot(slot.id);
  }, [key, setSlot, clearSlot]);
}

/** Hide the whole dock while the calling screen is mounted (e.g. checkout with its own sticky bar). */
export function useHideDock(hidden = true) {
  const setHidden = useDockStore((s) => s.setHidden);
  useEffect(() => {
    if (!hidden) return;
    setHidden(true);
    return () => setHidden(false);
  }, [hidden, setHidden]);
}
