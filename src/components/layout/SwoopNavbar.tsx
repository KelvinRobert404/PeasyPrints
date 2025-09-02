"use client";

import { UserButton } from '@clerk/nextjs';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { useCollegeStore, COLLEGES } from '@/lib/stores/collegeStore';
import Link from 'next/link';

export function SwoopNavbar() {
  return (
    <div className="px-[5px] pt-[5px]">
      <div className="rounded-2xl bg-blue-600 text-white px-4 py-3 grid grid-cols-3 items-center">
        <Link href="/" className="justify-self-start font-quinn text-[30px] tracking-[0.02em]">SWOOP</Link>
        <div className="justify-self-center">
          <CollegeSelector />
        </div>
        <div className="justify-self-end flex items-center justify-end gap-2">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonRoot: 'w-9 h-9 min-w-[2.25rem] min-h-[2.25rem]',
                userButtonBox: 'w-9 h-9 min-w-[2.25rem] min-h-[2.25rem]',
                userButtonTrigger: 'w-9 h-9 min-w-[2.25rem] min-h-[2.25rem]',
                userButtonAvatarBox: 'w-9 h-9 min-w-[2.25rem] min-h-[2.25rem]',
                userButtonAvatarImage: 'w-9 h-9 rounded-full object-cover'
              }
            }}
          />
        </div>
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
        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] text-black"
      >
        <MapPin className="w-[10px] h-[10px]" />
        <span className="truncate max-w-[100px]">{selectedCollege}</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-64 rounded-lg border bg-white">
          <ul className="max-h-64 overflow-auto py-1 text-[5px]">
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


