"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import type { Listing, ListingCategory } from '@/types/models';
import { Badge } from '@/components/ui/badge';
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

  const mainMetaLine = useMemo(() => {
    const created = listing.createdAt?.toDate ? listing.createdAt.toDate() : null;
    let timeAgo = '';
    if (created) {
      const diffMs = Date.now() - created.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      try {
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        timeAgo = rtf.format(-diffHours, 'hour');
      } catch {
        timeAgo = created.toLocaleDateString();
      }
    }
    if (!timeAgo) return locationLabel;
    return `${locationLabel} • ${timeAgo}`;
  }, [locationLabel, listing.createdAt]);

  const priceLabel = useMemo(() => {
    if (listing.price == null) return '';
    if (category === 'housing') return `₹${listing.price.toLocaleString('en-IN')} / mo`;
    if (category === 'tickets') return `₹${listing.price.toLocaleString('en-IN')} ea`;
    return `₹${listing.price.toLocaleString('en-IN')}`;
  }, [listing.price, category]);

  const tags = listing.tags.slice(0, 2); // Reduced to 2 to fit dense layout

  return (
    <Link href={`/marketplace/${listing.id}`} className="block group">
      <article
        className="flex h-36 w-full overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-200 ease-out group-hover:shadow-md group-active:scale-[0.99]"
      >
        {/* Image Section - 45% width to give slightly more text room, but optically feels like 50% */}
        <div className="relative w-[45%] shrink-0 overflow-hidden bg-gray-100">
          {listing.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-50">
              <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content Section - 55% */}
        <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
          <div className="flex flex-col gap-1">
            {/* Header Row */}
            <div className="flex justify-between items-start gap-2">
              <h3 className="text-sm font-semibold leading-tight text-gray-900 line-clamp-2 group-hover:text-[#FF4D4D] transition-colors">
                {listing.title}
              </h3>
              {priceLabel && (
                <div className="shrink-0 text-sm font-bold text-[#FF4D4D]">
                  {priceLabel.replace(' / mo', '/mo').replace(' ea', '')}
                </div>
              )}
            </div>

            {/* Sub-header / Meta */}
            <div className="flex items-center gap-2">
              {listing.description && (
                <p className="text-[10px] text-gray-500 line-clamp-1 leading-relaxed flex-1">
                  {listing.description}
                </p>
              )}
              {listing.whatsappAllowed && (
                <div className="shrink-0 text-emerald-500" title="WhatsApp enabled">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z" fillOpacity=".9" /></svg>
                </div>
              )}
            </div>

            <div className="text-[10px] text-gray-400 line-clamp-1 font-medium mt-0.5">
              {mainMetaLine}
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="rounded-md border-transparent bg-gray-50 px-1.5 py-0 text-[9px] font-normal text-gray-500"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Footer / Author */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-50">
              <div
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #FF4D4D 0%, #FF8585 100%)' }}
              >
                {listing.authorName?.[0] ?? 'S'}
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate text-[10px] font-medium text-gray-700">
                  {listing.authorName?.split(' ')[0] || 'Student'}
                </span>
                {listing.authorVerified && (
                  <svg className="h-2.5 w-2.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}


