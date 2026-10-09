'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { IconTile, StatusLine, swButton } from '@/components/swoop/primitives';
import { LayersIcon, PlusIcon, RupeeIcon, StoreIcon, TrashIcon } from '@/components/swoop/icons';
import type { Shop } from '@/types/models';
import { cn } from '@/lib/utils/cn';
import { GlobeIcon, SaveIcon } from '../icons';
import { PageHead, Spinner, TableState, gvCard, gvIconBtn, gvInput, gvRow, gvTableHead } from '../ui';

interface FeeTier {
    minPages: number;
    maxPages: number;
    fee: number;
}

export default function FeesPage() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
    const [editingTiers, setEditingTiers] = useState<FeeTier[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isGlobalMode, setIsGlobalMode] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'shops'), (snap) => {
            const list = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as Shop[];
            setShops(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleManageTiers = (shop: Shop) => {
        setIsGlobalMode(false);
        setSelectedShop(shop);
        // Initialize tiers from shop or default empty
        setEditingTiers(shop.pricing?.convenienceFeeTiers || []);
        setSheetOpen(true);
    };

    const handleGlobalConfig = () => {
        setIsGlobalMode(true);
        setSelectedShop(null);
        // Default to first shop's tiers or empty if none, or standard
        setEditingTiers([]);
        setSheetOpen(true);
    };

    const addTier = () => {
        const lastTier = editingTiers[editingTiers.length - 1];
        const nextMin = lastTier ? lastTier.maxPages + 1 : 1;
        // Default bucket size of 5
        setEditingTiers([...editingTiers, { minPages: nextMin, maxPages: nextMin + 4, fee: 0 }]);
    };

    const updateTier = (index: number, field: keyof FeeTier, value: number) => {
        const newTiers = [...editingTiers];
        newTiers[index] = { ...newTiers[index], [field]: value };
        setEditingTiers(newTiers);
    };

    const removeTier = (index: number) => {
        setEditingTiers(editingTiers.filter((_, i) => i !== index));
    };

    const saveTiers = async () => {
        const sorted = [...editingTiers].sort((a, b) => a.minPages - b.minPages);
        for (let i = 0; i < sorted.length; i++) {
            const t = sorted[i];
            if (!Number.isInteger(t.minPages) || !Number.isInteger(t.maxPages) || t.minPages < 1 || t.maxPages < t.minPages) {
                alert(`Tier ${i + 1} has an invalid page range.`);
                return;
            }
            if (!Number.isFinite(t.fee) || t.fee < 0) {
                alert(`Tier ${t.minPages}-${t.maxPages} needs a fee of 0 or more.`);
                return;
            }
            if (i > 0 && t.minPages <= sorted[i - 1].maxPages) {
                alert(`Tiers ${sorted[i - 1].minPages}-${sorted[i - 1].maxPages} and ${t.minPages}-${t.maxPages} overlap.`);
                return;
            }
        }
        if (isGlobalMode && !window.confirm(sorted.length === 0
            ? 'This removes convenience fee tiers from EVERY store. Continue?'
            : `Apply these ${sorted.length} tier(s) to all ${shops.length} stores?`)) return;
        setSaving(true);
        try {
            if (isGlobalMode) {
                // Apply to ALL shops
                const batch = writeBatch(db);
                shops.forEach((shop) => {
                    const ref = doc(db, 'shops', shop.id);
                    batch.update(ref, {
                        'pricing.convenienceFeeTiers': sorted
                    });
                });
                await batch.commit();
            } else if (selectedShop) {
                // Apply to single shop
                await updateDoc(doc(db, 'shops', selectedShop.id), {
                    'pricing.convenienceFeeTiers': sorted,
                    // Optional: clear legacy flat fee to avoid confusion, or keep as fallback
                });
            }
            setSheetOpen(false);
        } catch (err: any) {
            console.error('Failed to save tiers', err);
            alert(err?.message || 'Failed to save fee tiers');
        }
        setSaving(false);
    };

    // Auto-generate standard buckets (1-5, 6-10, etc)
    const generateStandardTiers = () => {
        const standard: FeeTier[] = [
            { minPages: 1, maxPages: 5, fee: 2 },
            { minPages: 6, maxPages: 10, fee: 4 },
            { minPages: 11, maxPages: 15, fee: 6 },
            { minPages: 16, maxPages: 20, fee: 8 },
            { minPages: 21, maxPages: 1000, fee: 10 },
        ];
        setEditingTiers(standard);
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] flex-col">
            <PageHead
                title="Fee management"
                description="Manage tiered service fees per store."
                actions={
                    <button
                        type="button"
                        onClick={handleGlobalConfig}
                        className={cn(swButton({ variant: 'surface', size: 'sm' }), 'bg-royal-tint text-royal hover:bg-royal-tint/70')}
                    >
                        <GlobeIcon size={14} />
                        Configure global tiers
                    </button>
                }
            />

            <div className={cn(gvCard, 'flex flex-1 flex-col overflow-hidden')}>
                <div className={cn(gvTableHead, 'grid grid-cols-12 gap-4 px-4 py-2')}>
                    <div className="col-span-4 pl-10">Store name</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-4">Active fee structure</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <TableState loading />
                    ) : (
                        <div>
                            {shops.map((shop) => {
                                const tiers = shop.pricing?.convenienceFeeTiers;
                                const hasTiers = tiers && tiers.length > 0;
                                const flatFee = shop.pricing?.convenienceFee ?? 0;

                                return (
                                    <div key={shop.id} className={cn(gvRow, 'grid min-h-[44px] grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors hover:bg-surface/60')}>
                                        {/* Name */}
                                        <div className="col-span-4 flex min-w-0 items-center gap-3">
                                            <IconTile icon={StoreIcon} shape="square" size={28} iconSize={15} />
                                            <span className="truncate font-bold">{shop.name}</span>
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-2">
                                            <StatusLine open={!!shop.isOpen} label={shop.isOpen ? 'Open' : 'Closed'} />
                                        </div>

                                        {/* Structure Summary */}
                                        <div className="col-span-4 text-[12px] text-text-secondary tabular-nums">
                                            {hasTiers ? (
                                                <div className="flex items-center gap-2">
                                                    <LayersIcon size={14} className="shrink-0 text-royal" />
                                                    <span className="font-semibold text-ink">{tiers.length} tiers configured</span>
                                                    <span className="truncate text-slate">({tiers[0].minPages}-{tiers[0].maxPages}pgs: ₹{tiers[0].fee}...)</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <RupeeIcon size={14} className="shrink-0 text-slate" />
                                                    <span>Flat fee: ₹{flatFee}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-2 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleManageTiers(shop)}
                                                className={cn(swButton({ variant: 'surface', size: 'sm' }), 'h-7 px-2.5 text-[11.5px]')}
                                            >
                                                Manage tiers
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Manage Tiers Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="w-[400px] overflow-y-auto border-line p-5 sm:w-[540px] sm:max-w-[540px]">
                    <SheetHeader>
                        <SheetTitle className="font-heading text-[16px] font-bold text-ink">
                            {isGlobalMode ? 'Global fee configuration' : 'Manage convenience fees'}
                        </SheetTitle>
                        <SheetDescription className="text-[12.5px] text-slate">
                            {isGlobalMode
                                ? 'Define a tiered fee structure to apply to ALL stores instantly.'
                                : <span>Configure tiered fees for <span className="font-bold text-ink">{selectedShop?.name}</span>.</span>
                            }
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-4 py-5">
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={generateStandardTiers}
                                className={cn(swButton({ variant: 'surface', size: 'sm' }), 'h-7 px-2.5 text-[11.5px]')}
                            >
                                Auto-fill standard tiers
                            </button>
                        </div>

                        <div className="space-y-3">
                            {editingTiers.length === 0 ? (
                                <div className="rounded-[14px] bg-surface px-4 py-7 text-center">
                                    <p className="text-[12.5px] font-bold text-ink">No tiers configured.</p>
                                    {!isGlobalMode && (
                                        <p className="mt-1 text-[11.5px] text-slate">Using legacy flat fee: ₹{selectedShop?.pricing?.convenienceFee ?? 0}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <div className="grid grid-cols-12 gap-2 px-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-slate">
                                        <div className="col-span-3">Min pages</div>
                                        <div className="col-span-3">Max pages</div>
                                        <div className="col-span-4">Fee (₹)</div>
                                        <div className="col-span-2"></div>
                                    </div>
                                    {editingTiers.map((tier, idx) => (
                                        <div key={idx} className="grid grid-cols-12 items-center gap-2 rounded-[12px] bg-surface p-2">
                                            <div className="col-span-3">
                                                <input
                                                    type="number"
                                                    aria-label={`Tier ${idx + 1} minimum pages`}
                                                    value={tier.minPages}
                                                    onChange={(e) => updateTier(idx, 'minPages', parseInt(e.target.value))}
                                                    className={cn(gvInput, 'h-8 bg-white text-[12px] tabular-nums')}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input
                                                    type="number"
                                                    aria-label={`Tier ${idx + 1} maximum pages`}
                                                    value={tier.maxPages}
                                                    onChange={(e) => updateTier(idx, 'maxPages', parseInt(e.target.value))}
                                                    className={cn(gvInput, 'h-8 bg-white text-[12px] tabular-nums')}
                                                />
                                            </div>
                                            <div className="relative col-span-4">
                                                <RupeeIcon size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate" />
                                                <input
                                                    type="number"
                                                    aria-label={`Tier ${idx + 1} fee`}
                                                    value={tier.fee}
                                                    onChange={(e) => updateTier(idx, 'fee', parseFloat(e.target.value))}
                                                    className={cn(gvInput, 'h-8 bg-white pl-7 text-[12px] tabular-nums')}
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => removeTier(idx)}
                                                    aria-label={`Remove tier ${idx + 1}`}
                                                    className={cn(gvIconBtn, 'h-8 w-8 hover:bg-market-tint hover:text-market')}
                                                >
                                                    <TrashIcon size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button type="button" onClick={addTier} className={cn(swButton({ variant: 'surface', size: 'sm' }), 'w-full')}>
                                <PlusIcon size={14} />
                                Add fee tier
                            </button>
                        </div>
                    </div>

                    <SheetFooter className="gap-2 border-t border-line pt-4">
                        <button type="button" onClick={() => setSheetOpen(false)} className={swButton({ variant: 'surface', size: 'md' })}>Cancel</button>
                        <button
                            type="button"
                            onClick={saveTiers}
                            disabled={saving}
                            className={swButton({ variant: 'primary', size: 'md' })}
                        >
                            {saving ? <Spinner label="Saving" className="h-3.5 w-3.5 border-white/40 border-t-white" /> : (isGlobalMode ? <GlobeIcon size={15} /> : <SaveIcon size={15} />)}
                            {isGlobalMode ? 'Apply to all stores' : 'Save changes'}
                        </button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
