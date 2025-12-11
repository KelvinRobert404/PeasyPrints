'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Store, IndianRupee, Save, Loader2, ArrowRight, Layers, Plus, Trash2, Globe } from 'lucide-react';
import type { Shop } from '@/types/models';
import { cn } from '@/lib/utils/cn';

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
        setSaving(true);
        try {
            if (isGlobalMode) {
                // Apply to ALL shops
                const batch = writeBatch(db);
                shops.forEach((shop) => {
                    const ref = doc(db, 'shops', shop.id);
                    batch.update(ref, {
                        'pricing.convenienceFeeTiers': editingTiers
                    });
                });
                await batch.commit();
            } else if (selectedShop) {
                // Apply to single shop
                await updateDoc(doc(db, 'shops', selectedShop.id), {
                    'pricing.convenienceFeeTiers': editingTiers,
                    // Optional: clear legacy flat fee to avoid confusion, or keep as fallback
                });
            }
            setSheetOpen(false);
        } catch (err) {
            console.error('Failed to save tiers', err);
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
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between px-1 pb-4">
                <div>
                    <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Fee Management</h1>
                    <p className="text-xs text-zinc-500">Manage tiered service fees per store.</p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGlobalConfig}
                    className="h-8 border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                >
                    <Globe className="h-3.5 w-3.5 mr-2" />
                    Configure Global Tiers
                </Button>
            </div>

            <div className="flex-1 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-4 pl-8">Store Name</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-4">Active Fee Structure</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {shops.map((shop) => {
                                const tiers = shop.pricing?.convenienceFeeTiers;
                                const hasTiers = tiers && tiers.length > 0;
                                const flatFee = shop.pricing?.convenienceFee ?? 0;

                                return (
                                    <div key={shop.id} className="group grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-zinc-50/80 transition-colors text-[13px] relative min-h-[56px]">
                                        {/* Name */}
                                        <div className="col-span-4 pl-4 flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-100 text-zinc-500 border border-zinc-200/50">
                                                <Store className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium text-zinc-900 truncate">{shop.name}</span>
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-2">
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                                shop.isOpen
                                                    ? "bg-emerald-50/50 text-emerald-700 border-emerald-100"
                                                    : "bg-zinc-100 text-zinc-500 border-zinc-200"
                                            )}>
                                                <div className={cn("h-1.5 w-1.5 rounded-full", shop.isOpen ? "bg-emerald-500" : "bg-zinc-400")} />
                                                {shop.isOpen ? 'Open' : 'Closed'}
                                            </div>
                                        </div>

                                        {/* Structure Summary */}
                                        <div className="col-span-4 text-zinc-500 text-xs">
                                            {hasTiers ? (
                                                <div className="flex items-center gap-2">
                                                    <Layers className="h-3.5 w-3.5 text-indigo-500" />
                                                    <span>{tiers.length} tiers configured</span>
                                                    <span className="text-zinc-400">({tiers[0].minPages}-{tiers[0].maxPages}pgs: ₹{tiers[0].fee}...)</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <IndianRupee className="h-3.5 w-3.5 text-zinc-400" />
                                                    <span>Flat fee: ₹{flatFee}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-2 flex justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleManageTiers(shop)}
                                                className="h-7 text-xs border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                                            >
                                                Manage Tiers
                                            </Button>
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
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>{isGlobalMode ? 'Global Fee Configuration' : 'Manage Convenience Fees'}</SheetTitle>
                        <SheetDescription>
                            {isGlobalMode
                                ? 'Define a tiered fee structure to apply to ALL stores instantly.'
                                : <span>Configure tiered fees for <span className="font-medium text-zinc-900">{selectedShop?.name}</span>.</span>
                            }
                        </SheetDescription>
                    </SheetHeader>

                    <div className="py-6 space-y-6">
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={generateStandardTiers}
                                className="text-xs h-7"
                            >
                                Auto-fill Standard Tiers
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {editingTiers.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-zinc-100 rounded-lg">
                                    <p className="text-sm text-zinc-500 mb-2">No tiers configured.</p>
                                    {!isGlobalMode && (
                                        <p className="text-xs text-zinc-400">Using legacy flat fee: ₹{selectedShop?.pricing?.convenienceFee ?? 0}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-12 gap-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wide px-2">
                                        <div className="col-span-3">Min Pages</div>
                                        <div className="col-span-3">Max Pages</div>
                                        <div className="col-span-4">Fee (₹)</div>
                                        <div className="col-span-2"></div>
                                    </div>
                                    {editingTiers.map((tier, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-zinc-50 p-2 rounded-md border border-zinc-100">
                                            <div className="col-span-3">
                                                <Input
                                                    type="number"
                                                    value={tier.minPages}
                                                    onChange={(e) => updateTier(idx, 'minPages', parseInt(e.target.value))}
                                                    className="h-8 text-xs bg-white"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <Input
                                                    type="number"
                                                    value={tier.maxPages}
                                                    onChange={(e) => updateTier(idx, 'maxPages', parseInt(e.target.value))}
                                                    className="h-8 text-xs bg-white"
                                                />
                                            </div>
                                            <div className="col-span-4 relative">
                                                <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                                                <Input
                                                    type="number"
                                                    value={tier.fee}
                                                    onChange={(e) => updateTier(idx, 'fee', parseInt(e.target.value))}
                                                    className="h-8 text-xs bg-white pl-7"
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => removeTier(idx)}
                                                    className="h-8 w-8 text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button onClick={addTier} variant="outline" className="w-full border-dashed border-zinc-300 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Fee Tier
                            </Button>
                        </div>
                    </div>

                    <SheetFooter>
                        <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                        <Button
                            onClick={saveTiers}
                            disabled={saving}
                            className={cn(
                                "text-white",
                                isGlobalMode ? "bg-indigo-600 hover:bg-indigo-700" : "bg-zinc-900 hover:bg-zinc-800"
                            )}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (isGlobalMode ? <Globe className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />)}
                            {isGlobalMode ? 'Apply to All Stores' : 'Save Changes'}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
