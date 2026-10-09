"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { ImageIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { ChatIcon } from '@/components/marketplace/icons';
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
    <Link href={`/marketplace/${listing.id}`} className="campus-press flex flex-col gap-[3px] text-ink">
      <span className="relative grid h-[112px] place-items-center overflow-hidden rounded-[12px] bg-surface">
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <ImageIcon size={28} className="text-text-muted" />
        )}

        {priceLabel && (
          <span className="font-heading absolute bottom-[5px] left-[5px] rounded-[6px] bg-white px-1.5 py-0.5 text-[12px] leading-[1.15] text-ink tabular-nums shadow-[0_1px_3px_rgba(16,24,40,0.12)]">
            {priceLabel}
          </span>
        )}

        {listing.whatsappAllowed && (
          <span className="absolute right-[5px] top-[5px] grid h-6 w-6 place-items-center rounded-full bg-white text-go-text shadow-[0_1px_3px_rgba(16,24,40,0.12)]">
            <ChatIcon size={12} />
            <span className="sr-only">WhatsApp allowed</span>
          </span>
        )}
      </span>

      <span className="font-heading line-clamp-2 text-[11.5px] leading-[1.15]">{listing.title}</span>
      {metaLine && <span className="truncate text-[10px] font-semibold text-slate">{metaLine}</span>}

      <span className="flex items-center gap-1">
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink text-[8.5px] font-extrabold text-white" aria-hidden="true">
          {listing.authorName?.[0] ?? 'S'}
        </span>
        <span className="truncate text-[10px] font-semibold text-text-secondary">{listing.authorName?.split(' ')[0] || 'Student'}</span>
        {listing.authorVerified && (
          <>
            <ShieldCheckIcon size={11} className="shrink-0 text-royal" />
            <span className="sr-only">Verified</span>
          </>
        )}
      </span>
    </Link>
  );
}
