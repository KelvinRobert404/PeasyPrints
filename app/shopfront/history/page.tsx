"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useShopStore } from '@/lib/stores/shopStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function ShopfrontHistoryPage() {
  const { user } = useAuthStore();
  const { historyOrders, fetchShopData, fetchOrders } = useShopStore();

  useEffect(() => {
    if (!user?.uid) return;
    void fetchShopData(user.uid);
    let unsub: undefined | (() => void);
    (async () => { unsub = await fetchOrders(user.uid); })();
    return () => { if (unsub) unsub(); };
  }, [user?.uid, fetchShopData, fetchOrders]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 mb-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹0</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Order History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyOrders.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.userName}</TableCell>
                  <TableCell>{o.fileName}</TableCell>
                  <TableCell>{new Date(o.historyTimestamp?.toDate?.() || o.historyTimestamp || o.timestamp).toLocaleString()}</TableCell>
                  <TableCell>₹{o.totalCost}</TableCell>
                  <TableCell>
                    <Badge variant={o.status === 'completed' ? 'default' : 'destructive'}>
                      {o.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


