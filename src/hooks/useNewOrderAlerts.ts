"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface UseNewOrderAlertsOptions {
  shopId?: string;
}

export function useNewOrderAlerts(opts: UseNewOrderAlertsOptions) {
  const shopId = opts.shopId;
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const latestTsRef = useRef<number>(0);
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem('sf_last_seen_order_ts') || 0);
      latestTsRef.current = Number.isFinite(v) ? v : 0;
    } catch { }
  }, []);

  useEffect(() => {
    if (!shopId) return;
    const qPending = query(
      collection(db, 'orders'),
      where('shopId', '==', shopId),
      where('status', 'in', ['pending', 'processing', 'printing', 'printed']),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(qPending, (snap) => {
      const docs = snap.docs.map((d) => ({ ...(d.data() as any), id: d.id })) as any[];
      const latest: any = docs[0];
      const ts = toMillis(latest?.timestamp) ?? toMillis(latest?.createdAt);
      if (!ts) return;
      if (ts > latestTsRef.current) {
        latestTsRef.current = ts;
        try { localStorage.setItem('sf_last_seen_order_ts', String(ts)); } catch { }
        setHasNewOrder(true);
        // Always notify once on new order, regardless of visibility
        notifyNewOrder();
      }
    });
    return () => unsub();
  }, [shopId]);

  function toMillis(v: any): number | null {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    return null;
  }

  function notifyNewOrder() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const send = () => {
      try {
        const n = new Notification('New order', {
          body: 'Tap to open Dashboard',
          tag: 'shopfront-new-order',
          icon: '/icons/shopfront-notification.svg',
        });
        n.onclick = () => {
          window.focus();
          window.location.href = '/shopfront';
          n.close();
        };
      } catch { }
    };
    if (Notification.permission === 'granted') {
      send();
    } else if (Notification.permission !== 'denied' && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      Notification.requestPermission().then((p) => {
        if (p === 'granted') send();
      }).finally(() => { permissionRequestedRef.current = false; });
    }
  }

  function clearNewOrderFlag() {
    setHasNewOrder(false);
  }

  return { hasNewOrder, clearNewOrderFlag } as const;
}


