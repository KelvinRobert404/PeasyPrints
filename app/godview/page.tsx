'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';
import { Segmented } from '@/components/swoop/primitives';
import { OrdersIcon } from '@/components/swoop/icons';
import { PageHead, SectionTitle, StatTile, TableState, gvCard, gvRow, gvTableHead } from './ui';

// Detailed stats for charts
interface ShopStatusCounts {
    pending: number;
    processing: number;
    printing: number;
    ready: number;
    completed: number;
    cancelled: number;
}

interface ShopOrderStats extends ShopStatusCounts {
    id: string;
    name: string;
    total: number;
}

interface FilteredAggregates {
    revenue: number;
    orders: number;
    pending: number;
    cancelled: number;
    completed: number;
}

interface LiveOrder {
    id: string;
    shopName: string;
    userName: string;
    fileName: string;
    status: string;
    totalCost: number;
    timestamp: any;
    itemCount: number;
}

type TimeFilter = 'today' | 'week' | 'month' | 'all';

// Status palette (Swoop tokens): blue = in progress, ink = printing, green = done, red = cancelled
const STATUS_COLORS: Record<keyof ShopStatusCounts, string> = {
    pending: 'bg-royal-soft',
    processing: 'bg-royal',
    printing: 'bg-ink',
    ready: 'bg-go',
    completed: 'bg-go-text',
    cancelled: 'bg-market',
};

const STATUS_LABELS: Record<keyof ShopStatusCounts, string> = {
    pending: 'Pending',
    processing: 'Processing',
    printing: 'Printing',
    ready: 'Ready',
    completed: 'Done',
    cancelled: 'Cancelled',
};

