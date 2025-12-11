'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Tag, Plus, Edit, Trash2, MoreHorizontal, Percent, IndianRupee, Loader2, Copy } from 'lucide-react';
import type { Coupon, CouponDiscountType } from '@/types/models';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils/cn';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const EMPTY_COUPON: Partial<Coupon> = {
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscount: undefined,
    usageLimit: undefined,
    usageCount: 0,
    shopIds: [],
    active: true,
};

export default function CouponsPage() {
    const { user } = useUser();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon> | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'coupons'), (snap) => {
            const list = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as Coupon[];
            setCoupons(list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const openCreate = () => {
        setEditingCoupon({ ...EMPTY_COUPON });
        setDialogOpen(true);
    };

    const openEdit = (coupon: Coupon) => {
        setEditingCoupon({ ...coupon });
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditingCoupon(null);
    };

    const saveCoupon = async () => {
        if (!editingCoupon?.code) return;
        setSaving(true);
        try {
            const data = {
                code: editingCoupon.code.toUpperCase().trim(),
                discountType: editingCoupon.discountType || 'percentage',
                discountValue: editingCoupon.discountValue || 0,
                minOrderAmount: editingCoupon.minOrderAmount || 0,
                maxDiscount: editingCoupon.maxDiscount || null,
                usageLimit: editingCoupon.usageLimit || null,
                usageCount: editingCoupon.usageCount || 0,
                shopIds: editingCoupon.shopIds || [],
                active: editingCoupon.active ?? true,
                createdBy: user?.primaryEmailAddress?.emailAddress || 'admin',
            };

            if (editingCoupon.id) {
                await updateDoc(doc(db, 'coupons', editingCoupon.id), data);
            } else {
                await addDoc(collection(db, 'coupons'), {
                    ...data,
                    createdAt: serverTimestamp(),
                });
            }
            closeDialog();
        } catch (err) {
            console.error('Failed to save coupon', err);
        }
        setSaving(false);
    };

    const deleteCoupon = async (id: string) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return;
        try {
            await deleteDoc(doc(db, 'coupons', id));
        } catch (err) {
            console.error('Failed to delete coupon', err);
        }
    };

    const toggleActive = async (coupon: Coupon) => {
        try {
            await updateDoc(doc(db, 'coupons', coupon.id), {
                active: !coupon.active,
            });
        } catch (err) {
            console.error('Failed to toggle coupon', err);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between px-1 pb-4">
                <div>
                    <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Coupons</h1>
                    <p className="text-xs text-zinc-500">Manage discount codes and promotions.</p>
                </div>
                <Button onClick={openCreate} size="sm" className="h-8 text-xs bg-zinc-900 hover:bg-zinc-800 text-white">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    New Coupon
                </Button>
            </div>

            <div className="flex-1 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-3 pl-8">Coupon Code</div>
                    <div className="col-span-2">Value</div>
                    <div className="col-span-2">Constraints</div>
                    <div className="col-span-2">Usage</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1 text-right"></div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    ) : coupons.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
                            <Tag className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No coupons yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {coupons.map((coupon) => (
                                <div key={coupon.id} className={cn("group grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-zinc-50/80 transition-colors text-[13px] relative min-h-[44px]", !coupon.active && "opacity-75 bg-zinc-50/30")}>
                                    {/* Code */}
                                    <div className="col-span-3 pl-4 flex items-center gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                            <Tag className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-mono font-medium text-zinc-900">{coupon.code}</span>
                                        </div>
                                    </div>

                                    {/* Value */}
                                    <div className="col-span-2 font-medium text-zinc-700">
                                        {coupon.discountType === 'percentage' ? (
                                            <span className="inline-flex items-center gap-1 text-emerald-600">
                                                <Percent className="h-3 w-3" />
                                                {coupon.discountValue}%
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-emerald-600">
                                                <IndianRupee className="h-3 w-3" />
                                                {coupon.discountValue}
                                            </span>
                                        )}
                                    </div>

                                    {/* Constraints */}
                                    <div className="col-span-2 flex flex-col text-[11px] text-zinc-500">
                                        {coupon.minOrderAmount ? <span>Min: ₹{coupon.minOrderAmount}</span> : null}
                                        {coupon.maxDiscount ? <span>Max Off: ₹{coupon.maxDiscount}</span> : null}
                                        {!coupon.minOrderAmount && !coupon.maxDiscount && <span className="text-zinc-400">-</span>}
                                    </div>

                                    {/* Usage */}
                                    <div className="col-span-2 text-zinc-600 text-xs">
                                        <span className="font-medium text-zinc-900">{coupon.usageCount || 0}</span>
                                        <span className="text-zinc-400 mx-1">/</span>
                                        <span>{coupon.usageLimit || '∞'}</span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        <button
                                            onClick={() => toggleActive(coupon)}
                                            className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                                                coupon.active
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                                                    : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"
                                            )}
                                        >
                                            <div className={cn("h-1.5 w-1.5 rounded-full", coupon.active ? "bg-emerald-500" : "bg-zinc-400")} />
                                            {coupon.active ? 'Active' : 'Inactive'}
                                        </button>
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
                                                <DropdownMenuItem onClick={() => openEdit(coupon)} className="text-xs">
                                                    <Edit className="h-3.5 w-3.5 mr-2 text-zinc-500" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => deleteCoupon(coupon.id)} className="text-xs text-red-600 focus:text-red-700 focus:bg-red-50">
                                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden bg-white border-zinc-200">
                    <DialogHeader className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                        <DialogTitle className="text-sm font-semibold text-zinc-900">
                            {editingCoupon?.id ? 'Edit Coupon' : 'Create New Coupon'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-zinc-700 mb-1 block">Coupon Code</label>
                                <div className="relative">
                                    <Input
                                        value={editingCoupon?.code || ''}
                                        onChange={(e) => setEditingCoupon((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. SUMMER24"
                                        className="font-mono text-sm uppercase pl-9"
                                    />
                                    <Tag className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-zinc-700 mb-1 block">Type</label>
                                    <select
                                        value={editingCoupon?.discountType || 'percentage'}
                                        onChange={(e) => setEditingCoupon((prev) => ({ ...prev, discountType: e.target.value as CouponDiscountType }))}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (₹)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-zinc-700 mb-1 block">Value</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={editingCoupon?.discountValue || ''}
                                        onChange={(e) => setEditingCoupon((prev) => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                                        className=""
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-zinc-700 mb-1 block">Min Order Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-zinc-400 text-xs">₹</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={editingCoupon?.minOrderAmount || ''}
                                            onChange={(e) => setEditingCoupon((prev) => ({ ...prev, minOrderAmount: parseFloat(e.target.value) || 0 }))}
                                            placeholder="0"
                                            className="pl-6"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-zinc-700 mb-1 block">Max Discount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-zinc-400 text-xs">₹</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={editingCoupon?.maxDiscount || ''}
                                            onChange={(e) => setEditingCoupon((prev) => ({ ...prev, maxDiscount: parseFloat(e.target.value) || undefined }))}
                                            placeholder="No limit"
                                            className="pl-6"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-zinc-700 mb-1 block">Usage Limit</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={editingCoupon?.usageLimit || ''}
                                    onChange={(e) => setEditingCoupon((prev) => ({ ...prev, usageLimit: parseInt(e.target.value) || undefined }))}
                                    placeholder="Leave empty for unlimited"
                                    className=""
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                        <Button variant="outline" onClick={closeDialog} size="sm" className="text-xs h-8">Cancel</Button>
                        <Button onClick={saveCoupon} disabled={saving || !editingCoupon?.code} size="sm" className="text-xs h-8 bg-zinc-900 hover:bg-zinc-800">
                            {saving ? 'Saving...' : 'Save Coupon'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
