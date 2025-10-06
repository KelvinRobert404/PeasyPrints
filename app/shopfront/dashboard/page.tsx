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
import { ExternalLink, X, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useOrderAlerts } from '@/hooks/useOrderAlerts';
import { useTabAttention } from '@/hooks/useTabAttention';

export default function ShopfrontDashboardPage() {
  const { user } = useAuthStore();
  const { currentShop, orders, pendingOrders, historyOrders, fetchShopData, fetchOrders, updateOrderStatus, completeOrder, cancelOrder, markPrinted, markCollected, revertToProcessing, undoCollected, undoCancelled } = useShopStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  function toLocalYMD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalYMD(new Date()));
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const openedOrder = useMemo(() => pendingOrders.find((o: any) => (o as any).id === openId), [pendingOrders, openId]);

  useEffect(() => {
    if (!user?.uid) return;
    void fetchShopData(user.uid);
    let unsub: undefined | (() => void);
    (async () => { unsub = await fetchOrders(user.uid); })();
    return () => { if (unsub) unsub(); };
  }, [user?.uid, fetchShopData, fetchOrders]);

  // Alerts: chime on new orders, loop when overdue and idle/unfocused
  const isOpen = (currentShop as any)?.isOpen !== false; // default to true if undefined
  const { enable: enableSound, enabled: soundEnabled } = useOrderAlerts({
    getOrders: () => (orders as any).filter((o: any) => o.status === 'processing' || o.status === 'printing'),
    pendingThresholdMs: 120000,
    idleMs: 20000,
    muted: !isOpen,
  });

  // Blink tab title when there are pending orders and the tab is hidden/idle
  useTabAttention((orders as any).some((o: any) => o.status === 'processing' || o.status === 'printing'), {
    message: 'New orders waiting',
    intervalMs: 1200,
  });

  // Removed early return to ensure hooks below run on every render
  const filteredHistoryByDate = useMemo(() => {
    const normalize = (date: Date) => toLocalYMD(date);
    const list = historyOrders;
    if (range) {
      const start = new Date(range.start + 'T00:00:00');
      const end = new Date(range.end + 'T23:59:59');
      return list.filter((o: any) => {
        const resolved = coerceDate(o.historyTimestamp);
        const d = resolved || (o.status === 'completed' ? new Date() : coerceDate(o.timestamp));
        if (!d) return false;
        return d >= start && d <= end;
      });
    } else {
      return list.filter((o: any) => {
        const resolved = coerceDate(o.historyTimestamp);
        const d = resolved || (o.status === 'completed' ? new Date() : coerceDate(o.timestamp));
        if (!d) return false;
        return normalize(d) === selectedDate;
      });
    }
  }, [historyOrders, selectedDate, range]);

  const totalOrders = orders.length;
  const pendingCount = pendingOrders.length;
  const [showRevenue, setShowRevenue] = useState<boolean>(() => {
    try { const v = localStorage.getItem('sf_showRevenue'); return v === null ? true : v === '1'; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem('sf_showRevenue', showRevenue ? '1' : '0'); } catch {} }, [showRevenue]);
  const todaysRevenue = useMemo(() => {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    return historyOrders
      .filter((o: any) => o.status === 'completed')
      .filter((o: any) => { const d = coerceDate(o.historyTimestamp || o.timestamp); return !!d && d >= start && d <= end; })
      .reduce((sum: number, o: any) => sum + Number(o.totalCost || 0), 0);
  }, [historyOrders]);
  const totalRevenue = useMemo(() => {
    return historyOrders
      .filter((o: any) => o.status === 'completed')
      .reduce((sum: number, o: any) => sum + Number(o.totalCost || 0), 0);
  }, [historyOrders]);
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
      {!user ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
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
              <CardTitle className="text-sm font-medium text-gray-500">Pending Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Today's Revenue</CardTitle>
                <button aria-label={showRevenue ? 'Hide revenue' : 'Show revenue'} onClick={() => setShowRevenue((v) => !v)} className="text-gray-500 hover:text-gray-800">
                  {showRevenue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{showRevenue ? `₹${todaysRevenue}` : '••••'}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
                <button aria-label={showRevenue ? 'Hide revenue' : 'Show revenue'} onClick={() => setShowRevenue((v) => !v)} className="text-gray-500 hover:text-gray-800">
                  {showRevenue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{showRevenue ? `₹${totalRevenue}` : '••••'}</div>
            </CardContent>
          </Card>
        </div>
        <div className="ml-3" />
        {/* Sound auto-enables; no manual button needed */}
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-500">Pending Orders</div>
        {pendingOrders.length === 0 ? (
          <Card className="border-0 shadow-sm"><CardContent>No pending orders</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {pendingOrders.map((o) => (
              <div key={(o as any).id} className="flex items-stretch gap-2">
                <Card className={`flex-1 border ${o.emergency ? 'emergency-order' : ''}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{o.userName} • {o.fileName}</div>
                      </div>
                      {o.splitFiles ? (
                        <div className="flex items-center gap-1">
                          {o.fileUrl && (
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>Original</Button>
                          )}
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.open((o as any).splitFiles?.bwUrl, '_blank', 'noopener,noreferrer'); }}>B&W</Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.open((o as any).splitFiles?.colorUrl, '_blank', 'noopener,noreferrer'); }}>Color</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); void cancelOrder((o as any).id, o); }}>
                        <X className="h-4 w-4" />
                      </Button>
                      {o.emergency && <Badge variant="destructive">URGENT</Badge>}
                      {!(o.status === 'processing' || o.status === 'printing' || o.status === 'printed') && (
                        <Badge variant="secondary">{o.status}</Badge>
                      )}
                    </div>
                    {/* Label badges inline */}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {(() => { const p = getDateLabelParts(o.timestamp); return (
                        <Badge variant="outline" className="font-bold bg-blue-50 text-blue-700 border-blue-200">{p.time}</Badge>
                      ); })()}
                      <Badge variant="outline">{o.printSettings?.paperSize}</Badge>
                      <Badge variant="outline">{o.printSettings?.printFormat}</Badge>
                      <Badge className={o.printSettings?.printColor === 'Black & White' ? 'bg-green-600/10 text-green-700 border-green-600/20' : 'bg-blue-600/10 text-blue-700 border-blue-600/20'}>
                        {o.printSettings?.printColor}
                      </Badge>
                      <Badge variant="outline">{o.printSettings?.copies} copies • {o.totalPages} pages</Badge>
                      <Badge variant="secondary">₹{o.totalCost}</Badge>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-2 self-stretch w-28">
                  {o.status !== 'printed' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 h-auto min-h-[48px]"
                      onClick={() => { if (!((o as any).id)) return; void markPrinted((o as any).id); }}
                    >
                      Printed
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-auto min-h-[48px]"
                      onClick={() => { if (!((o as any).id)) return; void revertToProcessing((o as any).id); }}
                    >
                      Undo Printed
                    </Button>
                  )}
                  {o.status !== 'printed' ? (
                    <Button size="sm" disabled className="flex-1 h-auto min-h-[48px]">
                      Collected
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1 h-auto min-h-[48px]"
                      onClick={async () => {
                        if (!((o as any).id)) return;
                        await completeOrder((o as any).id, o as any);
                        setRange(null);
                        setSelectedDate(toLocalYMD(new Date()));
                        setHistoryOpen(true);
                        setFilterOpen(true);
                        setTimeout(() => setHistoryOpen(false), 5000);
                      }}
                    >
                      Collected
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">History</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setFilterOpen((v) => !v)}>Filter</Button>
            <button className="text-xs text-blue-600" onClick={() => setHistoryOpen((v) => !v)}>
              {historyOpen ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {filterOpen && (
          <div className="mt-2 p-3 border rounded bg-white space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={range ? range.start : selectedDate}
                  onChange={(e) => range ? setRange({ start: e.target.value, end: range.end }) : setSelectedDate(e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={range ? range.end : selectedDate}
                  onChange={(e) => setRange({ start: range ? range.start : selectedDate, end: e.target.value })}
                  className="text-xs border rounded px-2 py-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs underline" onClick={() => { const d=new Date(); setRange(null); setSelectedDate(toLocalYMD(d)); }}>Today</button>
              <button className="text-xs underline" onClick={() => { const d=new Date(); d.setDate(d.getDate()-1); setRange(null); setSelectedDate(toLocalYMD(d)); }}>Yesterday</button>
              <button className="text-xs underline" onClick={() => { const end=new Date(); const start=new Date(); start.setDate(start.getDate()-6); setRange({ start: toLocalYMD(start), end: toLocalYMD(end) }); }}>Last 7 days</button>
              <button className="text-xs underline" onClick={() => setRange(null)}>Single day</button>
            </div>
          </div>
        )}
        {historyOpen && (
          <div className="space-y-3">
            {filteredHistoryByDate.length === 0 ? (
              <Card className="border-0 shadow-sm"><CardContent>No history for selected date</CardContent></Card>
            ) : (
              filteredHistoryByDate.map((o: any) => (
                <Card key={o.id} className={`border ${o.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{o.userName} • {o.fileName}</div>
                      </div>
                      {o.splitFiles ? (
                        <div className="flex items-center gap-1">
                          {o.fileUrl && (
                            <Button size="sm" variant="outline" onClick={() => { window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>Original</Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => { window.open((o as any).splitFiles?.bwUrl, '_blank', 'noopener,noreferrer'); }}>B&W</Button>
                          <Button size="sm" variant="outline" onClick={() => { window.open((o as any).splitFiles?.colorUrl, '_blank', 'noopener,noreferrer'); }}>Color</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => { if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {o.status === 'completed' && (
                        <Button size="sm" variant="outline" onClick={() => { void undoCollected(o.orderId, o); }}>
                          Undo Collected
                        </Button>
                      )}
                      {o.status === 'cancelled' && (
                        <Button size="sm" variant="outline" onClick={() => { void undoCancelled(o.orderId, o); }}>
                          Undo Cancelled
                        </Button>
                      )}
                      {o.emergency && <Badge variant="destructive">URGENT</Badge>}
                      {o.status !== 'completed' && (
                        <Badge variant="secondary">{o.status}</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {o.jobType && (
                        <Badge variant="secondary">{o.jobType}</Badge>
                      )}
                      <Badge variant="outline">{o.printSettings?.paperSize}</Badge>
                      <Badge variant="outline">{o.printSettings?.printFormat}</Badge>
                      <Badge className={o.printSettings?.printColor === 'Black & White' ? 'bg-green-600/10 text-green-700 border-green-600/20' : 'bg-blue-600/10 text-blue-700 border-blue-600/20'}>
                        {o.printSettings?.printColor}
                      </Badge>
                      <Badge variant="outline">{o.printSettings?.copies} copies • {o.totalPages} pages</Badge>
                      <Badge variant="secondary">₹{o.totalCost}</Badge>
                    </div>
                    
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}


