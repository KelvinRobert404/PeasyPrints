'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils/cn';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Segmented } from '@/components/swoop/primitives';
import { CheckIcon, CloseIcon, SearchIcon, UserIcon } from '@/components/swoop/icons';
import { MailIcon, MoreIcon, PhoneIcon } from '../icons';
import { PageHead, StatusTag, TableState, gvCard, gvIconBtn, gvMenu, gvMenuItem, gvRow, gvTableHead } from '../ui';

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
        <div className="flex h-[calc(100vh-6rem)] flex-col">
            <PageHead
                title="Users"
                description="Verify and manage marketplace users."
                actions={
                    <>
                        <label className="flex h-8 w-64 items-center gap-2 rounded-full bg-surface pl-3 pr-3 transition-shadow focus-within:ring-[3px] focus-within:ring-royal/15">
                            <SearchIcon size={14} className="shrink-0 text-ink" />
                            <input
                                type="text"
                                aria-label="Search users"
                                placeholder="Search users..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate"
                            />
                        </label>
                        <Segmented
                            label="Filter users"
                            value={filter}
                            onChange={setFilter}
                            className="w-[300px]"
                            options={(['all', 'pending', 'verified'] as const).map((f) => ({
                                value: f,
                                label: (
                                    <>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                        <span className="ml-1 font-semibold text-slate tabular-nums">
                                            {f === 'all' ? users.length : f === 'pending' ? pendingCount : verifiedCount}
                                        </span>
                                    </>
                                ),
                            }))}
                        />
                    </>
                }
            />

            <div className={cn(gvCard, 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
                <div className={cn(gvTableHead, 'grid grid-cols-12 gap-4 px-4 py-2')}>
                    <div className="col-span-4 pl-10">User</div>
                    <div className="col-span-3">Contact</div>
                    <div className="col-span-2">Joined</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1 text-right"></div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <TableState loading />
                    ) : filtered.length === 0 ? (
                        <TableState icon={UserIcon} title="No users found" />
                    ) : (
                        <div>
                            {filtered.map((user) => (
                                <div key={user.id} className={cn(gvRow, 'group grid min-h-[44px] grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors hover:bg-surface/60')}>
                                    {/* Name */}
                                    <div className="col-span-4 flex min-w-0 items-center gap-3">
                                        <div className={cn(
                                            'grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[10.5px] font-extrabold',
                                            user.verified
                                                ? 'bg-go-tint text-go-text'
                                                : 'bg-surface text-text-secondary'
                                        )}>
                                            {user.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <span className="truncate font-bold">{user.name || 'Unknown'}</span>
                                    </div>

                                    {/* Contact */}
                                    <div className="col-span-3 flex min-w-0 flex-col justify-center text-[11px] text-slate">
                                        <div className="flex min-w-0 items-center gap-1.5 text-text-secondary">
                                            <MailIcon size={13} className="shrink-0 text-slate" />
                                            <span className="truncate">{user.email}</span>
                                        </div>
                                        {user.phone && (
                                            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                                <PhoneIcon size={13} className="shrink-0" />
                                                <span className="truncate tabular-nums">{user.phone}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Joined */}
                                    <div className="col-span-2 text-[11.5px] text-slate tabular-nums">
                                        {formatDate(user.createdAt)}
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        {user.verified ? (
                                            <StatusTag tone="go">Verified</StatusTag>
                                        ) : (
                                            <StatusTag tone="slate">Pending</StatusTag>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${user.name || user.email}`}
                                                    className={cn(gvIconBtn, 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:bg-surface data-[state=open]:opacity-100')}
                                                >
                                                    <MoreIcon size={15} />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className={cn(gvMenu, 'w-[140px]')}>
                                                {user.verified ? (
                                                    <DropdownMenuItem onClick={() => unverifyUser(user.id)} className={cn(gvMenuItem, 'text-market focus:bg-market-tint focus:text-market')}>
                                                        <CloseIcon size={14} />
                                                        Revoke
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => verifyUser(user.id)} className={cn(gvMenuItem, 'text-go-text focus:bg-go-tint focus:text-go-text')}>
                                                        <CheckIcon size={14} />
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
