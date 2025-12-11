'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Store, Clock, MapPin, Edit2, Check, X, Loader2 } from 'lucide-react';
import type { Shop } from '@/types/models';
import { cn } from '@/lib/utils/cn';

export default function StoresPage() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Shop>>({});
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

    const startEdit = (shop: Shop) => {
        setEditingId(shop.id);
        setEditForm({
            name: shop.name,
            address: shop.address,
            openingTime: shop.openingTime || '',
            closingTime: shop.closingTime || '',
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'shops', editingId), {
                name: editForm.name,
                address: editForm.address,
                openingTime: editForm.openingTime,
                closingTime: editForm.closingTime,
                timing: `${editForm.openingTime} - ${editForm.closingTime}`,
            });
            setEditingId(null);
            setEditForm({});
        } catch (err) {
            console.error('Failed to save', err);
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
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between px-1 pb-4">
                <div>
                    <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Stores</h1>
                    <p className="text-xs text-zinc-500">Manage store details and operation status.</p>
                </div>
                <div className="text-xs text-zinc-500 font-medium">
                    {shops.length} Active Stores
                </div>
            </div>

            <div className="flex-1 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-3 pl-8">Store Name</div>
                    <div className="col-span-4">Address</div>
                    <div className="col-span-2">Timings</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-1">Fee</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    ) : shops.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
                            <Store className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No stores found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {shops.map((shop) => {
                                const isEditing = editingId === shop.id;
                                return (
                                    <div
                                        key={shop.id}
                                        className={cn(
                                            "group grid grid-cols-12 gap-4 items-center px-4 py-2 transition-colors text-[13px] relative min-h-[44px]",
                                            isEditing ? "bg-indigo-50/30" : "hover:bg-zinc-50/80"
                                        )}
                                    >
                                        {!isEditing && (
                                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}

                                        {/* Name */}
                                        <div className="col-span-3 pl-4 flex items-center gap-3">
                                            <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-100 text-zinc-500 border border-zinc-200/50 text-[10px] font-bold">
                                                {shop.name.charAt(0)}
                                            </div>
                                            {isEditing ? (
                                                <Input
                                                    value={editForm.name || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    className="h-7 text-xs"
                                                />
                                            ) : (
                                                <span className="font-medium text-zinc-900 truncate">{shop.name}</span>
                                            )}
                                        </div>

                                        {/* Address */}
                                        <div className="col-span-4 flex items-center gap-2 text-zinc-600">
                                            <MapPin className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                                            {isEditing ? (
                                                <Input
                                                    value={editForm.address || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                                    className="h-7 text-xs w-full"
                                                />
                                            ) : (
                                                <span className="truncate">{shop.address || 'No address'}</span>
                                            )}
                                        </div>

                                        {/* Timings */}
                                        <div className="col-span-2 flex items-center gap-2 text-zinc-600 font-mono text-xs">
                                            <Clock className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                                            {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="time"
                                                        value={editForm.openingTime || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, openingTime: e.target.value })}
                                                        className="h-7 w-[60px] text-[10px] px-1"
                                                    />
                                                    <span className="text-zinc-400">-</span>
                                                    <Input
                                                        type="time"
                                                        value={editForm.closingTime || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, closingTime: e.target.value })}
                                                        className="h-7 w-[60px] text-[10px] px-1"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="truncate">{shop.openingTime} - {shop.closingTime}</span>
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-1">
                                            <button
                                                onClick={() => toggleOpen(shop)}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                                                    shop.isOpen
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                                                        : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"
                                                )}
                                            >
                                                <div className={cn("h-1.5 w-1.5 rounded-full", shop.isOpen ? "bg-emerald-500" : "bg-zinc-400")} />
                                                {shop.isOpen ? 'Open' : 'Closed'}
                                            </button>
                                        </div>

                                        {/* Fee */}
                                        <div className="col-span-1 text-zinc-600 tabular-nums">
                                            ₹{shop.pricing?.convenienceFee ?? 0}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 flex justify-end">
                                            {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                        onClick={saveEdit}
                                                        disabled={saving}
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                                                        onClick={cancelEdit}
                                                        disabled={saving}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                                    onClick={() => startEdit(shop)}
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
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
