'use client';

import { UserButton } from '@clerk/nextjs';
import { Check, ChevronDown, Inbox, MapPin } from 'lucide-react';
import { useCampusSession } from '@/hooks/useCampusSession';
import { useState, useEffect, useRef } from 'react';
import { useCollegeStore, useCollegeNames } from '@/lib/stores/collegeStore';
import Link from 'next/link';

export function SwoopNavbar() {
  const { session } = useCampusSession();
  const unread = session.verifiedStudent ? session.unreadContactRequests : 0;
  return (
    <div className="w-full px-3 pt-3">
      <header className="relative z-40 w-full rounded-[20px] bg-royal">
        <div className="relative w-full px-4 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="shrink-0 font-quinn text-[20px] font-bold tracking-[0.08em] text-white active:opacity-70 transition-opacity" aria-label="Swoop home">
            SWOOP
          </Link>

          {/* Location — centered */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <CollegeSelector />
          </div>

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/campus/activity"
              aria-label="Notifications"
              className="campus-press relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15"
            >
              <Inbox size={16} strokeWidth={2.2} className="text-white" />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-cream px-1 text-center text-[9px] font-extrabold tabular-nums text-ink">{unread}</span>}
            </Link>

            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  userButtonRoot: 'w-8 h-8',
                  userButtonBox: 'w-8 h-8 flex items-center justify-center',
                  userButtonTrigger: 'w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:opacity-80 transition-opacity duration-150',
                  userButtonAvatarBox: 'w-6 h-6 rounded-full',
                  userButtonAvatarImage: 'w-6 h-6 rounded-full object-cover'
                }
              }}
            />
          </div>
        </div>
      </header>
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

  // Get short college name (strict abbreviation)
  const shortName = selectedCollege.length > 26
    ? selectedCollege.slice(0, 24) + '...'
    : selectedCollege;

  return (
    <div className="relative min-w-0" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="campus-press flex min-w-0 max-w-[170px] items-center gap-1 rounded-full bg-white py-1 pl-2 pr-1.5"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <MapPin size={12} strokeWidth={2.5} className="shrink-0 text-royal" />
        <span className="block truncate text-[10px] font-extrabold text-ink leading-none">{shortName}</span>
        <ChevronDown size={12} strokeWidth={2.5} className={`shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="animate-drop-in absolute left-1/2 top-full z-50 mt-2 w-44 -translate-x-1/2 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_16px_48px_rgb(0,0,0,0.14)]">
          <div className="px-3.5 py-1.5 border-b border-black/[0.06] bg-[#F4F5F7]">
            <p className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-[0.14em]">Choose campus</p>
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {collegeNames.length === 0 ? (
              <li className="px-3.5 py-2 text-[11px] font-semibold text-zinc-400">No campuses found</li>
            ) : null}
            {collegeNames.map((c) => (
              <li key={c}>
                <button
                  className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-[10px] font-extrabold transition-colors ${c === selectedCollege
                    ? 'text-royal bg-royal/[0.06]'
                    : 'text-zinc-900 hover:bg-zinc-50'
                    }`}
                  onClick={() => {
                    setSelectedCollege(c);
                    setOpen(false);
                  }}
                >
                  <MapPin size={13} strokeWidth={2.5} className={`shrink-0 ${c === selectedCollege ? 'text-royal' : 'text-zinc-300'}`} />
                  <span className="min-w-0 flex-1 truncate leading-none">{c}</span>
                  {c === selectedCollege && <Check size={13} strokeWidth={3} className="shrink-0 text-royal" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
