'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { useState } from 'react';
import { useCollegeStore, COLLEGES } from '@/lib/stores/collegeStore';

export default function IndexPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Location pill */}
      <div className="px-4 pt-6 flex items-center justify-between">
        <CollegeSelector />
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              userButtonAvatarBox: 'w-20 h-20',
            },
          }}
        />
      </div>

      {/* Hero card placeholder */}
      <div className="px-4 mt-4">
        <div className="h-44 w-full rounded-2xl bg-gray-200" />
      </div>

      {/* Tiles grid */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-4">
        {/* PeasyPrints entry */}
        <Link href="/upload" className="rounded-2xl bg-gray-100 h-40 flex items-end p-4">
          <span className="text-[11px] tracking-wide font-semibold text-gray-800">PEASYPRINTS</span>
        </Link>

        {/* Right tall tile placeholder */}
        <div className="row-span-2 rounded-2xl bg-gray-100 h-[328px] flex items-end p-4">
          <span className="text-[11px] tracking-wide font-semibold text-gray-400">CANTEEN</span>
        </div>

        {/* Bottom-left tile */}
        <div className="rounded-2xl bg-gray-100 h-40 flex items-end p-4">
          <span className="text-[11px] tracking-wide font-semibold text-gray-800">MARKETPLACE</span>
        </div>
      </div>

      {/* Bottom CTA button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[428px] px-4">
        <Link
          href="/upload"
          className="block text-center bg-blue-600 text-white font-extrabold text-[30px] rounded-xl py-2 font-quinn"
          style={{ letterSpacing: 'var(--swoop-letter-spacing, 0em)' }}
        >
          SWOOP
        </Link>
      </div>
    </div>
  );
}

function CollegeSelector() {
  const { selectedCollege, setSelectedCollege } = useCollegeStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-black" />
        <span className="truncate max-w-[200px]">{selectedCollege}</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-64 rounded-lg border bg-white shadow">
          <ul className="max-h-64 overflow-auto py-1 text-sm">
            {COLLEGES.map((c) => (
              <li key={c}>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  onClick={() => {
                    setSelectedCollege(c);
                    setOpen(false);
                  }}
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
