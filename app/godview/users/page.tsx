'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Users, CheckCircle2, XCircle, Clock, Mail, Phone, Calendar, ShieldCheck, Loader2, MoreHorizontal, Check, X, Search } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils/cn';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface MarketplaceUser {
    id: string;
    email: string;
    name: string;
    phone?: string;
    verified: boolean;
    verifiedAt?: any;
    verifiedBy?: string;
    createdAt: any;
    listingsCount?: number;
}

export default function UsersPage() {
    const { user: adminUser } = useUser();
    const [users, setUsers] = useState<MarketplaceUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all');
    const [search, setSearch] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'marketplace_users'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as MarketplaceUser[];
            setUsers(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const verifyUser = async (userId: string) => {
        setUpdating(userId);
        try {
            await updateDoc(doc(db, 'marketplace_users', userId), {
                verified: true,
                verifiedAt: serverTimestamp(),
                verifiedBy: adminUser?.primaryEmailAddress?.emailAddress || 'admin',
            });
        } catch (err) {
            console.error('Failed to verify user', err);
        }
        setUpdating(null);
    };

    const unverifyUser = async (userId: string) => {
        setUpdating(userId);
        try {
            await updateDoc(doc(db, 'marketplace_users', userId), {
                verified: false,
                verifiedAt: null,
                verifiedBy: null,
            });
        } catch (err) {
            console.error('Failed to unverify user', err);
        }
        setUpdating(null);
    };

    const filtered = users.filter((u) => {
        if (filter === 'pending' && u.verified) return false;
        if (filter === 'verified' && !u.verified) return false;

        if (search) {
            const q = search.toLowerCase();
            return (
                u.name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.phone?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const pendingCount = users.filter((u) => !u.verified).length;
    const verifiedCount = users.filter((u) => u.verified).length;

    const formatDate = (ts: any) => {
        if (!ts) return '-';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between px-1 pb-4">
                <div>
                    <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Users</h1>
                    <p className="text-xs text-zinc-500">Verify and manage marketplace users.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 w-64 rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100/50 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex bg-zinc-100/50 p-0.5 rounded-lg border border-zinc-200/50">
                        {(['all', 'pending', 'verified'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-3 py-1 text-[11px] font-medium rounded-md transition-all",
                                    filter === f
                                        ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/50"
                                        : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
                                )}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                <span className="ml-1.5 opacity-60">
                                    {f === 'all' ? users.length : f === 'pending' ? pendingCount : verifiedCount}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-4 pl-8">User</div>
                    <div className="col-span-3">Contact</div>
                    <div className="col-span-2">Joined</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1 text-right"></div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
                            <Users className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No users found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {filtered.map((user) => (
                                <div key={user.id} className="group grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-zinc-50/80 transition-colors text-[13px] relative min-h-[44px]">
                                    {/* Name */}
                                    <div className="col-span-4 pl-4 flex items-center gap-3">
                                        <div className={cn(
                                            "flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold border",
                                            user.verified
                                                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                : "bg-zinc-100 text-zinc-500 border-zinc-200"
                                        )}>
                                            {user.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-zinc-900 truncate">{user.name || 'Unknown'}</span>
                                        </div>
                                    </div>

                                    {/* Contact */}
                                    <div className="col-span-3 flex flex-col justify-center text-[11px] text-zinc-500">
                                        <div className="flex items-center gap-1.5 text-zinc-600">
                                            <Mail className="h-3 w-3 opacity-50" />
                                            <span className="truncate">{user.email}</span>
                                        </div>
                                        {user.phone && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Phone className="h-3 w-3 opacity-50" />
                                                <span className="truncate">{user.phone}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Joined */}
                                    <div className="col-span-2 text-zinc-500 text-[11px]">
                                        {formatDate(user.createdAt)}
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        {user.verified ? (
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50/50 text-emerald-700 border border-emerald-100">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Verified
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
                                                <Clock className="h-3 w-3" />
                                                Pending
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-600 hover:bg-zinc-100 transition-all">
                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[140px]">
                                                {user.verified ? (
                                                    <DropdownMenuItem onClick={() => unverifyUser(user.id)} className="text-xs text-red-600 focus:text-red-700 focus:bg-red-50">
                                                        <XCircle className="h-3.5 w-3.5 mr-2" />
                                                        Revoke
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => verifyUser(user.id)} className="text-xs text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50">
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                                        Verify User
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
