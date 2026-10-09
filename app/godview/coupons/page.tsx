'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { IconTile, StatusLine, swButton } from '@/components/swoop/primitives';
import { EditIcon, PlusIcon, RupeeIcon, TicketIcon, TrashIcon } from '@/components/swoop/icons';
import type { Coupon, CouponDiscountType } from '@/types/models';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils/cn';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreIcon, PercentIcon } from '../icons';
import { PageHead, TableState, gvCard, gvIconBtn, gvInput, gvLabel, gvMenu, gvMenuItem, gvRow, gvTableHead } from '../ui';

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
        <div className="flex h-[calc(100vh-6rem)] flex-col">
            <PageHead
                title="Coupons"
                description="Manage discount codes and promotions."
                actions={
                    <button type="button" onClick={openCreate} className={swButton({ variant: 'primary', size: 'sm' })}>
                        <PlusIcon size={14} />
                        New coupon
                    </button>
                }
            />

            <div className={cn(gvCard, 'flex flex-1 flex-col overflow-hidden')}>
                <div className={cn(gvTableHead, 'grid grid-cols-12 gap-4 px-4 py-2')}>
                    <div className="col-span-3 pl-10">Coupon code</div>
                    <div className="col-span-2">Value</div>
                    <div className="col-span-2">Constraints</div>
                    <div className="col-span-2">Usage</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1 text-right"></div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <TableState loading />
                    ) : coupons.length === 0 ? (
                        <TableState icon={TicketIcon} title="No coupons yet" />
                    ) : (
                        <div>
                            {coupons.map((coupon) => (
                                <div
                                    key={coupon.id}
                                    className={cn(
                                        gvRow,
                                        'group grid min-h-[44px] grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors hover:bg-surface/60',
                                        !coupon.active && 'text-slate'
                                    )}
                                >
                                    {/* Code */}
                                    <div className="col-span-3 flex min-w-0 items-center gap-3">
                                        <IconTile icon={TicketIcon} tone={coupon.active ? 'royal' : 'surface'} shape="square" size={28} iconSize={15} />
                                        <span className="truncate font-mono text-[12.5px] font-bold">{coupon.code}</span>
                                    </div>

                                    {/* Value */}
                                    <div className="col-span-2 font-bold tabular-nums">
                                        {coupon.discountType === 'percentage' ? (
                                            <span className="inline-flex items-center gap-1 text-go-text">
                                                <PercentIcon size={13} />
                                                {coupon.discountValue}%
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-go-text">
                                                <RupeeIcon size={13} />
                                                {coupon.discountValue}
                                            </span>
                                        )}
                                    </div>

                                    {/* Constraints */}
                                    <div className="col-span-2 flex flex-col text-[11px] text-slate tabular-nums">
                                        {coupon.minOrderAmount ? <span>Min: ₹{coupon.minOrderAmount}</span> : null}
                                        {coupon.maxDiscount ? <span>Max off: ₹{coupon.maxDiscount}</span> : null}
                                        {!coupon.minOrderAmount && !coupon.maxDiscount && <span>-</span>}
                                    </div>

                                    {/* Usage */}
                                    <div className="col-span-2 text-[12px] text-text-secondary tabular-nums">
                                        <span className="font-bold text-ink">{coupon.usageCount || 0}</span>
                                        <span className="mx-1 text-text-muted">/</span>
                                        <span>{coupon.usageLimit || '∞'}</span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        <button
                                            type="button"
                                            onClick={() => toggleActive(coupon)}
                                            title={coupon.active ? 'Deactivate coupon' : 'Activate coupon'}
                                            className="campus-press -ml-2 inline-flex h-7 items-center rounded-full px-2 transition-colors hover:bg-surface"
                                        >
                                            <StatusLine open={!!coupon.active} label={coupon.active ? 'Active' : 'Inactive'} />
                                        </button>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${coupon.code}`}
                                                    className={cn(gvIconBtn, 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:bg-surface data-[state=open]:opacity-100')}
                                                >
                                                    <MoreIcon size={15} />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className={cn(gvMenu, 'w-[140px]')}>
                                                <DropdownMenuItem onClick={() => openEdit(coupon)} className={gvMenuItem}>
                                                    <EditIcon size={14} className="text-slate" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => deleteCoupon(coupon.id)} className={cn(gvMenuItem, 'text-market focus:bg-market-tint focus:text-market')}>
                                                    <TrashIcon size={14} />
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
                <DialogContent className="max-w-md overflow-hidden rounded-[14px] border border-line p-0">
                    <DialogHeader className="mb-0 border-b border-line px-5 py-3.5">
                        <DialogTitle className="font-heading text-[16px] font-bold text-ink">
                            {editingCoupon?.id ? 'Edit coupon' : 'Create new coupon'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 p-5">
                        <div>
                            <label htmlFor="coupon-code" className={gvLabel}>Coupon code</label>
                            <div className="relative">
                                <input
                                    id="coupon-code"
                                    value={editingCoupon?.code || ''}
                                    onChange={(e) => setEditingCoupon((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. SUMMER24"
                                    className={cn(gvInput, 'pl-9 font-mono uppercase')}
                                />
                                <TicketIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="coupon-type" className={gvLabel}>Type</label>
                                <select
                                    id="coupon-type"
                                    value={editingCoupon?.discountType || 'percentage'}
                                    onChange={(e) => setEditingCoupon((prev) => ({ ...prev, discountType: e.target.value as CouponDiscountType }))}
                                    className={cn(gvInput, 'cursor-pointer')}
                                >
                                    <option value="percentage">Percentage (%)</option>
                                    <option value="fixed">Fixed Amount (₹)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="coupon-value" className={gvLabel}>Value</label>
                                <input
                                    id="coupon-value"
                                    type="number"
                                    min="0"
                                    value={editingCoupon?.discountValue || ''}
                                    onChange={(e) => setEditingCoupon((prev) => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                                    className={cn(gvInput, 'tabular-nums')}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="coupon-min" className={gvLabel}>Min order amount</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate">₹</span>
                                    <input
                                        id="coupon-min"
                                        type="number"
                                        min="0"
                                        value={editingCoupon?.minOrderAmount || ''}
                                        onChange={(e) => setEditingCoupon((prev) => ({ ...prev, minOrderAmount: parseFloat(e.target.value) || 0 }))}
                                        placeholder="0"
                                        className={cn(gvInput, 'pl-7 tabular-nums')}
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="coupon-max" className={gvLabel}>Max discount</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate">₹</span>
                                    <input
                                        id="coupon-max"
                                        type="number"
                                        min="0"
                                        value={editingCoupon?.maxDiscount || ''}
                                        onChange={(e) => setEditingCoupon((prev) => ({ ...prev, maxDiscount: parseFloat(e.target.value) || undefined }))}
                                        placeholder="No limit"
                                        className={cn(gvInput, 'pl-7 tabular-nums')}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="coupon-limit" className={gvLabel}>Usage limit</label>
                            <input
                                id="coupon-limit"
                                type="number"
                                min="0"
                                value={editingCoupon?.usageLimit || ''}
                                onChange={(e) => setEditingCoupon((prev) => ({ ...prev, usageLimit: parseInt(e.target.value) || undefined }))}
                                placeholder="Leave empty for unlimited"
                                className={cn(gvInput, 'tabular-nums')}
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-0 border-t border-line px-5 py-3">
                        <button type="button" onClick={closeDialog} className={swButton({ variant: 'surface', size: 'sm' })}>Cancel</button>
                        <button
                            type="button"
                            onClick={saveCoupon}
                            disabled={saving || !editingCoupon?.code}
                            className={swButton({ variant: 'primary', size: 'sm' })}
                        >
                            {saving ? 'Saving...' : 'Save coupon'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
