'use client';

import Link from 'next/link';
import { Bookmark, House, Route } from 'lucide-react';
import type { HousingPost } from '@/types/campus';

export function HousingCard({ item, href, onSave }: { item: HousingPost; href: string; onSave?: (item: HousingPost) => void }) {
  return (
    <article className="relative overflow-hidden rounded-[26px] bg-white p-3 shadow-[0_8px_30px_rgba(16,24,40,0.055)]">
      <Link href={href} className="grid grid-cols-[112px_1fr] gap-3">
        <div className="relative h-[142px] overflow-hidden rounded-[19px] bg-[#e8f0ed]">
          {item.images[0] ? <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><House size={36} className="text-[#2e6f57]/45" /></div>}
          <span className="absolute bottom-2 left-2 rounded-lg bg-[#d8ff6a] px-2 py-1 text-[10px] font-black uppercase text-[#183d31]">{item.postType}</span>
        </div>
        <div className="min-w-0 py-1 pr-1">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#2e6f57]"><Route size={14} />{item.commuteLabel || `Near ${item.collegeCode}`}</div>
          <h2 className="mt-2 line-clamp-2 font-quinn text-[18px] font-bold leading-[1.05]">{item.title}</h2>
          <p className="mt-2 text-[16px] font-black text-black">{item.rent == null ? 'Budget flexible' : `₹${item.rent.toLocaleString('en-IN')} / mo`}</p>
          <p className="mt-1 truncate text-[11px] font-bold text-zinc-500">{item.area}{item.furnishing ? ` · ${item.furnishing}` : ''}</p>
          <div className="mt-3 flex items-center justify-between"><span className="font-mono text-[10px] font-bold text-zinc-400">{item.serial}</span><span className="text-[10px] font-extrabold text-zinc-400">{item.collegeCode}</span></div>
        </div>
      </Link>
      {onSave ? <button type="button" aria-label="Save housing post" onClick={() => onSave(item)} className="campus-press absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"><Bookmark size={18} className="text-black" fill={item.isSaved ? 'currentColor' : 'none'} /></button> : null}
    </article>
  );
}
