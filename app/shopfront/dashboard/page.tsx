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
  useEffect(() => { try { localStorage.setItem('sf_showRevenue', showRevenue ? '1' : '0'); } catch { } }, [showRevenue]);
  const todaysRevenue = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
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
  // Day-only datasets for Completed/Cancelled (today). Pending shows ALL.
  const today = new Date();
  const pendingBase = useMemo(() => (pendingOrders as any), [pendingOrders]);
  const historyTodayBase = useMemo(() => (historyOrders as any).filter((o: any) => {
    // Prefer historyTimestamp if present, else timestamp
    const d = coerceDate((o as any).historyTimestamp || o.timestamp); return !!d && isSameDay(d as Date, today);
  }), [historyOrders]);
  const completedTodayBase = useMemo(() => historyTodayBase.filter((o: any) => o.status === 'completed'), [historyTodayBase]);
  const cancelledTodayBase = useMemo(() => historyTodayBase.filter((o: any) => o.status === 'cancelled'), [historyTodayBase]);

  const pendingAll = useMemo(() => pendingBase.filter((o: any) => matchesQuery(o, search)), [pendingBase, search]);
  const completedToday = useMemo(() => completedTodayBase.filter((o: any) => matchesQuery(o, search)), [completedTodayBase, search]);
  const cancelledToday = useMemo(() => cancelledTodayBase.filter((o: any) => matchesQuery(o, search)), [cancelledTodayBase, search]);

  const completedTodayCount = completedTodayBase.length;
  const cancelledTodayCount = cancelledTodayBase.length;

  // History tab: separate range and filter (default last 7 days)
  function toYMD(d: Date) { return toLocalYMD(d); }
  const last7 = (() => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return { start: toYMD(start), end: toYMD(end) }; })();
  const [historyFilterOpen, setHistoryFilterOpen] = useState(false);
  const [historyRange, setHistoryRange] = useState<{ start: string; end: string }>(last7);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [helperOpen, setHelperOpen] = useState(false);
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
    return <div className="text-xs text-gray-500">Showing {pendingAll.length} of {pendingBase.length}</div>;
  }
  function OrdersHeaderBar({ activeValue, setValue }: any) {
    return (
      <div className="flex items-center justify-between">
        <TabsList variant="underline" className="flex-1" activeValue={activeValue} setValue={setValue}>
          <TabsTrigger value="pending">
            <span>Pending</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-900 px-1 text-xs text-white">{pendingBase.length}</span>
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

  function getDateLabelParts(input: any): { label?: 'Today' | 'Yesterday'; formattedDate?: string; time: string } {
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
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { formattedDate: `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`, time: formatTime(date) };
  }

  return (
    <div className="space-y-6">
      {!user ? (
        <div className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : null}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Orders</p>
                <div className="mt-2 text-3xl font-bold font-quinn text-gray-900">{totalOrders}</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</p>
                <div className="mt-2 text-3xl font-bold font-quinn text-blue-600">{pendingCount}</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Revenue</p>
                  <button onClick={() => setShowRevenue(!showRevenue)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    {showRevenue ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
                <div className="mt-2 text-3xl font-bold font-quinn text-emerald-600 truncate">
                  {showRevenue ? `₹${todaysRevenue}` : '••••'}
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-emerald-50/50" />
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</p>
                  <button onClick={() => setShowRevenue(!showRevenue)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    {showRevenue ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
                <div className="mt-2 text-3xl font-bold font-quinn text-gray-900 truncate">
                  {showRevenue ? `₹${totalRevenue}` : '••••'}
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Tabs defaultValue="pending" className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <TabsList className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 inline-flex h-auto">
              <TabsTrigger
                value="pending"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none transition-all"
              >
                Pending <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs font-bold">{pendingBase.length}</span>
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none transition-all"
              >
                Completed <span className="ml-2 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-xs font-bold">{completedTodayCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="cancelled"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-none transition-all"
              >
                Cancelled <span className="ml-2 bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-xs font-bold">{cancelledTodayCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-none transition-all"
              >
                History <span className="ml-2 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-xs font-bold">{historyInRangeBase.length}</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={searchRaw}
                  onChange={(e) => setSearchRaw(e.target.value)}
                  placeholder="Search orders..."
                  className="h-9 w-64 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                />
              </div>
              <OrdersHeaderShowing activeValue={'pending'} /> {/* Placeholder aid for showing counts */}
            </div>
          </div>

          <TabsContent value="pending" className="mt-0">
            {pendingAll.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900">All caught up!</h3>
                <p className="mt-1 text-sm text-gray-500">No pending orders at the moment.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <ShopfrontPendingTable
                  orders={pendingAll as any}
                  isWindows={isWindows()}
                  onPrint={(o) => {
                    const jobId = (o as any).id as string; if (!jobId) return;
                    triggerPeasyPrint(jobId, {
                      onMissingHelper: () => { setHelperOpen(true); }
                    });
                    setStatusMessage('Connecting to printer...');
                    setTimeout(() => setStatusMessage('Sending file...'), 800);
                  }}
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

          <TabsContent value="completed" className="mt-0">
            {completedToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center">
                <p className="text-sm text-gray-500">No completed orders yet today.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <ShopfrontHistoryTable
                  orders={completedToday as any}
                  onUndoCollected={(o) => { void undoCollected(o.orderId, o); }}
                  onUndoCancelled={(o) => { void undoCancelled(o.orderId, o); }}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="mt-0">
            {cancelledToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center">
                <p className="text-sm text-gray-500">No cancelled orders today.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <ShopfrontHistoryTable
                  orders={cancelledToday as any}
                  onUndoCollected={(o) => { void undoCollected(o.orderId, o); }}
                  onUndoCancelled={(o) => { void undoCancelled(o.orderId, o); }}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {/* Keeping existing history filter logic but wrapping in improved container if needed. 
                For brevity, reusing existing but ensuring it's cleaner. 
            */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Range:</span>
                  <input
                    type="date"
                    value={historyRange.start}
                    onChange={(e) => setHistoryRange({ start: e.target.value, end: historyRange.end })}
                    className="text-sm border rounded-lg px-2 py-1.5 bg-gray-50"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={historyRange.end}
                    onChange={(e) => setHistoryRange({ start: historyRange.start, end: e.target.value })}
                    className="text-sm border rounded-lg px-2 py-1.5 bg-gray-50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setHistoryRange({ start: toLocalYMD(d), end: toLocalYMD(d) }); }}>Today</Button>
                  <Button variant="outline" size="sm" onClick={() => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); setHistoryRange({ start: toLocalYMD(start), end: toLocalYMD(end) }); }}>Last 7 Days</Button>
                </div>
              </div>

              {historyFiltered.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">No orders found in this range.</div>
              ) : (
                <ShopfrontHistoryTable
                  orders={historyFiltered as any}
                  showUndo={false}
                  onUndoCollected={(o) => { void undoCollected(o.orderId, o); }}
                  onUndoCancelled={(o) => { void undoCancelled(o.orderId, o); }}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Helper missing dialog */}
      <Dialog open={helperOpen} onOpenChange={setHelperOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PeasyPrint Helper required</DialogTitle>
            <DialogDescription>
              PeasyPrint Helper was not detected on this computer. Install it once, then click Print again.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 text-center">
            <Link href="/helper">
              <Button size="lg" className="w-full">Download Helper</Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom toast notification */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {statusMessage && (
          <div className="pointer-events-auto rounded-full bg-gray-900 text-white shadow-xl px-6 py-3 text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {statusMessage}
          </div>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}


