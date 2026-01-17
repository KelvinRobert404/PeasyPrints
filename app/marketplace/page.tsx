"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMarketplaceStore, filterListingsByCategory } from '@/lib/stores/marketplaceStore';
import type { ListingCategory } from '@/types/models';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// Material icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded ${className}`}>{name}</span>;
}

const TABS: { id: ListingCategory; label: string; icon: string }[] = [
  { id: 'student', label: 'Student', icon: 'school' },
  { id: 'housing', label: 'Housing', icon: 'home' },
  { id: 'tickets', label: 'Tickets', icon: 'confirmation_number' },
];

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<ListingCategory>('student');
  const [search, setSearch] = useState('');
  const { listings, loading, error, subscribe } = useMarketplaceStore();
  const { selectedCollege } = useCollegeStore();

  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  // Dev-only: seed a sample listing
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    if (loading) return;
    if (listings.length > 0) return;
    if (window.localStorage.getItem('pp_sample_listing_seeded') === '1') return;

    (async () => {
      try {
        await addDoc(collection(db, 'listings'), {
          category: 'student',
          status: 'active',
          collegeName: selectedCollege,
          title: '2nd year Economics textbook – like new',
          description: 'Barely used, neat highlights. Pickup near college gate.',
          price: 350,
          images: [],
          tags: ['Negotiable', 'On campus pickup', 'Good condition'],
          whatsappAllowed: false,
          whatsappNumber: null,
          createdAt: serverTimestamp() as any,
          authorId: 'sample-user',
          authorName: 'Sample Student',
          authorVerified: false,
          location: {
            lat: 13.0507,
            lng: 77.64,
            area: 'Kothanur',
          },
        });
        window.localStorage.setItem('pp_sample_listing_seeded', '1');
      } catch {
        // ignore
      }
    })();
  }, [loading, listings.length, selectedCollege]);

  const filtered = useMemo(() => {
    const base = filterListingsByCategory(listings, activeTab);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((l) => {
      if (l.title.toLowerCase().includes(q)) return true;
      if (l.description && l.description.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [listings, activeTab, search]);

  return (
    <div className="flex min-h-screen flex-col bg-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-blue-600">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-white active:opacity-70">
                <Icon name="arrow_back" className="text-2xl" />
              </Link>
              <h1 className="text-lg font-semibold text-white">Marketplace</h1>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white active:bg-white/30"
              aria-label="Filter"
            >
              <Icon name="tune" className="text-xl" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Icon name="search" className="text-lg text-blue-300" />
            </div>
            <Input
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-xl border-0 bg-white/20 pl-10 text-sm text-white placeholder:text-blue-200 focus:bg-white/30 focus:ring-0"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white text-blue-600'
                  : 'bg-white/20 text-white active:bg-white/30'
              )}
            >
              <Icon name={tab.icon} className="text-base" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Icon name="storefront" className="text-3xl text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No listings yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Be the first to post in this category!
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} category={activeTab} />
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-4 left-4 right-4 max-w-[396px] mx-auto">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 py-3.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 text-white font-medium active:scale-[0.98] transition-transform"
        >
          <Icon name="home" className="text-xl" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
