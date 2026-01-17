'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/config';
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp,
} from 'firebase/firestore';
import { Plus, Trash2, GripVertical, Eye, EyeOff, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Announcement = {
    id: string;
    imageUrl: string;
    alt: string;
    order: number;
    active: boolean;
    createdAt?: any;
};

export default function AnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state for new announcement
    const [newImageUrl, setNewImageUrl] = useState('');
    const [newAlt, setNewAlt] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    // Fetch announcements
    useEffect(() => {
        fetchAnnouncements();
    }, []);

    async function fetchAnnouncements() {
        try {
            const q = query(collection(db, 'announcements'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            const items: Announcement[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            } as Announcement));
            setAnnouncements(items);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleAdd() {
        if (!newImageUrl.trim()) return;

        setSaving(true);
        try {
            const maxOrder = announcements.length > 0
                ? Math.max(...announcements.map(a => a.order)) + 1
                : 0;

            await addDoc(collection(db, 'announcements'), {
                imageUrl: newImageUrl.trim(),
                alt: newAlt.trim() || 'Announcement',
                order: maxOrder,
                active: true,
                createdAt: serverTimestamp(),
            });

            setNewImageUrl('');
            setNewAlt('');
            setShowAddForm(false);
            await fetchAnnouncements();
        } catch (error) {
            console.error('Error adding announcement:', error);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive(id: string, currentActive: boolean) {
        try {
            await updateDoc(doc(db, 'announcements', id), {
                active: !currentActive,
            });
            await fetchAnnouncements();
        } catch (error) {
            console.error('Error toggling announcement:', error);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this slide?')) return;

        try {
            await deleteDoc(doc(db, 'announcements', id));
            await fetchAnnouncements();
        } catch (error) {
            console.error('Error deleting announcement:', error);
        }
    }

    async function handleMoveUp(index: number) {
        if (index === 0) return;

        const items = [...announcements];
        const currentOrder = items[index].order;
        const prevOrder = items[index - 1].order;

        try {
            await updateDoc(doc(db, 'announcements', items[index].id), { order: prevOrder });
            await updateDoc(doc(db, 'announcements', items[index - 1].id), { order: currentOrder });
            await fetchAnnouncements();
        } catch (error) {
            console.error('Error reordering:', error);
        }
    }

    async function handleMoveDown(index: number) {
        if (index === announcements.length - 1) return;

        const items = [...announcements];
        const currentOrder = items[index].order;
        const nextOrder = items[index + 1].order;

        try {
            await updateDoc(doc(db, 'announcements', items[index].id), { order: nextOrder });
            await updateDoc(doc(db, 'announcements', items[index + 1].id), { order: currentOrder });
            await fetchAnnouncements();
        } catch (error) {
            console.error('Error reordering:', error);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-zinc-900">Announcements</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">Manage homepage carousel slides</p>
                </div>
                <Button
                    onClick={() => setShowAddForm(true)}
                    className="gap-2"
                    disabled={showAddForm}
                >
                    <Plus className="h-4 w-4" />
                    Add Slide
                </Button>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="mb-6 p-4 bg-white border border-zinc-200 rounded-xl shadow-sm">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">Add New Slide</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Image URL</label>
                            <Input
                                placeholder="https://example.com/image.jpg"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-600 mb-1">Alt Text (optional)</label>
                            <Input
                                placeholder="Describe the image"
                                value={newAlt}
                                onChange={(e) => setNewAlt(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button onClick={handleAdd} disabled={saving || !newImageUrl.trim()}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Slide'}
                            </Button>
                            <Button variant="outline" onClick={() => setShowAddForm(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Slides List */}
            {announcements.length === 0 ? (
                <div className="text-center py-16 bg-zinc-50 rounded-xl border-2 border-dashed border-zinc-200">
                    <ImageIcon className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
                    <p className="text-sm text-zinc-500">No slides yet</p>
                    <p className="text-xs text-zinc-400 mt-1">Add your first announcement slide</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {announcements.map((item, index) => (
                        <div
                            key={item.id}
                            className={`flex items-center gap-3 p-3 bg-white border rounded-xl transition-all ${item.active ? 'border-zinc-200' : 'border-zinc-100 opacity-60'
                                }`}
                        >
                            {/* Drag handle / Order buttons */}
                            <div className="flex flex-col gap-0.5">
                                <button
                                    onClick={() => handleMoveUp(index)}
                                    disabled={index === 0}
                                    className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                                >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleMoveDown(index)}
                                    disabled={index === announcements.length - 1}
                                    className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                                >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>

                            {/* Thumbnail */}
                            <div className="w-24 h-14 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.alt}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '';
                                            (e.target as HTMLImageElement).className = 'hidden';
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="h-5 w-5 text-zinc-300" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 truncate">{item.alt || 'Untitled'}</p>
                                <p className="text-xs text-zinc-400 truncate">{item.imageUrl}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleToggleActive(item.id, item.active)}
                                    className={`p-2 rounded-lg transition-colors ${item.active
                                            ? 'text-emerald-600 hover:bg-emerald-50'
                                            : 'text-zinc-400 hover:bg-zinc-100'
                                        }`}
                                    title={item.active ? 'Hide slide' : 'Show slide'}
                                >
                                    {item.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete slide"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-700">
                    <strong>Tip:</strong> Slides auto-rotate every 3.5 seconds on the homepage.
                    Use high-quality images (recommended: 800×320px or similar aspect ratio).
                </p>
            </div>
        </div>
    );
}
