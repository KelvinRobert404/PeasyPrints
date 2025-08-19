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
import { ExternalLink, X } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

export default function ShopfrontDashboardPage() {
  const { user } = useAuthStore();
  const { currentShop, pendingOrders, historyOrders, fetchShopData, fetchOrders, updateOrderStatus, completeOrder, cancelOrder } = useShopStore();
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

  function coerceDate(input: any): Date | null {
    const d: Date | null = input?.toDate?.() ? input.toDate() : (input ? new Date(input) : null);
    if (!d || isNaN(d.getTime())) return null;
    return d;
  }

  function formatTime(date: Date): string {
    let h = date.getHours();
    const m = date.getMinutes();
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')}${suffix}`;
  }

  function getDateLabelParts(input: any): { label?: 'Today'|'Yesterday'; formattedDate?: string; time: string } {
    const date = coerceDate(input);
    if (!date) return { time: '' };
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfGiven = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const isToday = startOfGiven.getTime() === startOfToday.getTime();
    const isYesterday = startOfGiven.getTime() === startOfYesterday.getTime();
    if (isToday) return { label: 'Today', time: formatTime(date) };
    if (isYesterday) return { label: 'Yesterday', time: formatTime(date) };
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return { formattedDate: `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}` , time: formatTime(date) };
  }

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
              <Card
                key={(o as any).id}
                className={`border ${o.emergency ? 'emergency-order' : ''}`}
                onClick={() => { setOpenId((o as any).id); if (o.status === 'pending') void updateOrderStatus((o as any).id, 'printing'); }}
              >
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{o.userName} • {o.fileName}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); void cancelOrder((o as any).id, o); }}>
                      <X className="h-4 w-4" />
                    </Button>
                    {o.emergency && <Badge variant="destructive">URGENT</Badge>}
                    <Badge variant="secondary">{o.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-500">History</div>
        {historyOrders.length === 0 ? (
          <Card className="border-0 shadow-sm"><CardContent>No completed or cancelled orders</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {historyOrders.map((o: any) => {
              const parts = getDateLabelParts(o.historyTimestamp || o.timestamp);
              return (
                <Card key={o.id} className={`border ${o.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{o.userName} • {o.fileName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {parts.label ? (
                          <Badge variant="secondary">{parts.label}</Badge>
                        ) : (
                          <span className="text-xs text-gray-500">{parts.formattedDate}</span>
                        )}
                        <span className="text-xs text-gray-500">{parts.time}</span>
                      </div>
                      <span className="text-sm text-gray-600">₹{o.totalCost}</span>
                      <Button size="sm" variant="outline" onClick={() => { if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Badge variant={o.status === 'completed' ? 'default' : 'destructive'}>{o.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
                <Button variant="outline" onClick={() => { if (openedOrder?.fileUrl) window.open(openedOrder.fileUrl, '_blank', 'noopener,noreferrer'); }}><ExternalLink className="h-4 w-4 mr-2" />Open</Button>
                <Button variant="destructive" onClick={() => { if (!openId) return; void cancelOrder(openId, openedOrder); setOpenId(null); }}>Cancel</Button>
                <Button onClick={() => { if (!openId) return; void completeOrder(openId, openedOrder); setOpenId(null); }}>Complete</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <div className="h-4" />
    </div>
  );
}


