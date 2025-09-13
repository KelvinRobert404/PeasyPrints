"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Tracks whether the user is idle based on input events and page visibility.
 * - isIdle: becomes true after no activity for `idleMs` or when tab is hidden
 * - isTabHidden: true when document is hidden
 */
export function useIdle(idleMs: number = 20000): { isIdle: boolean; isTabHidden: boolean } {
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const [isTabHidden, setIsTabHidden] = useState<boolean>(typeof document !== "undefined" ? document.visibilityState === "hidden" : false);
  const lastActiveAtMs = useRef<number>(Date.now());

  useEffect(() => {
    const markActive = () => {
      lastActiveAtMs.current = Date.now();
      if (document.visibilityState === "visible") {
        setIsIdle(false);
      }
    };

    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      setIsTabHidden(hidden);
      if (!hidden) {
        markActive();
      }
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "keydown",
      "touchstart",
      "touchmove",
      "pointerdown",
      "pointermove",
      "wheel",
      "scroll",
      "click",
      "focus",
    ];
    events.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastActiveAtMs.current > idleMs) {
        setIsIdle(true);
      }
    }, 1000);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markActive));
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, [idleMs]);

  return { isIdle, isTabHidden };
}


