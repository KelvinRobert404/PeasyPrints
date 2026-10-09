'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import type { Shop, College } from '@/types/models';
import { cn } from '@/lib/utils/cn';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { StatusLine } from '@/components/swoop/primitives';
import { CheckIcon, ClockIcon, CloseIcon, EditIcon, PinIcon, StoreIcon } from '@/components/swoop/icons';
import { CapIcon } from '../icons';
import { PageHead, Spinner, TableState, gvCard, gvIconBtn, gvInput, gvMenu, gvRow, gvTableHead } from '../ui';

/** Compact (28px) variant of the Godview surface input for inline row editing. */
const EDIT_INPUT = cn(gvInput, 'h-7 min-w-0 rounded-[8px] bg-white px-2 text-[12px]');

export default function StoresPage() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [colleges, setColleges] = useState<College[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Shop & { collegeId: string }>>({});
    const [saving, setSaving] = useState(false);

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

    // Fetch colleges
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'colleges'), (snap) => {
            const list = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as College[];
            setColleges(list);
        });
        return () => unsub();
    }, []);

    const getCollegeName = (collegeId?: string) => {
        if (!collegeId) return null;
        return colleges.find(c => c.id === collegeId)?.name || null;
    };

    const startEdit = (shop: Shop) => {
        setEditingId(shop.id);
        setEditForm({
            name: shop.name,
            address: shop.address,
            openingTime: shop.openingTime || '',
            closingTime: shop.closingTime || '',
            collegeId: shop.collegeId || '',
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        if (!editingId) return;
        if (!editForm.openingTime || !editForm.closingTime) {
            alert('Set both opening and closing times.');
            return;
        }
        setSaving(true);
        try {
            await updateDoc(doc(db, 'shops', editingId), {
                name: editForm.name,
                address: editForm.address,
                openingTime: editForm.openingTime,
                closingTime: editForm.closingTime,
                timing: `${editForm.openingTime} to ${editForm.closingTime}`,
                collegeId: editForm.collegeId || null,
            });
            setEditingId(null);
            setEditForm({});
        } catch (err: any) {
            console.error('Failed to save', err);
            alert(err?.message || 'Failed to save store');
        }
        setSaving(false);
    };

    const toggleOpen = async (shop: Shop) => {
        try {
            await updateDoc(doc(db, 'shops', shop.id), {
                isOpen: !shop.isOpen,
            });
        } catch (err) {
            console.error('Failed to toggle', err);
        }
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] flex-col">
            <PageHead
                title="Stores"
                description="Manage store details and operation status."
                actions={<span className="text-[12px] font-bold text-slate tabular-nums">{shops.length} Active Stores</span>}
            />

            <div className={cn(gvCard, 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
                <div className={cn(gvTableHead, 'grid grid-cols-12 gap-4 px-4 py-2')}>
                    <div className="col-span-2 pl-10">Store name</div>
                    <div className="col-span-3">Address</div>
                    <div className="col-span-2">College</div>
                    <div className="col-span-2">Timings</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-1 text-right">Fee</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <TableState loading />
                    ) : shops.length === 0 ? (
                        <TableState icon={StoreIcon} title="No stores found" />
                    ) : (
                        <div>
                            {shops.map((shop) => {
                                const isEditing = editingId === shop.id;
                                const collegeName = getCollegeName(shop.collegeId);
                                return (
                                    <div
                                        key={shop.id}
                                        className={cn(
                                            gvRow,
                                            'group grid min-h-[44px] grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors',
                                            isEditing ? 'bg-royal-tint/40' : 'hover:bg-surface/60'
                                        )}
                                    >
                                        {/* Name */}
                                        <div className="col-span-2 flex min-w-0 items-center gap-3">
                                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-surface text-[10.5px] font-extrabold text-text-secondary">
                                                {shop.name.charAt(0)}
                                            </div>
                                            {isEditing ? (
                                                <input
                                                    aria-label="Store name"
                                                    value={editForm.name || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    className={EDIT_INPUT}
                                                />
                                            ) : (
                                                <span className="truncate font-bold text-ink">{shop.name}</span>
                                            )}
                                        </div>

                                        {/* Address */}
                                        <div className="col-span-3 flex min-w-0 items-center gap-1.5 text-text-secondary">
                                            <PinIcon size={14} className="shrink-0 text-slate" />
                                            {isEditing ? (
                                                <input
                                                    aria-label="Store address"
                                                    value={editForm.address || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                                    className={EDIT_INPUT}
                                                />
                                            ) : (
                                                <span className="truncate">{shop.address || 'No address'}</span>
                                            )}
                                        </div>

                                        {/* College */}
                                        <div className="col-span-2 flex min-w-0 items-center gap-2">
                                            {isEditing ? (
                                                <Select
                                                    value={editForm.collegeId || ''}
                                                    onValueChange={(value) => setEditForm({ ...editForm, collegeId: value })}
                                                >
                                                    <SelectTrigger className="h-7 rounded-[8px] border-transparent bg-white px-2 text-[12px] font-semibold text-ink focus:border-royal focus:ring-[3px] focus:ring-royal/15 focus:ring-offset-0">
                                                        <SelectValue placeholder="Select college" />
                                                    </SelectTrigger>
                                                    <SelectContent className={gvMenu}>
                                                        {colleges.map((college) => (
                                                            <SelectItem key={college.id} value={college.id} className="rounded-[8px] text-[12px] font-semibold text-ink focus:bg-surface">
                                                                {college.shortName || college.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : collegeName ? (
                                                <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink">
                                                    <CapIcon size={13} className="shrink-0 text-slate" />
                                                    <span className="truncate">{collegeName}</span>
                                                </span>
                                            ) : (
                                                <span className="text-[11.5px] text-slate">Not assigned</span>
                                            )}
                                        </div>

                                        {/* Timings */}
                                        <div className="col-span-2 flex min-w-0 items-center gap-1.5 text-[12px] tabular-nums text-text-secondary">
                                            <ClockIcon size={14} className="shrink-0 text-slate" />
                                            {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="time"
                                                        aria-label="Opening time"
                                                        value={editForm.openingTime || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, openingTime: e.target.value })}
                                                        className={cn(EDIT_INPUT, 'w-[68px] px-1 text-[11px]')}
                                                    />
                                                    <span className="text-slate">-</span>
                                                    <input
                                                        type="time"
                                                        aria-label="Closing time"
                                                        value={editForm.closingTime || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, closingTime: e.target.value })}
                                                        className={cn(EDIT_INPUT, 'w-[68px] px-1 text-[11px]')}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="truncate">{shop.openingTime} - {shop.closingTime}</span>
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-1">
                                            <button
                                                type="button"
                                                onClick={() => toggleOpen(shop)}
                                                title={shop.isOpen ? 'Mark closed' : 'Mark open'}
                                                className="campus-press -ml-2 inline-flex h-7 items-center rounded-full px-2 transition-colors hover:bg-surface"
                                            >
                                                <StatusLine open={!!shop.isOpen} label={shop.isOpen ? 'Open' : 'Closed'} />
                                            </button>
                                        </div>

                                        {/* Fee */}
                                        <div className="col-span-1 text-right font-bold tabular-nums">
                                            ₹{shop.pricing?.convenienceFee ?? 0}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 flex justify-end">
                                            {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        aria-label="Save store"
                                                        className={cn(gvIconBtn, 'text-go-text hover:bg-go-tint hover:text-go-text')}
                                                        onClick={saveEdit}
                                                        disabled={saving}
                                                    >
                                                        {saving ? <Spinner label="Saving" className="h-3.5 w-3.5" /> : <CheckIcon size={14} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label="Cancel editing"
                                                        className={gvIconBtn}
                                                        onClick={cancelEdit}
                                                        disabled={saving}
                                                    >
                                                        <CloseIcon size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    aria-label={`Edit ${shop.name}`}
                                                    className={cn(gvIconBtn, 'opacity-0 hover:bg-royal-tint hover:text-royal focus-visible:opacity-100 group-hover:opacity-100')}
                                                    onClick={() => startEdit(shop)}
                                                >
                                                    <EditIcon size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
