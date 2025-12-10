"use client";

import { useEffect, useMemo, useState } from 'react';
import { useMarketplaceStore, filterListingsByCategory } from '@/lib/stores/marketplaceStore';
import type { ListingCategory } from '@/types/models';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const TABS: { id: ListingCategory; label: string; icon: React.ReactNode }[] = [
  {
    id: 'student',
    label: 'Student',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: 'housing',
    label: 'Housing',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'tickets',
    label: 'Tickets',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-gray-50 to-white pb-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-end justify-between">
            <div>
              <h1
                className="text-2xl font-bold font-quinn tracking-tight"
                style={{ color: '#FF4D4D' }}
              >
                marketplace
              </h1>
              <p className="mt-0.5 text-xs text-gray-500">
                For Kristu Jayanti students
              </p>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
              aria-label="Filter"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Input
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border-gray-200 bg-gray-50 pl-10 text-sm placeholder:text-gray-400 focus:border-[#FF4D4D] focus:ring-[#FF4D4D]/20"
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
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-[#FF4D4D] text-white shadow-md shadow-red-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FF4D4D]" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">No listings yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Be the first to post in this category!
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} category={activeTab} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


