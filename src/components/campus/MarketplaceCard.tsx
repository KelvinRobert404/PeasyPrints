'use client';

import Link from 'next/link';
import { Bookmark, Package } from 'lucide-react';
import type { MarketplaceListing } from '@/types/campus';
import { MARKETPLACE_CATEGORY_LABELS } from '@/lib/campus/constants';

export function MarketplaceCard({ item, href, onSave }: { item: MarketplaceListing; href: string; onSave?: (item: MarketplaceListing) => void }) {
  const price = item.postType === 'free' ? 'Free' : item.postType === 'wanted' && item.price == null ? 'Name your price' : item.price == null ? 'Ask' : `₹${item.price.toLocaleString('en-IN')}`;
  return (
    <article className="group relative overflow-hidden rounded-[20px] bg-white shadow-[0_8px_30px_rgba(20,20,20,0.05)]">
      <Link href={href} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-[#eceef1]">
          {item.images[0] ? <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-[0.985]" /> : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-300"><Package size={32} /><span className="text-[10px] font-bold uppercase tracking-widest">Student post</span></div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white backdrop-blur">{item.postType}</span>
          <span className="absolute bottom-2 left-2 rounded-lg bg-cream px-2 py-1 font-poster text-[14px] tracking-[0.01em] text-ink shadow-sm">{price}</span>
        </div>
        <div className="p-3">
          <h2 className="line-clamp-2 min-h-[2.4em] font-quinn text-[15px] font-bold leading-[1.2] text-ink">{item.title}</h2>
          <p className="mt-1.5 truncate text-[11px] font-bold text-zinc-500">{MARKETPLACE_CATEGORY_LABELS[item.category]} · {item.pickupLabel || item.area || item.collegeCode}</p>
          <div className="mt-2 flex items-center justify-between border-t border-black/[0.05] pt-2">
            <span className="font-mono text-[10px] font-bold text-zinc-400">{item.serial}</span>
            <span className="text-[10px] font-extrabold text-zinc-500">{item.collegeCode}</span>
          </div>
        </div>
      </Link>
      {onSave ? (
        <button type="button" aria-label={item.isSaved ? 'Remove saved item' : 'Save item'} onClick={() => onSave(item)} className="campus-press absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur">
          <Bookmark size={17} className="text-ink" fill={item.isSaved ? 'currentColor' : 'none'} />
        </button>
      ) : null}
    </article>
  );
}
