"use client";

import { useEffect, useRef } from "react";

/**
 * Blinks the tab title to draw attention when `active` is true and the tab is hidden.
 * Restores the original title on cleanup or when deactivated.
 */
export function useTabAttention(active: boolean, options?: { message?: string; intervalMs?: number }) {
  const originalTitleRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = options?.intervalMs ?? 1200;
    const msg = options?.message ?? "New orders waiting";

    const isHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (!active || !isHidden) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (originalTitleRef.current !== null) {
        try { document.title = originalTitleRef.current; } catch {}
      }
      return;
    }

    if (originalTitleRef.current === null) {
      try { originalTitleRef.current = document.title; } catch { originalTitleRef.current = ""; }
    }

    let toggle = false;
    timerRef.current = window.setInterval(() => {
      try {
        document.title = toggle ? msg : (originalTitleRef.current || "");
        toggle = !toggle;
      } catch {}
    }, interval);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (originalTitleRef.current !== null) {
          try { document.title = originalTitleRef.current; } catch {}
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (originalTitleRef.current !== null) {
        try { document.title = originalTitleRef.current; } catch {}
      }
    };
  }, [active, options?.intervalMs, options?.message]);
}


