'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from '@/lib/utils/cn';
import { DocIcon, OrdersIcon, SearchIcon, StoreIcon } from '@/components/swoop/icons';
import { MoreIcon } from '../icons';
import { PageHead, StatusTag, TableState, gvCard, gvIconBtn, gvMenu, gvMenuItem, gvRow, gvTableHead, type StatusTone } from '../ui';

interface Order {
    id: string;
    shopId: string;
    shopName: string;
    userName: string;
    fileName: string;
    totalPages: number;
    totalCost: number;
    status: string;
    timestamp: any;
    emergency: boolean;
}

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
    completed: { label: 'Completed', tone: 'go' },
    collected: { label: 'Completed', tone: 'go' },
    printed: { label: 'Ready', tone: 'go' },
    processing: { label: 'Processing', tone: 'royal' },
    printing: { label: 'Printing', tone: 'royal' },
    cancelled: { label: 'Cancelled', tone: 'slate' },
};

const StatusIndicator = ({ status }: { status: string }) => {
    const meta = STATUS[status] ?? { label: status, tone: 'slate' as const };
    return <StatusTag tone={meta.tone}>{meta.label}</StatusTag>;
};

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'), limit(100)); // Increased limit slightly
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as Order[];
            setOrders(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const filtered = useMemo(() => {
        return orders.filter((o) => {
            if (statusFilter !== 'all' && o.status !== statusFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                if (
                    !o.userName?.toLowerCase().includes(q) &&
                    !o.fileName?.toLowerCase().includes(q) &&
                    !o.id.toLowerCase().includes(q)
                ) {
                    return false;
                }
            }
            return true;
        });
    }, [orders, statusFilter, search]);

    const formatTime = (ts: any) => {
        if (!ts) return '-';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        // Linear style date: "Oct 24"
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    };

    const formatTimeOnly = (ts: any) => {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }

    return (
        <div className="flex h-[calc(100vh-6rem)] flex-col">
            {/* Header / Actions */}
            <PageHead
                title="Orders"
                description="Manage and track all print orders."
                actions={
                    <>
                        <label className="flex h-8 w-64 items-center gap-2 rounded-full bg-surface pl-3 pr-3 transition-shadow focus-within:ring-[3px] focus-within:ring-royal/15">
                            <SearchIcon size={14} className="shrink-0 text-ink" />
                            <input
                                type="text"
                                aria-label="Search orders"
                                placeholder="Search orders..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate"
                            />
                        </label>
                        <select
                            aria-label="Filter by status"
                            className="h-8 cursor-pointer rounded-full border border-transparent bg-surface px-3 text-[12px] font-semibold text-ink outline-none transition-colors hover:bg-line focus-visible:border-royal"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="processing">Processing</option>
                            <option value="printing">Printing</option>
                            <option value="printed">Ready</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </>
                }
            />

            {/* List View */}
            <div className={cn(gvCard, 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
                {/* Table Header */}
                <div className={cn(gvTableHead, 'grid grid-cols-12 gap-4 px-4 py-2')}>
                    <div className="col-span-4 pl-10">Order details</div>
                    <div className="col-span-2">Store</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-2 pr-9 text-right">Date</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <TableState loading />
                    ) : filtered.length === 0 ? (
                        <TableState icon={OrdersIcon} title="No orders found" body="Try a different search or status filter." />
                    ) : (
                        <div>
                            {filtered.map((order) => (
                                <div
                                    key={order.id}
                                    className={cn(gvRow, 'group grid min-h-[44px] cursor-default grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors hover:bg-surface/60')}
                                >
                                    {/* Order ID & File */}
                                    <div className="col-span-4 flex min-w-0 items-center gap-3">
                                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-surface text-slate">
                                            <DocIcon size={15} />
                                        </div>
                                        <div className="flex min-w-0 flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate font-bold">{order.fileName}</span>
                                                {order.emergency && <StatusTag tone="market">Rush</StatusTag>}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate">
                                                <span className="font-mono text-[10.5px]">{order.id.slice(0, 6)}</span>
                                                <span aria-hidden="true">•</span>
                                                <span className="truncate">{order.userName}</span>
                                                <span aria-hidden="true">•</span>
                                                <span className="shrink-0 tabular-nums">{order.totalPages} pgs</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Store */}
                                    <div className="col-span-2 flex min-w-0 items-center gap-1.5 text-text-secondary">
                                        <StoreIcon size={13} className="shrink-0 text-slate" />
                                        <span className="truncate">{order.shopName || 'Unknown Shop'}</span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        <StatusIndicator status={order.status} />
                                    </div>

                                    {/* Amount */}
                                    <div className="col-span-2 text-right font-bold tabular-nums">
                                        ₹{order.totalCost}
                                    </div>

                                    {/* Date + actions */}
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        <div className="flex flex-col items-end text-[11.5px] text-text-secondary tabular-nums">
                                            <span>{formatTime(order.timestamp)}</span>
                                            <span className="text-[10.5px] text-slate">{formatTimeOnly(order.timestamp)}</span>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for order ${order.id.slice(0, 6)}`}
                                                    className={cn(gvIconBtn, 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:bg-surface data-[state=open]:opacity-100')}
                                                >
                                                    <MoreIcon size={15} />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className={cn(gvMenu, 'w-[160px]')}>
                                                <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-slate">Order actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator className="bg-line" />
                                                <DropdownMenuItem className={gvMenuItem}>View Details</DropdownMenuItem>
                                                <DropdownMenuItem className={gvMenuItem}>View User</DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-line" />
                                                <DropdownMenuItem className={cn(gvMenuItem, 'text-market focus:bg-market-tint focus:text-market')}>Cancel Order</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Stats */}
                <div className="flex items-center justify-between border-t border-line bg-surface px-4 py-2 text-[11.5px] font-semibold text-slate">
                    <span className="tabular-nums">{filtered.length} orders shown</span>
                    <span>
                        Total: <b className="font-bold text-ink tabular-nums">₹{filtered.reduce((sum, o) => sum + (o.totalCost || 0), 0).toLocaleString()}</b>
                    </span>
                </div>
            </div>
        </div>
    );
}
