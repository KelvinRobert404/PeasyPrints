"use client";

import { UserButton } from '@clerk/nextjs';
import { MapPin, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useCollegeStore, useCollegeNames } from '@/lib/stores/collegeStore';
import Link from 'next/link';

export function SwoopNavbar() {
  return (
    <div className="bg-blue-600 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo - White on Blue */}
        <Link
          href="/"
          className="font-quinn text-2xl font-bold tracking-wide text-white"
        >
          SWOOP
        </Link>

        {/* Right side - College + User */}
        <div className="flex items-center gap-3">
          <CollegeSelector />
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonRoot: 'w-8 h-8',
                userButtonBox: 'w-8 h-8',
                userButtonTrigger: 'w-8 h-8 rounded-xl border-2 border-white/30 hover:border-white/50 transition-colors',
                userButtonAvatarBox: 'w-8 h-8 rounded-xl',
                userButtonAvatarImage: 'w-8 h-8 rounded-xl object-cover'
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CollegeSelector() {
  const { selectedCollege, setSelectedCollege, subscribe } = useCollegeStore();
  const collegeNames = useCollegeNames();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to colleges on mount
  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Get short college name
  const shortName = selectedCollege.length > 20
    ? selectedCollege.slice(0, 18) + '...'
    : selectedCollege;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`
          inline-flex items-center gap-1.5 
          px-3 py-1.5 rounded-xl
          bg-white/20 hover:bg-white/30
          text-xs font-medium text-white
          transition-all duration-200
          ${open ? 'ring-2 ring-white/30 bg-white/30' : ''}
        `}
      >
        <MapPin className="w-3.5 h-3.5 text-white" />
        <span className="max-w-[100px] truncate">{shortName}</span>
        <ChevronDown className={`w-3 h-3 text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2">Select Campus</p>
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {collegeNames.map((c) => (
              <li key={c}>
                <button
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${c === selectedCollege
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  onClick={() => {
                    setSelectedCollege(c);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className={`w-3.5 h-3.5 ${c === selectedCollege ? 'text-blue-600' : 'text-gray-400'}`} />
                    {c}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
