'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';

export default function IndexPage() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* Hero card placeholder */}
      <div className="px-4 mt-4">
        <div className="h-44 w-full rounded-2xl bg-gray-200" />
      </div>

      {/* Tiles grid */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-4">
        {/* PeasyPrints entry */}
        <Link href="/upload" className="rounded-2xl bg-gray-100 h-40 flex items-end justify-center p-4">
          <span className="text-[11px] tracking-wide font-semibold text-gray-800">PEASYPRINTS</span>
        </Link>

        {/* Right tall tile placeholder */}
        <div className="row-span-2 rounded-2xl bg-gray-100 h-[328px] flex items-end justify-center p-4">
          <span className="text-[11px] tracking-wide font-semibold text-gray-400">CANTEEN</span>
        </div>

        {/* Bottom-left tile */}
        <div className="rounded-2xl bg-gray-100 h-40 flex items-end justify-center p-4">
          <span className="text-[11px] tracking-wide font-semibold text-gray-800">MARKETPLACE</span>
        </div>
      </div>

      {/* Top CTA removed in favor of navbar */}
    </div>
  );
}
 
