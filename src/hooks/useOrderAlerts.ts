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
  const pendingThresholdMs = params.pendingThresholdMs ?? 120000; // order age threshold (not used for loop condition)
  const idleMs = params.idleMs ?? 180000; // 3 minutes of inactivity required
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

  // Looping alert: only when there's at least one pending order AND user is inactive for idleMs
  useEffect(() => {
    if (muted) { stopLoop(); return; }
    // Whenever activity resumes (isIdle becomes false), stop the loop immediately
    if (!isIdle) { stopLoop(); }
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

    const hasPending = unresolvedOrders.some((o) => ["processing", "printing"].includes(o.status));
    // Require a full idle interval; do not auto-loop solely on hidden tab
    const shouldLoop = hasPending && isIdle;

    if (isLeader && enabled && shouldLoop) {
      void startLoop();
    } else {
      stopLoop();
    }
  }, [unresolvedOrders, isIdle, isLeader, enabled, muted, pendingThresholdMs, startLoop, stopLoop]);

  // Hard stop on visibility/activity events when returning to the tab
  useEffect(() => {
    if (!enabled) return;
    const stop = () => { stopLoop(); };
    const onVisibility = () => { if (document.visibilityState === "visible") stop(); };
    const events: Array<keyof WindowEventMap> = [
      "mousemove","keydown","touchstart","pointerdown","wheel","focus","click"
    ];
    events.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      events.forEach((e) => window.removeEventListener(e, stop as any));
      document.removeEventListener("visibilitychange", onVisibility as any);
    };
  }, [enabled, stopLoop]);

  return { enable, enabled } as const;
}


