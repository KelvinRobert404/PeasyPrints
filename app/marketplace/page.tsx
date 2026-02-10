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

  // Get counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of TABS) {
      counts[tab.id] = filterListingsByCategory(listings, tab.id).length;
    }
    return counts;
  }, [listings]);

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
    <div className="flex min-h-screen flex-col bg-surface pb-24">
      {/* Header — clean white */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-text-primary active:opacity-70">
                <Icon name="arrow_back" className="text-2xl" />
              </Link>
              <h1 className="text-lg font-bold text-text-primary">Marketplace</h1>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-text-secondary active:bg-gray-300 transition-colors"
              aria-label="Filter"
            >
              <Icon name="tune" className="text-xl" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Icon name="search" className="text-lg text-text-muted" />
            </div>
            <Input
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 pl-10 text-sm text-text-primary placeholder:text-text-muted focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Tabs — underline style */}
        <div className="flex px-4 gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 pb-3 pt-1 text-[13px] font-medium transition-all border-b-2',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon name={tab.icon} className="text-base" />
              {tab.label}
              <span className={cn(
                "text-[11px] rounded-full px-1.5 py-px font-medium",
                activeTab === tab.id
                  ? "text-primary bg-primary/10"
                  : "text-text-muted bg-gray-100"
              )}>
                {categoryCounts[tab.id] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pt-4">
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="skeleton aspect-square w-full" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-600">
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Icon name="storefront" className="text-3xl text-primary" />
            </div>
            <h3 className="text-[15px] font-semibold text-text-primary">No listings yet</h3>
            <p className="mt-1 text-[13px] text-text-secondary max-w-[240px]">
              Be the first to post something in this category!
            </p>
            <Link
              href="/marketplace/new"
              className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-[13px] font-medium rounded-xl hover:bg-primary-dark active:scale-[0.98] transition-all shadow-sm"
            >
              <Icon name="add" className="text-lg" />
              Create Listing
            </Link>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 animate-fade-up">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} category={activeTab} />
            ))}
          </div>
        )}
      </main>

      {/* FAB — Create new listing */}
      {filtered.length > 0 && (
        <Link
          href="/marketplace/new"
          className="fixed bottom-6 right-6 max-w-[428px] z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-dark active:scale-95 transition-all"
          aria-label="Create new listing"
        >
          <Icon name="add" className="text-2xl" />
        </Link>
      )}
    </div>
  );
}
