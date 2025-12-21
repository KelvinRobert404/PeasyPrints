'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { GraduationCap, Plus, Trash2, Loader2, Store } from 'lucide-react';
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
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between px-1 pb-4">
                <div>
                    <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Colleges</h1>
                    <p className="text-xs text-zinc-500">Manage colleges and their shop assignments.</p>
                </div>
                <div className="text-xs text-zinc-500 font-medium">
                    {colleges.length} Colleges
                </div>
            </div>

            {/* Add New College Form */}
            <div className="mb-4 p-4 rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-zinc-600 mb-1 block">College Name</label>
                        <Input
                            value={newCollegeName}
                            onChange={(e) => setNewCollegeName(e.target.value)}
                            placeholder="e.g., Kristu Jayanti College"
                            className="h-9"
                        />
                    </div>
                    <div className="w-32">
                        <label className="text-xs font-medium text-zinc-600 mb-1 block">Short Name</label>
                        <Input
                            value={newCollegeShortName}
                            onChange={(e) => setNewCollegeShortName(e.target.value)}
                            placeholder="e.g., KJC"
                            className="h-9"
                        />
                    </div>
                    <Button
                        onClick={handleAdd}
                        disabled={adding || !newCollegeName.trim()}
                        className="h-9 gap-2"
                    >
                        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add College
                    </Button>
                </div>
            </div>

            <div className="flex-1 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-5 pl-8">College Name</div>
                    <div className="col-span-2">Short Name</div>
                    <div className="col-span-2">Shops</div>
                    <div className="col-span-2">Created</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    ) : colleges.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
                            <GraduationCap className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No colleges added yet</p>
                            <p className="text-xs mt-1">Add your first college above</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {colleges.map((college) => (
                                <div
                                    key={college.id}
                                    className="group grid grid-cols-12 gap-4 items-center px-4 py-2 transition-colors text-[13px] relative min-h-[44px] hover:bg-zinc-50/80"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Name */}
                                    <div className="col-span-5 pl-4 flex items-center gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded bg-indigo-100 text-indigo-600 border border-indigo-200/50 text-[10px] font-bold">
                                            {college.shortName?.charAt(0) || college.name.charAt(0)}
                                        </div>
                                        <span className="font-medium text-zinc-900 truncate">{college.name}</span>
                                    </div>

                                    {/* Short Name */}
                                    <div className="col-span-2 text-zinc-600">
                                        {college.shortName || '—'}
                                    </div>

                                    {/* Shops Count */}
                                    <div className="col-span-2 flex items-center gap-1.5 text-zinc-600">
                                        <Store className="h-3 w-3 text-zinc-400" />
                                        {shopCounts[college.id] || 0} shops
                                    </div>

                                    {/* Created */}
                                    <div className="col-span-2 text-zinc-500 text-xs">
                                        {college.createdAt?.toDate?.()
                                            ? college.createdAt.toDate().toLocaleDateString()
                                            : '—'}
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex justify-end">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-all"
                                            onClick={() => setDeleteTarget(college)}
                                            disabled={(shopCounts[college.id] || 0) > 0}
                                            title={(shopCounts[college.id] || 0) > 0 ? 'Cannot delete: shops are assigned' : 'Delete college'}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete College</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
