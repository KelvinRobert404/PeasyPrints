'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function CampusHeader({ title, eyebrow, accent = '#FCF6B1', actions, dark = false }: { title: string; eyebrow: string; accent?: string; actions?: ReactNode; dark?: boolean }) {
  return (
    <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${dark ? 'border-white/10 bg-royal/90' : 'border-black/[0.04] bg-[#f4f5f7]/90'}`}>
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <Link href="/" aria-label="Back home" className={`campus-press flex h-10 w-10 items-center justify-center rounded-full shadow-sm ${dark ? 'bg-white/15' : 'bg-white'}`}>
          <ArrowLeft size={21} className={dark ? 'text-white' : 'text-black'} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: accent }}>{eyebrow}</p>
          <h1 className={`truncate font-quinn text-[20px] font-bold tracking-tight ${dark ? 'text-white' : 'text-black'}`}>{title}</h1>
        </div>
        {actions}
      </div>
    </header>
  );
}
