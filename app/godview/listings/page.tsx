'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
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
import { Segmented, swButton } from '@/components/swoop/primitives';
import { CheckIcon, CloseIcon, ImageIcon, MarketIcon, SearchIcon } from '@/components/swoop/icons';
import { EyeIcon, EyeOffIcon, MoreIcon } from '../icons';
import { PageHead, SectionTitle, StatusTag, TableState, gvCard, gvIconBtn, gvMenu, gvMenuItem, gvRow, gvTableHead, type StatusTone } from '../ui';

const STATUS_STYLES: Record<ListingStatus, { label: string; tone: StatusTone }> = {
    pending_moderation: { label: 'Pending', tone: 'slate' },
    active: { label: 'Active', tone: 'go' },
    hidden: { label: 'Hidden', tone: 'slate' },
    removed: { label: 'Removed', tone: 'market' },
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
        <div className="flex h-[calc(100vh-6rem)] flex-col">
            <PageHead
                title="Listing moderation"
                description="Review and moderate marketplace content."
                actions={
                    <>
                        <label className="flex h-8 w-64 items-center gap-2 rounded-full bg-surface pl-3 pr-3 transition-shadow focus-within:ring-[3px] focus-within:ring-royal/15">
                            <SearchIcon size={14} className="shrink-0 text-ink" />
                            <input
                                type="text"
                                aria-label="Search listings"
                                placeholder="Search listings..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate"
                            />
                        </label>
                        <Segmented
                            label="Filter listings"
                            value={filter}
                            onChange={setFilter}
                            className="w-[380px]"
                            options={(['all', 'pending', 'active', 'removed'] as const).map((f) => ({
                                value: f,
                                label: (
                                    <>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                        <span className="ml-1 font-semibold text-slate tabular-nums">
                                            {f === 'all' ? listings.length : f === 'pending' ? pendingCount : f === 'active' ? activeCount : listings.length - pendingCount - activeCount}
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
                    <div className="col-span-5 pl-11">Listing</div>
                    <div className="col-span-2">Price</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1 text-right"></div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <TableState loading />
                    ) : filtered.length === 0 ? (
                        <TableState icon={MarketIcon} title="No listings found" />
                    ) : (
                        <div>
                            {filtered.map((listing) => {
                                const style = STATUS_STYLES[listing.status];
                                return (
                                    <div key={listing.id} className={cn(gvRow, 'group grid min-h-[44px] grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors hover:bg-surface/60')}>
                                        {/* Listing Info */}
                                        <div className="col-span-5 flex min-w-0 items-center gap-3">
                                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-[10px] bg-surface">
                                                {listing.images?.[0] ? (
                                                    <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="grid h-full place-items-center text-text-muted">
                                                        <ImageIcon size={15} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-col items-start">
                                                <button
                                                    type="button"
                                                    className="max-w-full truncate text-left font-bold text-ink decoration-slate underline-offset-2 hover:underline"
                                                    onClick={() => handlePreview(listing)}
                                                >
                                                    {listing.title}
                                                </button>
                                                <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate">
                                                    <span className="shrink-0 rounded-full bg-surface px-1.5 py-px text-[10px] font-semibold text-text-secondary">
                                                        {listing.category}
                                                    </span>
                                                    <span className="max-w-[160px] truncate">{listing.location?.area || listing.collegeName}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <div className="col-span-2 font-bold tabular-nums">
                                            {listing.price ? `₹${listing.price}` : '-'}
                                        </div>

                                        {/* Date */}
                                        <div className="col-span-2 text-[11.5px] text-slate tabular-nums">
                                            {formatDate(listing.createdAt)}
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-2">
                                            <StatusTag tone={style.tone}>{style.label}</StatusTag>
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 flex justify-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        aria-label={`Actions for ${listing.title}`}
                                                        className={cn(gvIconBtn, 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:bg-surface data-[state=open]:opacity-100')}
                                                    >
                                                        <MoreIcon size={15} />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className={cn(gvMenu, 'w-[140px]')}>
                                                    <DropdownMenuItem onClick={() => handlePreview(listing)} className={gvMenuItem}>
                                                        <EyeIcon size={14} className="text-slate" />
                                                        Preview
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-line" />
                                                    {listing.status === 'pending_moderation' && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => updateStatus(listing.id, 'active')} className={cn(gvMenuItem, 'text-go-text focus:bg-go-tint focus:text-go-text')}>
                                                                <CheckIcon size={14} />
                                                                Approve
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => updateStatus(listing.id, 'removed')} className={cn(gvMenuItem, 'text-market focus:bg-market-tint focus:text-market')}>
                                                                <CloseIcon size={14} />
                                                                Reject
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {listing.status === 'active' && (
                                                        <DropdownMenuItem onClick={() => updateStatus(listing.id, 'hidden')} className={gvMenuItem}>
                                                            <EyeOffIcon size={14} className="text-slate" />
                                                            Hide
                                                        </DropdownMenuItem>
                                                    )}
                                                    {(listing.status === 'removed' || listing.status === 'hidden') && (
                                                        <DropdownMenuItem onClick={() => updateStatus(listing.id, 'active')} className={cn(gvMenuItem, 'text-go-text focus:bg-go-tint focus:text-go-text')}>
                                                            <CheckIcon size={14} />
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
                <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0 border-l border-line overflow-y-auto">
                    {previewListing && (
                        <div>
                            <div className="relative h-64 bg-surface">
                                {previewListing.images?.[0] ? (
                                    <img src={previewListing.images[0]} alt={previewListing.title} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="grid h-full place-items-center text-text-muted">
                                        <ImageIcon size={40} />
                                    </div>
                                )}
                                <div className="absolute left-3 top-3">
                                    <StatusTag tone={STATUS_STYLES[previewListing.status].tone} className="shadow-[0_1px_3px_rgba(16,24,40,0.10)]">
                                        {STATUS_STYLES[previewListing.status].label}
                                    </StatusTag>
                                </div>
                            </div>

                            <div className="space-y-4 p-4">
                                <div>
                                    <h2 className="font-heading text-[16px] leading-[1.15] text-ink">{previewListing.title}</h2>
                                    <div className="mt-1.5 flex items-center gap-2 text-[12px] text-slate">
                                        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-secondary">{previewListing.category}</span>
                                        <span aria-hidden="true">•</span>
                                        <span className="text-[13px] font-bold text-ink tabular-nums">₹{previewListing.price}</span>
                                    </div>
                                </div>

                                <div className="space-y-3.5">
                                    <dl className="space-y-2 rounded-[12px] bg-surface p-3 text-[12.5px]">
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-slate">Location</dt>
                                            <dd className="truncate font-bold text-ink">{previewListing.location?.area || previewListing.collegeName}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-slate">Posted by</dt>
                                            <dd className="truncate font-bold text-ink">{previewListing.authorName || 'Unknown'}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-slate">Date</dt>
                                            <dd className="font-bold text-ink tabular-nums">{formatDate(previewListing.createdAt)}</dd>
                                        </div>
                                    </dl>

                                    <div>
                                        <SectionTitle className="mb-1.5">Description</SectionTitle>
                                        <p className="whitespace-pre-wrap text-[12.5px] leading-[1.5] text-text-secondary">
                                            {previewListing.description || 'No description provided.'}
                                        </p>
                                    </div>

                                    {previewListing.tags && previewListing.tags.length > 0 && (
                                        <div>
                                            <SectionTitle className="mb-1.5">Tags</SectionTitle>
                                            <div className="flex flex-wrap gap-1.5">
                                                {previewListing.tags.map(tag => (
                                                    <span key={tag} className="inline-flex h-[22px] items-center rounded-full bg-surface px-2 text-[11px] font-semibold text-ink">{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 border-t border-line pt-4">
                                    {previewListing.status === 'pending_moderation' && (
                                        <>
                                            <button type="button" onClick={() => { updateStatus(previewListing.id, 'active'); setSheetOpen(false); }} className={cn(swButton({ variant: 'primary', size: 'md' }), 'flex-1')}>Approve</button>
                                            <button type="button" onClick={() => { updateStatus(previewListing.id, 'removed'); setSheetOpen(false); }} className={cn(swButton({ variant: 'danger', size: 'md' }), 'flex-1')}>Reject</button>
                                        </>
                                    )}
                                    {previewListing.status !== 'pending_moderation' && (
                                        <button type="button" onClick={() => setSheetOpen(false)} className={cn(swButton({ variant: 'surface', size: 'md' }), 'w-full')}>Close Preview</button>
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
