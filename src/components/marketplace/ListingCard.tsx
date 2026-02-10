"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import type { Listing, ListingCategory } from '@/types/models';
import { formatLocationForCard } from '@/lib/utils/location';

interface ListingCardProps {
  listing: Listing;
  category: ListingCategory;
}

export function ListingCard({ listing, category }: ListingCardProps) {
  const locationLabel = useMemo(
    () => formatLocationForCard(listing.location),
    [listing.location]
  );

  const timeAgo = useMemo(() => {
    const created = listing.createdAt?.toDate ? listing.createdAt.toDate() : null;
    if (!created) return '';
    const diffMs = Date.now() - created.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    try {
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      return rtf.format(-diffHours, 'hour');
    } catch {
      return created.toLocaleDateString();
    }
  }, [listing.createdAt]);

  const priceLabel = useMemo(() => {
    if (listing.price == null) return '';
    if (category === 'housing') return `₹${listing.price.toLocaleString('en-IN')}/mo`;
    if (category === 'tickets') return `₹${listing.price.toLocaleString('en-IN')}`;
    return `₹${listing.price.toLocaleString('en-IN')}`;
  }, [listing.price, category]);

  const metaLine = [locationLabel, timeAgo].filter(Boolean).join(' · ');

  return (
    <Link href={`/marketplace/${listing.id}`} className="block group">
      <article
        className="overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 group-hover:shadow-md group-active:scale-[0.98]"
      >
        {/* Image — square aspect ratio */}
        <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
          {listing.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="material-symbols-rounded text-3xl text-gray-300">
                image
              </span>
            </div>
          )}

          {/* Price badge overlay */}
          {priceLabel && (
            <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-marketplace-accent text-white text-[12px] font-bold shadow-sm">
              {priceLabel}
            </div>
          )}

          {/* WhatsApp indicator */}
          {listing.whatsappAllowed && (
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
              <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z" fillOpacity=".9" /></svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          {/* Title */}
          <h3 className="text-[13px] font-semibold leading-tight text-text-primary line-clamp-2 group-hover:text-primary transition-colors">
            {listing.title}
          </h3>

          {/* Meta */}
          {metaLine && (
            <p className="text-[11px] text-text-muted mt-1 line-clamp-1">
              {metaLine}
            </p>
          )}

          {/* Author */}
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}
            >
              {listing.authorName?.[0] ?? 'S'}
            </div>
            <span className="truncate text-[11px] font-medium text-text-secondary">
              {listing.authorName?.split(' ')[0] || 'Student'}
            </span>
            {listing.authorVerified && (
              <svg className="h-3 w-3 text-success flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
