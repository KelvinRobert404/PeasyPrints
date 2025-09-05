"use client";

import { useEffect, useMemo, useRef } from "react";
import { useIdle } from "@/hooks/useIdle";
import { useSoundLeader } from "@/hooks/useSoundLeader";
import { useOrderAudio } from "@/hooks/useOrderAudio";

export type MinimalOrder = {
  id: string;
  status: string;
  timestamp?: any;
  createdAt?: any;
};

/**
 * Orchestrates audible alerts for orders:
 * - Chime on new orders once
 * - Loop when any order has been pending beyond threshold AND user is idle or tab hidden
 */
export function useOrderAlerts(params: {
  getOrders: () => MinimalOrder[];
  pendingThresholdMs?: number;
  idleMs?: number;
  muted?: boolean;
}) {
  const pendingThresholdMs = params.pendingThresholdMs ?? 120000; // 2 minutes
  const idleMs = params.idleMs ?? 20000; // 20 seconds
  const muted = params.muted ?? false;
  const { isIdle, isTabHidden } = useIdle(idleMs);
  const { isLeader } = useSoundLeader();
  const { enable, enabled, playChime, startLoop, stopLoop } = useOrderAudio();

  const lastSeenIdsRef = useRef<Set<string>>(new Set());

  const orders = params.getOrders();

  const unresolvedOrders = useMemo(() => orders, [orders]);

  // One-shot chime on new orders
  useEffect(() => {
    if (!isLeader || !enabled || muted) return;
    const unseen = unresolvedOrders.filter((o) => !lastSeenIdsRef.current.has(o.id));
    if (unseen.length > 0) {
      void playChime();
      unseen.forEach((o) => lastSeenIdsRef.current.add(o.id));
    }
  }, [unresolvedOrders, isLeader, enabled, muted, playChime]);

  // Looping alert when overdue + idle/hidden
  useEffect(() => {
    if (muted) { stopLoop(); return; }
    const now = Date.now();
    const getMillis = (t: any): number | null => {
      if (!t) return null;
      try {
        // Firestore Timestamp
        if (typeof t?.toMillis === "function") return t.toMillis();
      } catch {}
      try {
        const d = new Date(t as any);
        const n = d.getTime();
        return isNaN(n) ? null : n;
      } catch {
        return null;
      }
    };

    const overduePending = unresolvedOrders.some((o) => {
      // consider statuses that are not completed/cancelled
      if (["completed", "cancelled", "collected"].includes(o.status)) return false;
      const ts = getMillis((o as any).timestamp ?? (o as any).createdAt);
      if (ts === null) return false;
      return now - ts >= pendingThresholdMs;
    });

    const shouldLoop = overduePending && (isIdle || isTabHidden);

    if (isLeader && enabled && shouldLoop) {
      void startLoop();
    } else {
      stopLoop();
    }
  }, [unresolvedOrders, isIdle, isTabHidden, isLeader, enabled, muted, pendingThresholdMs, startLoop, stopLoop]);

  return { enable, enabled } as const;
}


