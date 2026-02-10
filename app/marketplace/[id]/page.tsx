"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Listing } from '@/types/models';
import { formatLocationForCard } from '@/lib/utils/location';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded ${className}`}>{name}</span>;
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    const ref = doc(db, 'listings', params.id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError('Listing not found');
          setListing(null);
          setLoading(false);
          return;
        }
        const data = snap.data() as Omit<Listing, 'id'>;
        setListing({ id: snap.id, ...data });
        setLoading(false);
      },
      () => {
        setError('Failed to load listing');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [params?.id]);

  const locationLabel = useMemo(() => {
    if (!listing) return '';
    return formatLocationForCard(listing.location);
  }, [listing]);

  const priceLabel = useMemo(() => {
    if (!listing || listing.price == null) return '';
    if (listing.category === 'housing') return `₹${listing.price.toLocaleString('en-IN')} / month`;
    if (listing.category === 'tickets') return `₹${listing.price.toLocaleString('en-IN')} per ticket`;
    return `₹${listing.price.toLocaleString('en-IN')}`;
  }, [listing]);

  const postedOn = useMemo(() => {
    if (!listing?.createdAt?.toDate) return '';
    const d = listing.createdAt.toDate();
    return d.toLocaleString();
  }, [listing]);

  const handleWhatsApp = () => {
    if (!listing?.whatsappAllowed || !listing.whatsappNumber) return;
    const digits = listing.whatsappNumber.replace(/[^\d]/g, '');
    if (!digits) return;
    const text = encodeURIComponent(
      `Hi, I'm interested in your listing "${listing.title}" on the PeasyPrints marketplace.`
    );
    const url = `https://wa.me/${digits}?text=${text}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        {/* Skeleton header */}
        <div className="px-4 pt-4 pb-3">
          <div className="skeleton h-5 w-12 mb-3" />
          <div className="skeleton h-7 w-3/4 mb-2" />
          <div className="skeleton h-6 w-24" />
        </div>
        <div className="px-4">
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
        <div className="px-4 pt-4 space-y-3">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface gap-4 animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Icon name="error" className="text-3xl text-red-400" />
        </div>
        <p className="text-[14px] text-red-600 font-medium">{error || 'Listing not found'}</p>
        <button
          onClick={() => router.push('/marketplace')}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-[13px] font-medium rounded-xl hover:bg-primary-dark active:scale-[0.98] transition-all"
        >
          <Icon name="arrow_back" className="text-lg" />
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface pb-6 animate-fade-up">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <Icon name="arrow_back" className="text-xl text-text-primary" />
          </button>
          <h1 className="text-[15px] font-semibold text-text-primary truncate flex-1">
            {listing.title}
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto space-y-4 mt-1">
        {/* Image */}
        <div className="px-4">
          <div className="overflow-hidden rounded-2xl bg-gray-50">
            {listing.images?.[0] ? (
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-full h-64 object-cover"
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center">
                <Icon name="image" className="text-4xl text-gray-300" />
              </div>
            )}
          </div>
        </div>

        {/* Title + Price */}
        <div className="px-4">
          <h2 className="text-xl font-bold text-text-primary leading-tight">
            {listing.title}
          </h2>
          {priceLabel && (
            <p className="mt-1.5 text-xl font-bold text-marketplace-accent">
              {priceLabel}
            </p>
          )}
        </div>

        {/* Meta + Description */}
        <div className="px-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-4 text-[12px] text-text-secondary">
              {locationLabel && (
                <span className="flex items-center gap-1">
                  <Icon name="location_on" className="text-sm text-text-muted" />
                  {locationLabel}
                </span>
              )}
              {postedOn && (
                <span className="flex items-center gap-1">
                  <Icon name="schedule" className="text-sm text-text-muted" />
                  {postedOn}
                </span>
              )}
            </div>

            {listing.description && (
              <p className="text-[14px] text-text-primary leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            )}

            {listing.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {listing.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-50 text-text-secondary border border-gray-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Seller */}
        <div className="px-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">Seller</p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}
              >
                {listing.authorName?.[0] ?? 'S'}
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-medium text-text-primary flex items-center gap-1.5">
                  {listing.authorName || 'Student'}
                  {listing.authorVerified && (
                    <svg className="h-3.5 w-3.5 text-success" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <span className="text-[12px] text-text-secondary">
                  Kristu Jayanti College
                </span>
              </div>
            </div>

            {listing.whatsappAllowed && listing.whatsappNumber && (
              <button
                type="button"
                onClick={handleWhatsApp}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-success text-white text-[14px] font-medium rounded-xl hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-sm"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z" /></svg>
                Chat on WhatsApp
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
