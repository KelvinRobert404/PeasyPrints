"use client";

import { useEffect, useMemo, useState } from 'react';
import { useGodviewStore } from '@/lib/stores/godviewStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOrderAlerts } from '@/hooks/useOrderAlerts';

export default function GodviewPage() {
  const {
    shops,
    orders,
    pendingOrders,
    historyOrders,
    subscribe,
    pollSnapshot,
    selectedShopIds,
    setSelectedShopIds,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    bulkToggleShops,
    updateOrderStatus,
    setOrderEmergency,
    cancelOrder,
  } = useGodviewStore();

  useEffect(() => {
    // If passphrase exists in session storage, use polling mode; otherwise use live listeners
    try {
      const pass = sessionStorage.getItem('godview_passphrase');
      if (pass) {
        const stop = pollSnapshot(pass);
        return () => { if (stop) stop(); };
      }
    } catch {}
    const unsub = subscribe();
    return () => { if (unsub) unsub(); };
  }, [subscribe, pollSnapshot]);

  // Alerts: chime on new orders
  const { enable: enableSound } = useOrderAlerts({
    getOrders: () => pendingOrders as any,
    pendingThresholdMs: 120000,
    idleMs: 20000,
    muted: false,
  });
  useEffect(() => { enableSound(); }, [enableSound]);

  // KPIs
  const kpi = useMemo(() => {
    const online = shops.filter((s) => (s as any).isOpen !== false).length;
    const totalShops = shops.length;
    const queue = pendingOrders.length;
    const totalOrders = orders.length;
    return { online, totalShops, queue, totalOrders };
  }, [shops, pendingOrders, orders]);

  // Filtering
  const filteredOrders = useMemo(() => {
    const selected = new Set(selectedShopIds);
    return orders.filter((o: any) => {
      if (selected.size > 0 && !selected.has(o.shopId)) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (searchText) {
        const hay = `${o.id || ''} ${o.userName || ''} ${o.phoneNumber || ''} ${o.shopName || ''}`.toLowerCase();
        if (!hay.includes(searchText.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, selectedShopIds, statusFilter, searchText]);

  // Bulk actions
  const [confirmOpen, setConfirmOpen] = useState<null | { open: boolean }>(null);
  const selectedSet = new Set(selectedShopIds);
  const selectedShops = shops.filter((s) => selectedSet.has(s.id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Online shops</CardTitle></CardHeader>
          <CardContent className="p-3 pt-2 text-2xl font-semibold">{kpi.online}/{kpi.totalShops}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Queue</CardTitle></CardHeader>
          <CardContent className="p-3 pt-2 text-2xl font-semibold">{kpi.queue}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Orders (recent)</CardTitle></CardHeader>
          <CardContent className="p-3 pt-2 text-2xl font-semibold">{kpi.totalOrders}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm">Selected shops</CardTitle></CardHeader>
          <CardContent className="p-3 pt-2 text-2xl font-semibold">{selectedShopIds.length}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="orders">All Orders</TabsTrigger>
          <TabsTrigger value="shops">Shops</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3">
          {renderFilters({ shops, selectedShopIds, setSelectedShopIds, statusFilter, setStatusFilter, searchText, setSearchText })}
          <div className="overflow-x-auto">
            {renderOrdersTable(pendingOrders as any, { updateOrderStatus, setOrderEmergency, cancelOrder })}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-3">
          {renderFilters({ shops, selectedShopIds, setSelectedShopIds, statusFilter, setStatusFilter, searchText, setSearchText })}
          <div className="overflow-x-auto">
            {renderOrdersTable(filteredOrders as any, { updateOrderStatus, setOrderEmergency, cancelOrder })}
          </div>
        </TabsContent>

        <TabsContent value="shops" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setConfirmOpen({ open: true })} disabled={selectedShopIds.length === 0}>Open selected</Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmOpen({ open: false })} disabled={selectedShopIds.length === 0}>Close selected</Button>
          </div>
          <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Pick</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((s) => {
                const picked = selectedSet.has(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <input type="checkbox" checked={picked} onChange={(e) => {
                        const next = new Set(selectedSet);
                        if (e.target.checked) next.add(s.id); else next.delete(s.id);
                        setSelectedShopIds(Array.from(next));
                      }} />
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      {(s as any).isOpen !== false ? <Badge variant="success">Open</Badge> : <Badge variant="destructive">Closed</Badge>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{s.address}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>

          <Dialog open={confirmOpen != null} onOpenChange={() => setConfirmOpen(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{confirmOpen?.open ? 'Open selected shops?' : 'Close selected shops?'}</DialogTitle>
                <DialogDescription>
                  {selectedShops.length} shop(s) will be {confirmOpen?.open ? 'opened' : 'closed'}. This takes effect immediately.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmOpen(null)}>Cancel</Button>
                <Button variant={confirmOpen?.open ? 'default' : 'destructive'} onClick={async () => {
                  await bulkToggleShops(selectedShopIds, !!confirmOpen?.open);
                  setConfirmOpen(null);
                }}>{confirmOpen?.open ? 'Open' : 'Close'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <div className="overflow-x-auto">
            {renderOrdersTable(historyOrders as any, { updateOrderStatus, setOrderEmergency, cancelOrder })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function renderFilters(args: {
  shops: any[];
  selectedShopIds: string[];
  setSelectedShopIds: (ids: string[]) => void;
  statusFilter: string;
  setStatusFilter: (s: any) => void;
  searchText: string;
  setSearchText: (s: string) => void;
}) {
  const { shops, selectedShopIds, setSelectedShopIds, statusFilter, setStatusFilter, searchText, setSearchText } = args;
  const selectedSet = new Set(selectedShopIds);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input placeholder="Search (order id, customer, phone)" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full sm:w-72" />
      <select className="border rounded h-9 px-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        {['all','processing','printing','printed','collected','completed','cancelled'].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <div className="flex items-center gap-2 overflow-x-auto py-1 w-full">
        {shops.map((s) => {
          const active = selectedSet.has(s.id);
          return (
            <Button key={s.id} size="sm" className="shrink-0" variant={active ? 'default' : 'outline'} onClick={() => {
              const next = new Set(selectedSet);
              if (active) next.delete(s.id); else next.add(s.id);
              setSelectedShopIds(Array.from(next));
            }}>{s.name}</Button>
          );
        })}
        {shops.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setSelectedShopIds([])}>Clear</Button>
        )}
      </div>
    </div>
  );
}

function renderOrdersTable(rows: any[], actions?: { updateOrderStatus?: any; setOrderEmergency?: any; cancelOrder?: any }) {
  return (
    <Table className="min-w-[880px]">
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Order</TableHead>
          <TableHead className="hidden sm:table-cell">Shop</TableHead>
          <TableHead className="hidden md:table-cell">Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Total</TableHead>
          {actions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="text-muted-foreground">{toTime(o.timestamp)}</TableCell>
            <TableCell className="font-medium">{o.id}</TableCell>
            <TableCell className="hidden sm:table-cell">{o.shopName || o.shopId}</TableCell>
            <TableCell className="hidden md:table-cell">{o.userName || '-'}</TableCell>
            <TableCell><Badge>{o.status}</Badge></TableCell>
            <TableCell className="hidden sm:table-cell">₹{Number(o.totalCost || 0).toFixed(0)}</TableCell>
            {actions && (
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline" onClick={() => actions.updateOrderStatus?.(o.id, nextStatus(o.status))}>Advance</Button>
                <Button size="sm" variant={o.emergency ? 'default' : 'outline'} onClick={() => actions.setOrderEmergency?.(o.id, !o.emergency)}>{o.emergency ? 'Unmark urgent' : 'Mark urgent'}</Button>
                {o.status !== 'cancelled' && <Button size="sm" variant="destructive" onClick={() => actions.cancelOrder?.(o)}>Cancel</Button>}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function toTime(ts: any) {
  try {
    const d: Date = ts?.toDate?.() || (typeof ts === 'number' ? new Date(ts) : null);
    if (!d) return '-';
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return '-'; }
}

function nextStatus(s: string): string {
  switch (s) {
    case 'processing': return 'printing';
    case 'printing': return 'printed';
    case 'printed': return 'collected';
    case 'collected': return 'completed';
    default: return s;
  }
}


