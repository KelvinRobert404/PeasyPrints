'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';

export default function IndexPage() {
  return (
    <div className="min-h-screen flex flex-col pb-6">
      {/* Hero banner */}
      <div className="px-[5px] mt-4">
        <div className="h-48 w-full rounded-2xl bg-neutral-800" />
      </div>

      {/* Tiles grid */}
      <div className="px-[5px] mt-4 grid grid-cols-2 gap-[5px] auto-rows-[176px]">
        {/* peasyprints */}
        <Link
          href="/upload"
          className="rounded-2xl bg-neutral-800 h-full flex flex-col items-center justify-center gap-3 pb-6 active:scale-[0.99] transition relative"
        >
          <img src="/images/printer.png" alt="PeasyPrints" width={55} height={55} />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[22px] tracking-wide font-semibold font-quinn" style={{ color: 'var(--peasyprints)' }}>peasyprints</span>
        </Link>

        {/* canteen - tall column */}
        <Link
          href="/shopfront"
          className="row-span-2 rounded-2xl bg-neutral-800 h-full flex flex-col items-center justify-center gap-8 active:scale-[0.99] transition relative"
        >
          <span className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center h-5 px-2 rounded-full border border-white/40 text-white text-[10px] uppercase tracking-wide opacity-90">COMING SOON</span>
          <img className="tint-green" src="/images/icons8-hamburger-100.png" alt="Burger" width={45} height={45} />
          <img className="tint-green" src="/images/icons8-rice-bowl-100.png" alt="Bowl" width={45} height={45} />
          <img className="tint-green" src="/images/icons8-kawaii-soda-100.png" alt="Drink" width={45} height={45} />
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[24px] tracking-wide font-semibold font-quinn" style={{ color: 'var(--canteen)' }}>canteen</span>
        </Link>

        {/* marketplace */}
        <Link
          href="/shops"
          className="rounded-2xl bg-neutral-800 h-full flex flex-col items-center justify-center gap-3 active:scale-[0.99] transition relative"
        >
          <span className="absolute top-3 left-1/2 -translate-x-1/2 inline-flex items-center h-5 px-2 rounded-full border border-white/40 text-white text-[10px] uppercase tracking-wide opacity-90">COMING SOON</span>
          <img className="tint-rose" src="/images/origami.png" alt="Marketplace" width={55} height={55} />
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[22px] tracking-wide font-semibold font-quinn" style={{ color: 'var(--marketplace)' }}>marketplace</span>
        </Link>
      </div>

      {/* footer ctas */}
      <div className="px-[5px] mt-4 grid grid-cols-2 gap-[5px]">
        <Link
          href="/contact"
          className="rounded-2xl bg-neutral-800 h-12 text-white text-sm flex items-center justify-center active:scale-[0.99] transition"
        >
          contact us
        </Link>
        <Link
          href="/profile"
          className="rounded-2xl bg-neutral-800 h-12 text-white text-sm flex items-center justify-center active:scale-[0.99] transition"
        >
          about us
        </Link>
      </div>
    </div>
  );
}

