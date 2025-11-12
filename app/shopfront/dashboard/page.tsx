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
import { ExternalLink, X, Eye, EyeOff, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useOrderAlerts } from '@/hooks/useOrderAlerts';
import { useTabAttention } from '@/hooks/useTabAttention';
import { useIdle } from '@/hooks/useIdle';
import { triggerPeasyPrint, isWindows } from '@/lib/utils/peasyPrint';
import { ShopfrontPendingTable } from '@/components/orders/ShopfrontPendingTable';
import { ShopfrontHistoryTable } from '@/components/orders/ShopfrontHistoryTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const idleMs = 20000;
  const { enable: enableSound, enabled: soundEnabled } = useOrderAlerts({
    getOrders: () => (orders as any).filter((o: any) => o.status === 'processing' || o.status === 'printing'),
    pendingThresholdMs: 120000,
    idleMs,
    muted: !isOpen,
  });

  // Blink tab title when there are pending orders and the tab is hidden/idle
  const { isIdle } = useIdle(idleMs);
  const hasPending = (orders as any).some((o: any) => o.status === 'processing' || o.status === 'printing');
  useTabAttention(isOpen && hasPending && isIdle, {
    message: 'NEW ORDERS WAITING',
    intervalMs: 500,
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
  // Counts for badges (day-only for status tabs)
  const pendingCount = pendingOrders.length;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const searchInputRef = useState<HTMLInputElement | null>(null)[0] as any;
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchRaw.trim()), 300);
    return () => clearTimeout(id);
  }, [searchRaw]);
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

  // Helpers for day/range checks
  function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function matchesQuery(o: any, q: string): boolean {
    if (!q) return true;
    const s = q.toLowerCase();
    return String(o.userName || '').toLowerCase().includes(s) || String(o.fileName || '').toLowerCase().includes(s);
  }
  // Day-only datasets for Pending/Completed/Cancelled (today)
  const today = new Date();
  const pendingTodayBase = useMemo(() => (pendingOrders as any).filter((o: any) => {
    const d = coerceDate(o.timestamp); return !!d && isSameDay(d, today);
  }), [pendingOrders]);
  const historyTodayBase = useMemo(() => (historyOrders as any).filter((o: any) => {
    // Prefer historyTimestamp if present, else timestamp
    const d = coerceDate((o as any).historyTimestamp || o.timestamp); return !!d && isSameDay(d as Date, today);
  }), [historyOrders]);
  const completedTodayBase = useMemo(() => historyTodayBase.filter((o: any) => o.status === 'completed'), [historyTodayBase]);
  const cancelledTodayBase = useMemo(() => historyTodayBase.filter((o: any) => o.status === 'cancelled'), [historyTodayBase]);

  const pendingToday = useMemo(() => pendingTodayBase.filter((o: any) => matchesQuery(o, search)), [pendingTodayBase, search]);
  const completedToday = useMemo(() => completedTodayBase.filter((o: any) => matchesQuery(o, search)), [completedTodayBase, search]);
  const cancelledToday = useMemo(() => cancelledTodayBase.filter((o: any) => matchesQuery(o, search)), [cancelledTodayBase, search]);

  const completedTodayCount = completedTodayBase.length;
  const cancelledTodayCount = cancelledTodayBase.length;

  // History tab: separate range and filter (default last 7 days)
  function toYMD(d: Date) { return toLocalYMD(d); }
  const last7 = (() => { const end = new Date(); const start = new Date(); start.setDate(start.getDate()-6); return { start: toYMD(start), end: toYMD(end) }; })();
  const [historyFilterOpen, setHistoryFilterOpen] = useState(false);
  const [historyRange, setHistoryRange] = useState<{ start: string; end: string }>(last7);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!statusMessage) return;
    const id = setTimeout(() => setStatusMessage(null), 2000);
    return () => clearTimeout(id);
  }, [statusMessage]);
  const historyInRangeBase = useMemo(() => {
    const start = new Date(historyRange.start + 'T00:00:00');
    const end = new Date(historyRange.end + 'T23:59:59');
    return (historyOrders as any).filter((o: any) => {
      const d = coerceDate((o as any).historyTimestamp || o.timestamp); if (!d) return false;
      return d >= start && d <= end;
    });
  }, [historyOrders, historyRange]);
  const historyFiltered = useMemo(() => historyInRangeBase.filter((o: any) => matchesQuery(o, search)), [historyInRangeBase, search]);

  // Header helpers to combine tabs + meta on a single top row
  function OrdersHeaderShowing({ activeValue }: any) {
    if (activeValue === 'completed') {
      return <div className="text-xs text-gray-500">Showing {completedToday.length} of {completedTodayCount}</div>;
    }
    if (activeValue === 'cancelled') {
      return <div className="text-xs text-gray-500">Showing {cancelledToday.length} of {cancelledTodayCount}</div>;
    }
    if (activeValue === 'history') {
      const sd = new Date(historyRange.start + 'T00:00:00');
      const ed = new Date(historyRange.end + 'T00:00:00');
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
      const rangeLabel = historyRange.start === historyRange.end ? fmt(sd) : `${fmt(sd)}–${fmt(ed)}`;
      return <div className="text-xs text-gray-500">Showing {historyFiltered.length} of {historyInRangeBase.length} • {rangeLabel}</div>;
    }
    return <div className="text-xs text-gray-500">Showing {pendingToday.length} of {pendingTodayBase.length}</div>;
  }
  function OrdersHeaderBar({ activeValue, setValue }: any) {
    return (
      <div className="flex items-center justify-between">
        <TabsList variant="underline" className="flex-1" activeValue={activeValue} setValue={setValue}>
          <TabsTrigger value="pending">
            <span>Pending</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-900 px-1 text-xs text-white">{pendingTodayBase.length}</span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            <span>Completed</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-900 px-1 text-xs text-white">{completedTodayCount}</span>
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            <span>Cancelled</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-900 px-1 text-xs text-white">{cancelledTodayCount}</span>
          </TabsTrigger>
          <TabsTrigger value="history">
            <span>History</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-900 px-1 text-xs text-white">{historyInRangeBase.length}</span>
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-3 ml-3">
          <div aria-live="polite"><OrdersHeaderShowing activeValue={activeValue} /></div>
          <button aria-label="Search" className="p-2 rounded hover:bg-gray-100" onClick={() => setSearchOpen((v) => !v)}>
            <Search className="h-4 w-4" />
          </button>
          {(activeValue === 'history' || activeValue === 'completed') && (
            <button aria-label="Filters" className="p-2 rounded hover:bg-gray-100" onClick={() => setHistoryFilterOpen((v) => !v)}>
              <Filter className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }


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
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">Orders</div>
        </div>
        <Tabs defaultValue="pending">
          <OrdersHeaderBar />
          {statusMessage && (
            <div aria-live="polite" className="mt-2">
              <Card className="border-0"><CardContent className="py-2 text-sm">{statusMessage}</CardContent></Card>
            </div>
          )}
          {searchOpen && (
            <div className="mt-2">
              <input
                ref={(el) => { if (el && document.activeElement !== el) el.focus(); }}
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchRaw('');
                    setSearch('');
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                placeholder="Search name or file…"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="mt-1 text-xs text-gray-500">{search ? 'Filtered' : 'Type to filter orders'}</div>
            </div>
          )}

          <TabsContent value="pending">
            {pendingToday.length === 0 ? (
              <Card className="border-0 shadow-sm"><CardContent>No pending orders today</CardContent></Card>
            ) : (
              <div className="max-h-[65vh] overflow-y-auto pr-1">
                <ShopfrontPendingTable
                  orders={pendingToday as any}
                  isWindows={isWindows()}
                  onPrint={(o) => { const jobId = (o as any).id as string; if (!jobId) return; triggerPeasyPrint(jobId, { onMissingHelper: () => { alert('PeasyPrint Helper not detected. Please install it, then click Print again.'); } }); setStatusMessage('Sent to printer'); }}
                  onCancel={(o) => { if (!((o as any).id)) return; if (!confirm('Cancel this order?')) return; void cancelOrder((o as any).id, o as any); setStatusMessage('Order cancelled'); }}
                  onMarkPrinted={(o) => { if (!((o as any).id)) return; void markPrinted((o as any).id); setStatusMessage('Marked as printed'); }}
                  onRevertToProcessing={(o) => { if (!((o as any).id)) return; void revertToProcessing((o as any).id); setStatusMessage('Reverted to processing'); }}
                  onCollected={async (o) => {
                    if (!((o as any).id)) return;
                    await completeOrder((o as any).id, o as any);
                    setStatusMessage('Marked as collected');
                  }}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-3 mt-3">
              {completedToday.length === 0 ? (
                <Card className="border-0 shadow-sm"><CardContent>No completed orders today</CardContent></Card>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto pr-1">
                  <ShopfrontHistoryTable
                    orders={completedToday as any}
                    onUndoCollected={(o) => { void undoCollected(o.orderId, o); }}
                    onUndoCancelled={(o) => { void undoCancelled(o.orderId, o); }}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cancelled">
            <div className="space-y-3 mt-3">
              {cancelledToday.length === 0 ? (
                <Card className="border-0 shadow-sm"><CardContent>No cancelled orders today</CardContent></Card>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto pr-1">
                  <ShopfrontHistoryTable
                    orders={cancelledToday as any}
                    onUndoCollected={(o) => { void undoCollected(o.orderId, o); }}
                    onUndoCancelled={(o) => { void undoCancelled(o.orderId, o); }}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            {historyFilterOpen && (
              <div className="mt-2 p-3 border rounded bg-white space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={historyRange.start}
                      onChange={(e) => setHistoryRange({ start: e.target.value, end: historyRange.end })}
                      className="text-xs border rounded px-2 py-1"
                    />
                    <span className="text-xs text-gray-500">to</span>
                    <input
                      type="date"
                      value={historyRange.end}
                      onChange={(e) => setHistoryRange({ start: historyRange.start, end: e.target.value })}
                      className="text-xs border rounded px-2 py-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-xs underline" onClick={() => { const d=new Date(); setHistoryRange({ start: toLocalYMD(d), end: toLocalYMD(d) }); }}>Today</button>
                  <button className="text-xs underline" onClick={() => { const d=new Date(); d.setDate(d.getDate()-1); const y=toLocalYMD(d); setHistoryRange({ start: y, end: y }); }}>Yesterday</button>
                  <button className="text-xs underline" onClick={() => { const end=new Date(); const start=new Date(); start.setDate(start.getDate()-6); setHistoryRange({ start: toLocalYMD(start), end: toLocalYMD(end) }); }}>Last 7 days</button>
                  <button className="text-xs underline" onClick={() => { const d=new Date(); setHistoryRange({ start: toLocalYMD(d), end: toLocalYMD(d) }); }}>Single day</button>
                </div>
              </div>
            )}
            <div className="space-y-3 mt-3">
              {historyFiltered.length === 0 ? (
                <Card className="border-0 shadow-sm"><CardContent>No orders in selected range</CardContent></Card>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto pr-1">
                  <ShopfrontHistoryTable
                    orders={historyFiltered as any}
                    showUndo={false}
                    onUndoCollected={(o) => { void undoCollected(o.orderId, o); }}
                    onUndoCancelled={(o) => { void undoCancelled(o.orderId, o); }}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="h-4" />
    </div>
  );
}


