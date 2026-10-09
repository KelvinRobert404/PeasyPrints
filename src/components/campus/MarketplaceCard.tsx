'use client';

import Link from 'next/link';
import { BookmarkIcon, MarketIcon } from '@/components/swoop/icons';
import { Tag } from '@/components/swoop/primitives';
import { TapeStrip } from '@/components/swoop/Logo';
import { cn } from '@/lib/utils/cn';
import type { MarketplaceListing } from '@/types/campus';
import { MARKETPLACE_CATEGORY_LABELS } from '@/lib/campus/constants';

const CHIP_SHADOW = 'shadow-[0_1px_3px_rgba(16,24,40,0.12)]';

/**
 * Listing tile. Default: 3-up grid card (112px photo, post-type tag, price chip, save button).
 * `compact`: 104px card for horizontal rows (80px photo, college · category meta, no tag).
 */
export function MarketplaceCard({
  item,
  href,
  onSave,
  compact = false
}: {
  item: MarketplaceListing;
  href: string;
  onSave?: (item: MarketplaceListing) => void;
  compact?: boolean;
}) {
  const price = item.postType === 'free' ? 'Free' : item.postType === 'wanted' && item.price == null ? 'Name your price' : item.price == null ? 'Ask' : `₹${item.price.toLocaleString('en-IN')}`;
  const textPrice = item.postType !== 'free' && item.price == null;
  const sold = item.status === 'sold' || item.status === 'closed';
  const category = MARKETPLACE_CATEGORY_LABELS[item.category];
  const meta = compact ? `${item.collegeCode} · ${category}` : `${category} · ${item.pickupLabel || item.area || item.collegeCode}`;

  return (
    <article className={cn('relative', compact && 'w-[104px] shrink-0')}>
      <Link href={href} className="campus-press flex flex-col gap-[3px] text-ink">
        <span className={cn('relative grid place-items-center overflow-hidden rounded-[12px] bg-surface', compact ? 'h-20' : 'h-[112px]')}>
          {item.images[0] ? (
            <img src={item.images[0]} alt={item.title} className={cn('absolute inset-0 h-full w-full object-cover', sold && 'opacity-50')} />
          ) : (
            <MarketIcon size={compact ? 24 : 28} className={cn('text-text-muted', sold && 'opacity-50')} />
          )}
          {sold ? (
            <TapeStrip
              word="sold"
              className={cn('absolute -left-3.5 -right-3.5 text-[11px]', compact ? 'top-[30px]' : 'top-[44px]')}
              style={{ transform: 'rotate(-14deg)' }}
            />
          ) : null}
          {!compact ? <Tag className="absolute left-[5px] top-[5px]">{item.postType}</Tag> : null}
          {textPrice ? (
            <span className="absolute bottom-[5px] left-[5px] rounded-[6px] bg-ink px-1.5 py-[3px] text-[10px] font-bold leading-none text-white">{price}</span>
          ) : (
            <span
              className={cn(
                'font-heading absolute bottom-[5px] left-[5px] rounded-[6px] bg-white px-1.5 py-0.5 leading-[1.15] tabular-nums',
                compact ? 'text-[11.5px]' : 'text-[12px]',
                sold ? 'text-slate line-through' : 'text-ink',
                CHIP_SHADOW
              )}
            >
              {price}
            </span>
          )}
        </span>
        <span className="font-heading line-clamp-2 text-[11.5px] leading-[1.15]">
          {sold ? <span className="sr-only">Sold: </span> : null}
          {item.title}
        </span>
        <span className="truncate text-[10px] font-semibold text-slate">{meta}</span>
      </Link>
      {onSave ? (
        <button
          type="button"
          aria-label={item.isSaved ? 'Remove saved item' : 'Save item'}
          onClick={() => onSave(item)}
          className={cn('campus-press absolute right-[5px] top-[5px] grid h-6 w-6 place-items-center rounded-full bg-white', CHIP_SHADOW, item.isSaved ? 'text-royal' : 'text-ink')}
        >
          <BookmarkIcon size={12} filled={item.isSaved} />
        </button>
      ) : null}
    </article>
  );
}