export default function GodviewDashboard() {
    const [shopStats, setShopStats] = useState<ShopOrderStats[]>([]);
    const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);

    const [aggregates, setAggregates] = useState<FilteredAggregates>({
        revenue: 0, orders: 0, pending: 0, cancelled: 0, completed: 0
    });

    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');

    useEffect(() => {
        const shopsMap: Record<string, string> = {};
        const unsubShops = onSnapshot(collection(db, 'shops'), (snap) => {
            snap.docs.forEach(d => { shopsMap[d.id] = d.data().name; });
        });

        const ordersQuery = query(collection(db, 'orders'), orderBy('timestamp', 'desc'), limit(2000));

        const unsubOrders = onSnapshot(ordersQuery, (snap) => {
            const now = new Date();
            const todayStart = new Date(now.setHours(0, 0, 0, 0));
            const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
            const monthStart = new Date(todayStart); monthStart.setMonth(monthStart.getMonth() - 1);

            let aggRevenue = 0, aggOrders = 0, aggPending = 0, aggCancelled = 0, aggCompleted = 0;
            const shopCounts: Record<string, ShopOrderStats> = {};
            const recentLive: LiveOrder[] = [];

            snap.docs.forEach((doc) => {
                const data = doc.data();
                const shopId = data.shopId;
                const shopName = shopsMap[shopId] || 'Unknown';
                const status = data.status || 'pending';
                const ts = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                const cost = Number(data.totalCost || 0);

                if (['pending', 'processing', 'printing', 'printed', 'ready'].includes(status) && recentLive.length < 15) {
                    recentLive.push({
                        id: doc.id,
                        shopName,
                        userName: data.userName || 'Guest',
                        fileName: data.fileName || 'Doc',
                        status,
                        totalCost: cost,
                        timestamp: data.timestamp,
                        itemCount: data.items?.length || data.totalPages || 0
                    });
                }

                let include = false;
                if (timeFilter === 'all') include = true;
                else if (timeFilter === 'today' && ts >= todayStart) include = true;
                else if (timeFilter === 'week' && ts >= weekStart) include = true;
                else if (timeFilter === 'month' && ts >= monthStart) include = true;

                if (include) {
                    aggOrders++;
                    if (status === 'completed' || status === 'collected') {
                        aggCompleted++; aggRevenue += cost;
                    } else if (['pending', 'processing', 'printing', 'printed', 'ready'].includes(status)) {
                        aggPending++;
                    } else if (status === 'cancelled') {
                        aggCancelled++;
                    }

                    if (shopId) {
                        if (!shopCounts[shopId]) shopCounts[shopId] = { id: shopId, name: shopName, total: 0, pending: 0, processing: 0, printing: 0, ready: 0, completed: 0, cancelled: 0 };
                        const s = shopCounts[shopId];
                        s.total++;
                        if (status === 'pending') s.pending++;
                        else if (status === 'processing') s.processing++;
                        else if (status === 'printing') s.printing++;
                        else if (['printed', 'ready'].includes(status)) s.ready++;
                        else if (['completed', 'collected'].includes(status)) s.completed++;
                        else if (status === 'cancelled') s.cancelled++;
                    }
                }
            });

            setAggregates({ revenue: aggRevenue, orders: aggOrders, pending: aggPending, cancelled: aggCancelled, completed: aggCompleted });
            setLiveOrders(recentLive);
            setShopStats(Object.values(shopCounts).sort((a, b) => b.total - a.total).slice(0, 10));
            setLoading(false);
        });

        return () => { unsubShops(); unsubOrders(); };
    }, [timeFilter]);

    const maxOrders = Math.max(...shopStats.map(s => s.total), 1);

    return (
        <div className="mx-auto max-w-[1200px] space-y-5">
            {/* Overview Section */}
            <section className="space-y-3">
                <PageHead
                    title="Dashboard"
                    description="Orders, revenue and store activity across Swoop."
                    actions={
                        <Segmented
                            label="Time range"
                            value={timeFilter}
                            onChange={setTimeFilter}
                            options={(['today', 'week', 'month', 'all'] as const).map((t) => ({ value: t, label: t }))}
                            className="w-[280px]"
                        />
                    }
                    className="pb-0"
                />

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <StatTile label="Revenue" value={`₹${loading ? '-' : aggregates.revenue.toLocaleString()}`} dot="go" />
                    <StatTile label="Total orders" value={loading ? '-' : aggregates.orders} />
                    <StatTile label="Pending active" value={loading ? '-' : aggregates.pending} dot="royal" />
                    <StatTile label="Cancelled" value={loading ? '-' : aggregates.cancelled} dot="market" />
                </div>

                {/* Stacked Chart */}
                <div className={cn(gvCard, 'p-4')}>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                        <SectionTitle>Store activity</SectionTitle>
                        <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate">
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <div key={key} className="flex items-center gap-1.5">
                                    <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[key as keyof ShopStatusCounts])} />
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {loading ? (
                            <TableState loading className="h-20" />
                        ) : shopStats.length === 0 ? (
                            <TableState title="No data available" className="h-20" />
                        ) : (
                            shopStats.map((shop) => (
                                <div key={shop.id} className="group grid grid-cols-12 items-center gap-3">
                                    <div className="col-span-2 truncate text-right text-[12px] font-bold text-ink">{shop.name}</div>
                                    <div className="relative col-span-10 flex h-5 overflow-hidden rounded-[6px] bg-surface">
                                        {(Object.keys(STATUS_COLORS) as Array<keyof ShopStatusCounts>).map((status) => {
                                            const count = shop[status];
                                            if (count === 0) return null;
                                            const width = (count / maxOrders) * 100;
                                            return (
                                                <div
                                                    key={status}
                                                    className={cn('h-full border-r border-white last:border-0', STATUS_COLORS[status])}
                                                    style={{ width: `${width}%` }}
                                                    title={`${STATUS_LABELS[status]}: ${count}`}
                                                />
                                            );
                                        })}
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] font-bold text-slate tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                                            {shop.total} orders
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* Live Feed Section */}
            <section className={cn(gvCard, 'overflow-hidden')}>
                <div className="flex items-center justify-between px-4 py-3">
                    <SectionTitle className="items-center">
                        Live feed <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-go" />
                    </SectionTitle>
                    <Link href="/godview/orders" className="text-[12px] font-bold text-royal hover:underline">
                        View all
                    </Link>
                </div>

                <div className={cn(gvTableHead, 'grid grid-cols-12 gap-4 border-t px-4 py-2')}>
                    <div className="col-span-2">Store</div>
                    <div className="col-span-3">Order</div>
                    <div className="col-span-3">File</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Amount</div>
                </div>

                {loading ? (
                    <TableState loading className="h-32" />
                ) : liveOrders.length === 0 ? (
                    <TableState icon={OrdersIcon} title="No active orders" className="h-32" />
                ) : (
                    <div>
                        {liveOrders.map((order) => (
                            <div key={order.id} className={cn(gvRow, 'grid min-h-[40px] grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors hover:bg-surface/60')}>
                                <div className="col-span-2 truncate font-bold">{order.shopName}</div>
                                <div className="col-span-3 flex items-center gap-1.5 truncate text-text-secondary">
                                    <span className="font-mono text-[11px] text-slate">#{order.id.slice(-4)}</span>
                                    <span className="text-text-muted">•</span>
                                    <span className="truncate">{order.userName}</span>
                                </div>
                                <div className="col-span-3 truncate text-slate">{order.fileName}</div>
                                <div className="col-span-2">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className={cn(
                                                'h-1.5 w-1.5 rounded-full',
                                                order.status === 'printing' ? 'bg-ink' :
                                                    order.status === 'processing' ? 'bg-royal' :
                                                        order.status === 'ready' ? 'bg-go' : 'bg-royal-soft'
                                            )}
                                        />
                                        <span className="text-[12px] font-bold capitalize text-ink">{order.status}</span>
                                    </div>
                                </div>
                                <div className="col-span-2 text-right font-bold tabular-nums">
                                    ₹{order.totalCost}
                                    <span className="ml-2 text-[11px] font-medium text-slate">
                                        {order.timestamp?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '-'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
