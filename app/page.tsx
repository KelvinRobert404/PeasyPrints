'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { BadgeCheck, Bird, ChevronRight, CupSoda, Lock, Popcorn, Salad, Sandwich } from 'lucide-react';
import { AnnouncementCarousel } from '@/components/AnnouncementCarousel';
import { useCampusSession } from '@/hooks/useCampusSession';

const CANTEEN_ICONS = [Sandwich, Salad, CupSoda, Popcorn];

export default function HomePage() {
  const { session, loading } = useCampusSession();

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F5F7] relative overflow-x-hidden pt-3 pb-28">

      <div className="relative z-10 px-3 max-w-lg mx-auto w-full flex flex-col">

        {/* Hero banner */}
        <div className="mb-2.5 animate-fade-up">
          <AnnouncementCarousel
            heightClass="h-60"
            outerClassName="px-0"
            backgroundClass="bg-ink rounded-[20px] relative overflow-hidden"
          />
        </div>

        {!loading && session.signedIn && !session.verifiedStudent && (
          <Link href="/campus/verify" className="campus-press mb-2.5 flex items-center gap-2.5 rounded-[20px] border border-black/10 bg-white p-3 shadow-sm">
            <BadgeCheck size={18} strokeWidth={2} className="shrink-0 text-black" />
            <span className="min-w-0 flex-1">
              <span className="block font-poster text-black text-[17px] tracking-[0.01em] leading-none pt-0.5">UNLOCK CAMPUS PRODUCTS</span>
              <span className="mt-1 block truncate text-[11px] font-semibold text-zinc-500">Verify your KJU student account.</span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-zinc-300" />
          </Link>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-2 gap-2.5 animate-fade-up stagger-1">
          {/* Left stack */}
          <div className="flex flex-col gap-2.5">
            <Link href="/upload" className="campus-press flex min-h-[148px] flex-col justify-between rounded-[20px] bg-gradient-to-b from-[#2E3A52] to-ink p-4 shadow-sm">
              <img src="/images/printer.png" alt="" aria-hidden draggable={false} className="h-12 w-12 object-contain mix-blend-screen" style={{ imageRendering: 'pixelated' }} />
              <span className="font-quinn text-[17px] font-bold text-cream">peasyprints</span>
            </Link>

            <Link href="/marketplace" className="campus-press flex min-h-[148px] flex-col justify-between rounded-[20px] bg-gradient-to-b from-[#4A1F18] to-ink p-4 shadow-sm">
              <Bird size={44} strokeWidth={1.8} className="text-[#FF3B30]" />
              <span className="font-quinn text-[17px] font-bold text-[#FF3B30]">marketplace</span>
            </Link>
          </div>

          {/* Tall canteen tile */}
          <Link href="/marketplace" className="campus-press flex flex-col justify-between rounded-[20px] bg-gradient-to-b from-[#143A24] to-ink p-4 shadow-sm">
            <span className="flex flex-col gap-2">
              {CANTEEN_ICONS.map((Icon, i) => (
                <Icon key={i} size={30} strokeWidth={1.8} className="text-[#3EDA46]" />
              ))}
            </span>
            <span className="font-quinn text-[17px] font-bold text-[#3EDA46]">canteen</span>
          </Link>
        </div>

        {!loading && session.girlsSpaceApproved && (
          <Link href="/girls-space" className="campus-press animate-fade-up stagger-2 mt-2.5 flex items-center justify-between gap-3 overflow-hidden rounded-[20px] bg-ink p-3.5 text-white shadow-sm">
            <span className="flex items-center gap-2.5">
              <Lock size={16} strokeWidth={2} className="shrink-0 text-cream" />
              <span>
                <span className="block font-poster text-cream text-[19px] tracking-[0.01em] leading-none pt-0.5">GIRLS’ SPACE</span>
                <span className="mt-1 block text-[11px] font-semibold text-white/60">A protected marketplace and housing hub.</span>
              </span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-white/40" />
          </Link>
        )}

        {/* Bottom pills */}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 animate-fade-up stagger-2">
          <Link href="/contact" className="campus-press rounded-full bg-ink py-3.5 text-center font-quinn text-[15px] font-bold text-white shadow-sm">
            contact us
          </Link>
          <Link href="/about" className="campus-press rounded-full bg-ink py-3.5 text-center font-quinn text-[15px] font-bold text-white shadow-sm">
            about us
          </Link>
        </div>

      </div>
    </div>
  );
}
