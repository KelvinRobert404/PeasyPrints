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
import { EmptyState, swButton } from '@/components/swoop/primitives';
import { ImageIcon, InfoIcon, PlusIcon, TrashIcon } from '@/components/swoop/icons';
import { cn } from '@/lib/utils/cn';
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon } from '../icons';
import { PageHead, SectionTitle, Spinner, StatusTag, gvCard, gvIconBtn, gvInput, gvLabel } from '../ui';

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
                <Spinner className="h-5 w-5" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            {/* Header */}
            <PageHead
                title="Announcements"
                description="Manage homepage carousel slides."
                actions={
                    <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className={swButton({ variant: 'primary', size: 'sm' })}
                        disabled={showAddForm}
                    >
                        <PlusIcon size={14} />
                        Add slide
                    </button>
                }
            />

            {/* Add Form */}
            {showAddForm && (
                <div className={cn(gvCard, 'mb-3 p-4')}>
                    <SectionTitle className="mb-3">Add new slide</SectionTitle>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="announcement-image" className={gvLabel}>Image URL</label>
                            <input
                                id="announcement-image"
                                placeholder="https://example.com/image.jpg"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                className={gvInput}
                            />
                        </div>
                        <div>
                            <label htmlFor="announcement-alt" className={gvLabel}>Alt text (optional)</label>
                            <input
                                id="announcement-alt"
                                placeholder="Describe the image"
                                value={newAlt}
                                onChange={(e) => setNewAlt(e.target.value)}
                                className={gvInput}
                            />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={handleAdd}
                                disabled={saving || !newImageUrl.trim()}
                                className={swButton({ variant: 'primary', size: 'sm' })}
                            >
                                {saving ? <Spinner label="Adding" className="h-3.5 w-3.5 border-white/40 border-t-white" /> : 'Add slide'}
                            </button>
                            <button type="button" onClick={() => setShowAddForm(false)} className={swButton({ variant: 'surface', size: 'sm' })}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Slides List */}
            {announcements.length === 0 ? (
                <EmptyState icon={ImageIcon} title="No slides yet" body="Add your first announcement slide." />
            ) : (
                <div className={cn(gvCard, 'overflow-hidden')}>
                    {announcements.map((item, index) => (
                        <div
                            key={item.id}
                            className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
                        >
                            {/* Order buttons */}
                            <div className="flex flex-col">
                                <button
                                    type="button"
                                    onClick={() => handleMoveUp(index)}
                                    disabled={index === 0}
                                    aria-label="Move slide up"
                                    className={cn(gvIconBtn, 'h-6 w-6')}
                                >
                                    <ArrowUpIcon size={12} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMoveDown(index)}
                                    disabled={index === announcements.length - 1}
                                    aria-label="Move slide down"
                                    className={cn(gvIconBtn, 'h-6 w-6')}
                                >
                                    <ArrowDownIcon size={12} />
                                </button>
                            </div>

                            {/* Thumbnail */}
                            <div className={cn('h-14 w-24 flex-shrink-0 overflow-hidden rounded-[10px] bg-surface', !item.active && 'opacity-50')}>
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        alt={item.alt}
                                        className="h-full w-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '';
                                            (e.target as HTMLImageElement).className = 'hidden';
                                        }}
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-text-muted">
                                        <ImageIcon size={20} />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                                <p className={cn('truncate text-[12.5px] font-bold', item.active ? 'text-ink' : 'text-slate')}>{item.alt || 'Untitled'}</p>
                                <p className="truncate text-[11px] text-slate">{item.imageUrl}</p>
                            </div>

                            <StatusTag tone={item.active ? 'go' : 'slate'}>{item.active ? 'Live' : 'Hidden'}</StatusTag>

                            {/* Actions */}
                            <div className="flex items-center gap-0.5">
                                <button
                                    type="button"
                                    onClick={() => handleToggleActive(item.id, item.active)}
                                    className={cn(gvIconBtn, 'h-8 w-8', item.active && 'text-go-text hover:bg-go-tint hover:text-go-text')}
                                    title={item.active ? 'Hide slide' : 'Show slide'}
                                    aria-label={item.active ? 'Hide slide' : 'Show slide'}
                                >
                                    {item.active ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(item.id)}
                                    className={cn(gvIconBtn, 'h-8 w-8 hover:bg-market-tint hover:text-market')}
                                    title="Delete slide"
                                    aria-label="Delete slide"
                                >
                                    <TrashIcon size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info */}
            <div className="mt-3 flex items-start gap-2 rounded-[14px] bg-royal-tint p-3 text-royal">
                <InfoIcon size={16} className="mt-px shrink-0" />
                <p className="text-[12px] leading-[1.45]">
                    <strong className="font-bold">Tip:</strong> Slides auto-rotate every 3.5 seconds on the homepage.
                    Use high-quality images (recommended: 800×320px or similar aspect ratio).
                </p>
            </div>
        </div>
    );
}
