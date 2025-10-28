"use client";

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/authStore';
import { useShopStore } from '@/lib/stores/shopStore';
import { BillingSummary } from '@/components/shopfront/BillingSummary';

export default function ShopfrontBillingPage() {
  const { user } = useAuthStore();
  const { fetchShopData, subscribePayoutRequests, subscribePayouts, fetchOrders } = useShopStore();

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    void fetchShopData(uid);
    let unsubReq: undefined | (() => void);
    let unsubOrders: undefined | (() => void);
    let unsubPayouts: undefined | (() => void);
    (async () => {
      unsubReq = await subscribePayoutRequests(uid);
      unsubPayouts = await subscribePayouts(uid);
      unsubOrders = await fetchOrders(uid);
    })();
    return () => { if (unsubReq) unsubReq(); if (unsubPayouts) unsubPayouts(); if (unsubOrders) unsubOrders(); };
  }, [user?.uid, fetchShopData, subscribePayoutRequests, subscribePayouts, fetchOrders]);

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <BillingSummary />
        </CardContent>
      </Card>
    </div>
  );
}


