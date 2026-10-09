'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { swButton } from '@/components/swoop/primitives';
import { PlusIcon, StoreIcon, TrashIcon } from '@/components/swoop/icons';
import type { College, Shop } from '@/types/models';
import { cn } from '@/lib/utils/cn';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CapIcon } from '../icons';
import { PageHead, Spinner, TableState, gvCard, gvIconBtn, gvInput, gvLabel, gvRow, gvTableHead } from '../ui';

export default function CollegesPage() {
    const [colleges, setColleges] = useState<College[]>([]);
    const [shopCounts, setShopCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [newCollegeName, setNewCollegeName] = useState('');
    const [newCollegeShortName, setNewCollegeShortName] = useState('');
    const [adding, setAdding] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<College | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'colleges'), (snap) => {
            const list = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as College[];
            setColleges(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Count shops per college
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'shops'), (snap) => {
            const counts: Record<string, number> = {};
            snap.docs.forEach((d) => {
                const collegeId = d.data().collegeId;
                if (collegeId) {
                    counts[collegeId] = (counts[collegeId] || 0) + 1;
                }
            });
            setShopCounts(counts);
        });
        return () => unsub();
    }, []);

    const handleAdd = async () => {
        if (!newCollegeName.trim()) return;
        setAdding(true);
        try {
            await addDoc(collection(db, 'colleges'), {
                name: newCollegeName.trim(),
                shortName: newCollegeShortName.trim() || null,
                createdAt: serverTimestamp(),
            });
            setNewCollegeName('');
            setNewCollegeShortName('');
        } catch (err) {
            console.error('Failed to add college', err);
        }
        setAdding(false);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, 'colleges', deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            console.error('Failed to delete college', err);
        }
        setDeleting(false);
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] flex-col">
            <PageHead
                title="Colleges"
                description="Manage colleges and their shop assignments."
                actions={<span className="text-[12px] font-bold text-slate tabular-nums">{colleges.length} colleges</span>}
            />

            {/* Add New College Form */}
            <div className={cn(gvCard, 'mb-3 p-3.5')}>
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <label htmlFor="college-name" className={gvLabel}>College name</label>
                        <input
                            id="college-name"
                            value={newCollegeName}
                            onChange={(e) => setNewCollegeName(e.target.value)}
                            placeholder="e.g., Kristu Jayanti College"
                            className={gvInput}
                        />
                    </div>
                    <div className="w-32">
                        <label htmlFor="college-short" className={gvLabel}>Short name</label>
                        <input
                            id="college-short"
                            value={newCollegeShortName}
                            onChange={(e) => setNewCollegeShortName(e.target.value)}
                            placeholder="e.g., KJC"
                            className={gvInput}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={adding || !newCollegeName.trim()}
                        className={cn(swButton({ variant: 'primary', size: 'sm' }), 'h-9')}
                    >
                        {adding ? <Spinner label="Adding" className="h-3.5 w-3.5 border-white/40 border-t-white" /> : <PlusIcon size={14} />}
                        Add college
                    </button>
                </div>
            </div>

            <div className={cn(gvCard, 'flex flex-1 flex-col overflow-hidden')}>
                <div className={cn(gvTableHead, 'grid grid-cols-12 gap-4 px-4 py-2')}>
                    <div className="col-span-5 pl-10">College name</div>
                    <div className="col-span-2">Short name</div>
                    <div className="col-span-2">Shops</div>
                    <div className="col-span-2">Created</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <TableState loading />
                    ) : colleges.length === 0 ? (
                        <TableState icon={CapIcon} title="No colleges added yet" body="Add your first college above." />
                    ) : (
                        <div>
                            {colleges.map((college) => (
                                <div
                                    key={college.id}
                                    className={cn(gvRow, 'group grid min-h-[44px] grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors hover:bg-surface/60')}
                                >
                                    {/* Name */}
                                    <div className="col-span-5 flex min-w-0 items-center gap-3">
                                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-royal-tint text-[10.5px] font-extrabold text-royal">
                                            {college.shortName?.charAt(0) || college.name.charAt(0)}
                                        </div>
                                        <span className="truncate font-bold">{college.name}</span>
                                    </div>

                                    {/* Short Name */}
                                    <div className="col-span-2 font-semibold text-text-secondary">
                                        {college.shortName || '—'}
                                    </div>

                                    {/* Shops Count */}
                                    <div className="col-span-2 flex items-center gap-1.5 text-text-secondary tabular-nums">
                                        <StoreIcon size={13} className="text-slate" />
                                        {shopCounts[college.id] || 0} shops
                                    </div>

                                    {/* Created */}
                                    <div className="col-span-2 text-[11.5px] text-slate tabular-nums">
                                        {college.createdAt?.toDate?.()
                                            ? college.createdAt.toDate().toLocaleDateString()
                                            : '—'}
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex justify-end">
                                        <button
                                            type="button"
                                            className={cn(gvIconBtn, 'opacity-0 hover:bg-market-tint hover:text-market focus-visible:opacity-100 group-hover:opacity-100')}
                                            onClick={() => setDeleteTarget(college)}
                                            disabled={(shopCounts[college.id] || 0) > 0}
                                            title={(shopCounts[college.id] || 0) > 0 ? 'Cannot delete: shops are assigned' : 'Delete college'}
                                            aria-label="Delete college"
                                        >
                                            <TrashIcon size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent className="max-w-sm gap-3 rounded-[14px] border-line p-5">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-heading text-[16px] font-bold text-ink">Delete college</AlertDialogTitle>
                        <AlertDialogDescription className="text-[12.5px] text-slate">
                            Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel disabled={deleting} className={cn(swButton({ variant: 'surface', size: 'sm' }), 'mt-0 border-0')}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className={swButton({ variant: 'danger', size: 'sm' })}
                        >
                            {deleting ? <Spinner label="Deleting" className="h-3.5 w-3.5 border-market/30 border-t-market" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
