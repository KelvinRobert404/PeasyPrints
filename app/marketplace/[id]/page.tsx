"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Listing } from '@/types/models';
import { formatLocationForCard } from '@/lib/utils/location';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
    if (listing.category === 'housing') return `₹${listing.price} / month`;
    if (listing.category === 'tickets') return `₹${listing.price} per ticket`;
    return `₹${listing.price}`;
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
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-900">
        <p className="text-sm text-gray-500">Loading listing…</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-900 gap-3">
        <p className="text-sm text-red-600">{error || 'Listing not found'}</p>
        <Button variant="secondary" onClick={() => router.push('/marketplace')}>
          Back to marketplace
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 pb-4">
      <header className="px-[5px] pt-3 pb-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[11px] text-gray-500 underline underline-offset-2"
        >
          Back
        </button>
        <h1 className="mt-1 text-xl font-semibold font-quinn tracking-wide line-clamp-2">
          {listing.title}
        </h1>
        {priceLabel && (
          <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--marketplace)' }}>
            {priceLabel}
          </p>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-[5px] space-y-3 mt-2">
        {/* Images */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {listing.images?.[0] ? (
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-full h-64 object-cover"
              />
            ) : (
              <div className="w-full h-40 flex items-center justify-center text-sm text-gray-500">
                No image provided
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meta + description */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-[11px] text-gray-500">{locationLabel}</p>
            {postedOn && (
              <p className="text-[11px] text-gray-400">
                Posted on {postedOn}
              </p>
            )}
            {listing.description && (
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                {listing.description}
              </p>
            )}
            {listing.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {listing.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-full text-[11px] bg-gray-100 text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seller + contact */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs uppercase">
                  {listing.authorName?.[0] ?? 'S'}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-gray-900">
                    {listing.authorName || 'KJ Student'}
                    {listing.authorVerified && ' • Verified'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Kristu Jayanti College
                  </span>
                </div>
              </div>
            </div>

            {listing.whatsappAllowed && listing.whatsappNumber && (
              <Button
                type="button"
                variant="success"
                size="lg"
                className="w-full"
                onClick={handleWhatsApp}
              >
                Chat with seller on WhatsApp
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


