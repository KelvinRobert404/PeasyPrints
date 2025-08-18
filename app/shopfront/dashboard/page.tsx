"use client";

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useShopStore } from '@/lib/stores/shopStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Download, X } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

export default function ShopfrontDashboardPage() {
  const { user } = useAuthStore();
  const { currentShop, pendingOrders, fetchShopData, fetchOrders, updateOrderStatus, completeOrder, cancelOrder } = useShopStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const openedOrder = useMemo(() => pendingOrders.find((o: any) => (o as any).id === openId), [pendingOrders, openId]);

  useEffect(() => {
    if (!user?.uid) return;
    void fetchShopData(user.uid);
    let unsub: undefined | (() => void);
    (async () => { unsub = await fetchOrders(user.uid); })();
    return () => { if (unsub) unsub(); };
  }, [user?.uid, fetchShopData, fetchOrders]);

  if (!user) return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-24 w-full" />
    </div>
  );

  const totalOrders = pendingOrders.length;
  const completed = 0; // summary can be derived via history store if needed
  const todaysRevenue = 0; // placeholder; compute via date filter on history
  const availableBalance = (currentShop as any)?.receivableAmount ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completed}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Today's Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{todaysRevenue}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{currentShop ? (currentShop as any).receivableAmount ?? 0 : 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-500">Pending Orders</div>
        {pendingOrders.length === 0 ? (
          <Card className="border-0 shadow-sm"><CardContent>No pending orders</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {pendingOrders.map((o) => (
              <Card key={(o as any).id} className={`border ${o.emergency ? 'emergency-order' : ''}`} onClick={() => { setOpenId((o as any).id); if (o.status === 'pending') void updateOrderStatus((o as any).id, 'printing'); }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{o.userName} • {o.fileName}</div>
                    <div className="flex items-center gap-2">
                      {o.emergency && <Badge variant="destructive">URGENT</Badge>}
                      <Badge variant="secondary">{o.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => cancelOrder((o as any).id, o)}><X className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!openId} onOpenChange={(o) => setOpenId(o ? openId : null)}>
        <DialogContent>
          {openedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="font-quinn">Order Details</DialogTitle>
                <DialogDescription>{openedOrder.userName} - {openedOrder.fileName}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {openedOrder.emergency && <Badge variant="destructive">URGENT</Badge>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500">Paper Size</div>
                  <div className="font-medium">{openedOrder.printSettings?.paperSize}</div>
                  <div className="text-gray-500">Format</div>
                  <div className="font-medium">{openedOrder.printSettings?.printFormat}</div>
                  <div className="text-gray-500">Color</div>
                  <div className="font-medium">{openedOrder.printSettings?.printColor}</div>
                  <div className="text-gray-500">Copies</div>
                  <div className="font-medium">{openedOrder.printSettings?.copies}</div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500">Total Pages</div>
                  <div className="font-semibold">{openedOrder.totalPages}</div>
                  <div className="text-gray-500">Amount</div>
                  <div className="font-semibold">₹{openedOrder.totalCost}</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline"><Download className="h-4 w-4 mr-2" />Download</Button>
                <Button variant="destructive" onClick={() => { if (!openId) return; void cancelOrder(openId, openedOrder); setOpenId(null); }}>Cancel</Button>
                <Button onClick={() => { if (!openId) return; void completeOrder(openId, openedOrder); setOpenId(null); }}>Complete</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


