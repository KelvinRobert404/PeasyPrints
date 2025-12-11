'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { FileCheck, CheckCircle2, XCircle, Clock, Eye, ExternalLink, Tag, MapPin, Loader2, MoreHorizontal, AlertCircle, Search } from 'lucide-react';
import type { Listing, ListingStatus } from '@/types/models';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils/cn';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

const STATUS_STYLES: Record<ListingStatus, { bg: string; text: string; label: string; icon: any }> = {
    pending_moderation: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending', icon: Clock },
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active', icon: CheckCircle2 },
    hidden: { bg: 'bg-zinc-100', text: 'text-zinc-700', label: 'Hidden', icon: Eye },
    removed: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Removed', icon: XCircle },
};

export default function ListingsPage() {
    const { user: adminUser } = useUser();
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'removed'>('pending');
    const [search, setSearch] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);
    const [previewListing, setPreviewListing] = useState<Listing | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as Listing[];
            setListings(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const updateStatus = async (listingId: string, status: ListingStatus) => {
        setUpdating(listingId);
        try {
            await updateDoc(doc(db, 'listings', listingId), {
                status,
                moderatedBy: adminUser?.primaryEmailAddress?.emailAddress || 'admin',
                moderatedAt: new Date(),
            });
        } catch (err) {
            console.error('Failed to update listing', err);
        }
        setUpdating(null);
    };

    const filtered = listings.filter((l) => {
        if (filter === 'pending' && l.status !== 'pending_moderation') return false;
        if (filter === 'active' && l.status !== 'active') return false;
        if (filter === 'removed' && l.status !== 'removed' && l.status !== 'hidden') return false;

        if (search) {
            const q = search.toLowerCase();
            return (
                l.title?.toLowerCase().includes(q) ||
                l.authorName?.toLowerCase().includes(q) ||
                l.category?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const pendingCount = listings.filter((l) => l.status === 'pending_moderation').length;
    const activeCount = listings.filter((l) => l.status === 'active').length;

    const formatDate = (ts: any) => {
        if (!ts) return '-';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const handlePreview = (listing: Listing) => {
        setPreviewListing(listing);
        setSheetOpen(true);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between px-1 pb-4">
                <div>
                    <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Listing Moderation</h1>
                    <p className="text-xs text-zinc-500">Review and moderate marketplace content.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search listings..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 w-64 rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100/50 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex bg-zinc-100/50 p-0.5 rounded-lg border border-zinc-200/50">
                        {(['all', 'pending', 'active', 'removed'] as const).map((f) => (
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
                                    {f === 'all' ? listings.length : f === 'pending' ? pendingCount : f === 'active' ? activeCount : listings.length - pendingCount - activeCount}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-5 pl-8">Listing</div>
                    <div className="col-span-2">Price</div>
                    <div className="col-span-2">Date</div>
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
                            <FileCheck className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No listings found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {filtered.map((listing) => {
                                const style = STATUS_STYLES[listing.status];
                                const StatusIcon = style.icon;
                                return (
                                    <div key={listing.id} className="group grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-zinc-50/80 transition-colors text-[13px] relative min-h-[56px]">
                                        {/* Listing Info */}
                                        <div className="col-span-5 pl-4 flex items-center gap-3">
                                            <div className="flex-shrink-0 h-10 w-10 rounded bg-zinc-100 border border-zinc-200 overflow-hidden">
                                                {listing.images?.[0] ? (
                                                    <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-zinc-300">
                                                        <FileCheck className="h-4 w-4" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span
                                                    className="font-medium text-zinc-900 truncate cursor-pointer hover:underline decoration-zinc-400 underline-offset-2"
                                                    onClick={() => handlePreview(listing)}
                                                >
                                                    {listing.title}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                                                    <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] font-normal border-zinc-200 bg-zinc-50 text-zinc-500">
                                                        {listing.category}
                                                    </Badge>
                                                    <span className="truncate max-w-[120px]">{listing.location?.area || listing.collegeName}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <div className="col-span-2 text-zinc-700 font-medium tabular-nums">
                                            {listing.price ? `₹${listing.price}` : '-'}
                                        </div>

                                        {/* Date */}
                                        <div className="col-span-2 text-zinc-500 text-[11px]">
                                            {formatDate(listing.createdAt)}
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-2">
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                                style.bg, style.text, "border-opacity-50"
                                            )}>
                                                <StatusIcon className="h-3 w-3" />
                                                {style.label}
                                            </div>
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
                                                    <DropdownMenuItem onClick={() => handlePreview(listing)} className="text-xs">
                                                        <Eye className="h-3.5 w-3.5 mr-2 text-zinc-500" />
                                                        Preview
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {listing.status === 'pending_moderation' && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => updateStatus(listing.id, 'active')} className="text-xs text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50">
                                                                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                                                Approve
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => updateStatus(listing.id, 'removed')} className="text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50">
                                                                <XCircle className="h-3.5 w-3.5 mr-2" />
                                                                Reject
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {listing.status === 'active' && (
                                                        <DropdownMenuItem onClick={() => updateStatus(listing.id, 'hidden')} className="text-xs text-amber-600 focus:text-amber-700 focus:bg-amber-50">
                                                            <Eye className="h-3.5 w-3.5 mr-2" />
                                                            Hide
                                                        </DropdownMenuItem>
                                                    )}
                                                    {(listing.status === 'removed' || listing.status === 'hidden') && (
                                                        <DropdownMenuItem onClick={() => updateStatus(listing.id, 'active')} className="text-xs text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50">
                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                                            Restore
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0 border-l border-zinc-200 overflow-y-auto">
                    {previewListing && (
                        <div>
                            <div className="relative h-64 bg-zinc-100">
                                {previewListing.images?.[0] ? (
                                    <img src={previewListing.images[0]} alt={previewListing.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-zinc-300">
                                        <FileCheck className="h-16 w-16 opacity-50" />
                                    </div>
                                )}
                                <div className="absolute top-4 left-4">
                                    <div className={cn(
                                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-white/90 backdrop-blur shadow-sm",
                                        STATUS_STYLES[previewListing.status].text
                                    )}>
                                        {STATUS_STYLES[previewListing.status].label}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-zinc-900">{previewListing.title}</h2>
                                    <div className="flex items-center gap-2 mt-2 text-sm text-zinc-500">
                                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-zinc-200 font-normal">{previewListing.category}</Badge>
                                        <span>•</span>
                                        <span className="font-medium text-emerald-600 text-base">₹{previewListing.price}</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-100 space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-500">Location</span>
                                            <span className="font-medium text-zinc-900">{previewListing.location?.area || previewListing.collegeName}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-500">Posted by</span>
                                            <span className="font-medium text-zinc-900">{previewListing.authorName || 'Unknown'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-500">Date</span>
                                            <span className="font-medium text-zinc-900">{formatDate(previewListing.createdAt)}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-medium text-zinc-900 mb-2">Description</h3>
                                        <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                                            {previewListing.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    {previewListing.tags && previewListing.tags.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-zinc-900 mb-2">Tags</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {previewListing.tags.map(tag => (
                                                    <Badge key={tag} variant="outline" className="text-zinc-500 border-zinc-200 font-normal">{tag}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-zinc-100 pt-6 flex gap-3">
                                    {previewListing.status === 'pending_moderation' && (
                                        <>
                                            <Button onClick={() => { updateStatus(previewListing.id, 'active'); setSheetOpen(false); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Approve</Button>
                                            <Button onClick={() => { updateStatus(previewListing.id, 'removed'); setSheetOpen(false); }} variant="outline" className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50">Reject</Button>
                                        </>
                                    )}
                                    {previewListing.status !== 'pending_moderation' && (
                                        <Button variant="outline" onClick={() => setSheetOpen(false)} className="w-full">Close Preview</Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
