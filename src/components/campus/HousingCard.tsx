'use client';

import Link from 'next/link';
import { BookmarkIcon, HousingIcon } from '@/components/swoop/icons';
import { StatusLine, Tag } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';
import type { HousingPost } from '@/types/campus';

const CHIP_SHADOW = 'shadow-[0_1px_3px_rgba(16,24,40,0.12)]';

export const HOUSING_TYPE_LABELS: Record<HousingPost['postType'], string> = {
  room: 'Room',
  roommate: 'Roommate',
  replacement: 'Replacement',
  sublet: 'Sublet'
};

function availability(item: HousingPost) {
  if (item.status === 'filled' || item.status === 'closed') return { open: false, label: 'Filled' };
  if (!item.availableFrom) return null;
  const from = new Date(item.availableFrom);
  if (Number.isNaN(from.getTime())) return null;
  if (from.getTime() <= Date.now()) return { open: true, label: 'Available now' };
  return { open: true, label: `From ${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` };
}

/** Housing tile for the 2-up grid: 120px photo, type tag, rent chip, save button, area · type · commute meta. */
export function HousingCard({ item, href, onSave }: { item: HousingPost; href: string; onSave?: (item: HousingPost) => void }) {
  const status = availability(item);
  const meta = [item.area, HOUSING_TYPE_LABELS[item.postType], item.commuteLabel].filter(Boolean).join(' · ');

  return (
    <article className="relative min-w-0">
      <Link href={href} className="campus-press flex flex-col gap-[3px] text-ink">
        <span className="relative grid h-[120px] place-items-center overflow-hidden rounded-[12px] bg-surface">
          {item.images[0] ? (
            <img src={item.images[0]} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <HousingIcon size={28} className="text-text-muted" />
          )}
          <Tag className="absolute left-[5px] top-[5px]">{HOUSING_TYPE_LABELS[item.postType]}</Tag>
          {item.rent == null ? (
            <span className="absolute bottom-[5px] left-[5px] rounded-[6px] bg-ink px-1.5 py-[3px] text-[10px] font-bold leading-none text-white">Budget flexible</span>
          ) : (
            <span className={cn('font-heading absolute bottom-[5px] left-[5px] rounded-[6px] bg-white px-1.5 py-0.5 text-[12px] leading-[1.15] text-ink tabular-nums', CHIP_SHADOW)}>
              ₹{item.rent.toLocaleString('en-IN')}
              <span className="font-sans text-[9.5px] font-semibold text-slate">/mo</span>
            </span>
          )}
        </span>
        <span className="font-heading line-clamp-2 text-[12px] leading-[1.15]">{item.title}</span>
        <span className="truncate text-[10.5px] font-semibold text-slate">{meta}</span>
        {status ? <StatusLine open={status.open} label={status.label} /> : null}
      </Link>
      {onSave ? (
        <button
          type="button"
          aria-label={item.isSaved ? 'Remove saved housing post' : 'Save housing post'}
          aria-pressed={Boolean(item.isSaved)}
          onClick={() => onSave(item)}
          className={cn('campus-press absolute right-[5px] top-[5px] grid h-6 w-6 place-items-center rounded-full bg-white', CHIP_SHADOW, item.isSaved ? 'text-royal' : 'text-ink')}
        >
          <BookmarkIcon size={12} filled={item.isSaved} />
        </button>
      ) : null}
    </article>
  );
}
