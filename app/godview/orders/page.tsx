'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import {
    ShoppingCart,
    Search,
    Filter,
    Store,
    Clock,
    FileText,
    MoreHorizontal,
    ArrowUpRight,
    CheckCircle2,
    XCircle,
    Loader2,
    Printer,
    Package
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from '@/lib/utils/cn';

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

const StatusIndicator = ({ status }: { status: string }) => {
    switch (status) {
        case 'completed':
        case 'collected':
            return <div className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /><span className="text-[13px] font-medium">Completed</span></div>;
        case 'cancelled':
            return <div className="flex items-center gap-1.5 text-zinc-400"><XCircle className="h-3.5 w-3.5" /><span className="text-[13px] font-medium">Cancelled</span></div>;
        case 'processing':
            return <div className="flex items-center gap-1.5 text-blue-600"><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="text-[13px] font-medium">Processing</span></div>;
        case 'printing':
            return <div className="flex items-center gap-1.5 text-amber-600"><Printer className="h-3.5 w-3.5" /><span className="text-[13px] font-medium">Printing</span></div>;
        case 'printed':
            return <div className="flex items-center gap-1.5 text-indigo-600"><Package className="h-3.5 w-3.5" /><span className="text-[13px] font-medium">Ready</span></div>;
        default:
            return <div className="flex items-center gap-1.5 text-zinc-500"><div className="h-2 w-2 rounded-full bg-zinc-300" /><span className="text-[13px] font-medium">{status}</span></div>;
    }
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
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            {/* Header / Actions */}
            <div className="flex items-center justify-between px-1 pb-4">
                <div>
                    <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Orders</h1>
                    <p className="text-xs text-zinc-500">Manage and track all print orders.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 w-64 rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100/50 transition-all shadow-sm"
                        />
                    </div>
                    <div className="h-4 w-px bg-zinc-200 mx-1" />
                    <select
                        className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 focus:border-zinc-300 focus:outline-none shadow-sm cursor-pointer hover:bg-zinc-50"
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
                </div>
            </div>

            {/* Linear List View */}
            <div className="flex-1 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-4 pl-8">Order Details</div>
                    <div className="col-span-2">Store</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-2 text-right">Date</div>
                </div>

                {/* Table Body */}
                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
                            <ShoppingCart className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No orders found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {filtered.map((order) => (
                                <div
                                    key={order.id}
                                    className="group grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-zinc-50/80 transition-colors cursor-default text-[13px] relative"
                                >
                                    {/* Decoration Line on Hover */}
                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Order ID & File */}
                                    <div className="col-span-4 flex items-center gap-3 pl-4">
                                        <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-100 text-zinc-500 border border-zinc-200/50">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-zinc-900 truncate">{order.fileName}</span>
                                                {order.emergency && (
                                                    <span className="inline-flex items-center rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 border border-red-100/50">Rush</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                                                <span className="font-mono text-[10px]">{order.id.slice(0, 6)}</span>
                                                <span>•</span>
                                                <span>{order.userName}</span>
                                                <span>•</span>
                                                <span>{order.totalPages} pgs</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Store */}
                                    <div className="col-span-2 text-zinc-600 truncate flex items-center gap-1.5">
                                        <Store className="h-3 w-3 text-zinc-400" />
                                        {order.shopName || 'Unknown Shop'}
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        <StatusIndicator status={order.status} />
                                    </div>

                                    {/* Amount */}
                                    <div className="col-span-2 text-right font-medium text-zinc-900 tabular-nums">
                                        ₹{order.totalCost}
                                    </div>

                                    {/* Date */}
                                    <div className="col-span-2 text-right text-zinc-500 text-xs flex flex-col items-end">
                                        <span>{formatTime(order.timestamp)}</span>
                                        <span className="text-[10px] text-zinc-400">{formatTimeOnly(order.timestamp)}</span>
                                    </div>

                                    {/* Hover Action (Absolute) */}
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pl-4 bg-gradient-to-l from-zinc-50 via-zinc-50 to-transparent">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-7 w-7 p-0 rounded-sm hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[160px] border-zinc-200">
                                                <DropdownMenuLabel className="text-xs">Order Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-xs">View Details</DropdownMenuItem>
                                                <DropdownMenuItem className="text-xs">View User</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-xs text-red-600 hover:text-red-700">Cancel Order</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Stats */}
                <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2 flex items-center justify-between text-xs text-zinc-500">
                    <span>{filtered.length} orders shown</span>
                    <div className="flex gap-4">
                        <span>Total: <b>Rs. {filtered.reduce((sum, o) => sum + (o.totalCost || 0), 0).toLocaleString()}</b></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
