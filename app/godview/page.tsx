'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

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

// Linear Style Colors: High Signal, Low Noise
const STATUS_COLORS: Record<keyof ShopStatusCounts, string> = {
    pending: 'bg-amber-400',
    processing: 'bg-blue-500',
    printing: 'bg-indigo-500',
    ready: 'bg-emerald-400',
    completed: 'bg-emerald-600',
    cancelled: 'bg-rose-400',
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
        <div className="space-y-12 max-w-[1200px] mx-auto pt-2">

            {/* Overview Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Overview</h2>
                    <div className="flex border-b border-zinc-200">
                        {(['today', 'week', 'month', 'all'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTimeFilter(t)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-medium transition-colors capitalize border-b-2 -mb-[2px]",
                                    timeFilter === t
                                        ? "border-zinc-900 text-zinc-900"
                                        : "border-transparent text-zinc-400 hover:text-zinc-600"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-8">
                    <div>
                        <div className="text-3xl font-semibold text-zinc-900 tracking-tight">₹{loading ? '-' : aggregates.revenue.toLocaleString()}</div>
                        <div className="text-xs text-zinc-500 mt-1 font-medium">Revenue</div>
                    </div>
                    <div>
                        <div className="text-3xl font-semibold text-zinc-900 tracking-tight">{loading ? '-' : aggregates.orders}</div>
                        <div className="text-xs text-zinc-500 mt-1 font-medium">Total Orders</div>
                    </div>
                    <div>
                        <div className="text-3xl font-semibold text-zinc-900 tracking-tight">{loading ? '-' : aggregates.pending}</div>
                        <div className="text-xs text-amber-600 mt-1 font-medium">Pending Active</div>
                    </div>
                    <div>
                        <div className="text-3xl font-semibold text-zinc-900 tracking-tight">{loading ? '-' : aggregates.cancelled}</div>
                        <div className="text-xs text-rose-600 mt-1 font-medium">Cancelled</div>
                    </div>
                </div>

                {/* Stacked Chart (Linear Style) */}
                <div className="space-y-3 pt-6 border-t border-zinc-100">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-xs font-semibold text-zinc-900">Store Activity</h3>
                        <div className="flex gap-3 text-[10px] text-zinc-400">
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <div key={key} className="flex items-center gap-1.5">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", STATUS_COLORS[key as keyof ShopStatusCounts])} />
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="h-20 flex items-center justify-center text-xs text-zinc-400">Loading...</div>
                        ) : shopStats.length === 0 ? (
                            <div className="py-8 text-center text-xs text-zinc-400">No data available</div>
                        ) : (
                            shopStats.map((shop) => (
                                <div key={shop.id} className="grid grid-cols-12 gap-4 items-center group">
                                    <div className="col-span-2 text-xs font-medium text-zinc-700 truncate text-right pr-4">{shop.name}</div>
                                    <div className="col-span-10 h-6 bg-zinc-50 rounded-sm overflow-hidden flex relative">
                                        {(Object.keys(STATUS_COLORS) as Array<keyof ShopStatusCounts>).map((status) => {
                                            const count = shop[status];
                                            if (count === 0) return null;
                                            const width = (count / maxOrders) * 100;
                                            return (
                                                <div
                                                    key={status}
                                                    className={cn("h-full border-r border-white/50 last:border-0", STATUS_COLORS[status])}
                                                    style={{ width: `${width}%` }}
                                                    title={`${STATUS_LABELS[status]}: ${count}`}
                                                />
                                            );
                                        })}
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 font-medium tabular-nums transition-opacity">
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
            <section className="space-y-4 pt-8">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        Live Feed <span className="flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    </h2>
                    <Link href="/godview/orders" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 transition-colors">
                        View All
                    </Link>
                </div>

                <div className="min-w-full">
                    {loading ? (
                        <div className="py-12 text-center text-xs text-zinc-400">Loading feed...</div>
                    ) : liveOrders.length === 0 ? (
                        <div className="py-12 text-center text-xs text-zinc-400">No active orders</div>
                    ) : (
                        <div className="divide-y divide-zinc-100">
                            {liveOrders.map((order) => (
                                <div key={order.id} className="grid grid-cols-12 gap-4 py-3 items-center text-xs hover:bg-zinc-50/50 transition-colors rounded-sm px-2 -mx-2">
                                    <div className="col-span-2 font-medium text-zinc-900 truncate">{order.shopName}</div>
                                    <div className="col-span-3 text-zinc-600 truncate flex items-center gap-2">
                                        <span className="text-zinc-400">#{order.id.slice(-4)}</span>
                                        <span className="text-zinc-300">•</span>
                                        <span className="truncate">{order.userName}</span>
                                    </div>
                                    <div className="col-span-3 text-zinc-500 truncate">{order.fileName}</div>
                                    <div className="col-span-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className={cn("h-1.5 w-1.5 rounded-full",
                                                order.status === 'printing' ? "bg-indigo-500" :
                                                    order.status === 'processing' ? "bg-blue-500" :
                                                        order.status === 'ready' ? "bg-emerald-500" : "bg-amber-400"
                                            )} />
                                            <span className="capitalize text-zinc-700">{order.status}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 text-right font-medium text-zinc-900 tabular-nums">
                                        ₹{order.totalCost}
                                        <span className="text-zinc-400 ml-2 font-normal">
                                            {order.timestamp?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '-'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
