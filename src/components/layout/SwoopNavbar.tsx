'use client';

import { UserButton } from '@clerk/nextjs';
import { useCampusSession } from '@/hooks/useCampusSession';
import { useState, useEffect, useRef } from 'react';
import { useCollegeStore, useCollegeNames } from '@/lib/stores/collegeStore';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { SwoopLogo } from '@/components/swoop/Logo';
import { IconButton } from '@/components/swoop/primitives';
import { CaretDownIcon, CheckIcon, InboxIcon, PinIcon } from '@/components/swoop/icons';

/** App header: tape logo · campus chip · inbox · account. White, minimal. */
export function SwoopNavbar() {
  const { session } = useCampusSession();
  const unread = session.verifiedStudent ? session.unreadContactRequests : 0;
  return (
    <header className="relative z-40 flex min-h-[44px] w-full items-center justify-between gap-2 px-3 pt-1.5">
      <Link href="/" aria-label="Swoop home" className="campus-press shrink-0">
        <SwoopLogo size={17} />
      </Link>

      <div className="flex min-w-0 items-center gap-1">
        <CollegeSelector />
        <IconButton label="Notifications" icon={InboxIcon} href="/campus/activity" badge={unread > 0 ? unread : undefined} />
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              userButtonRoot: 'w-8 h-8',
              userButtonBox: 'w-8 h-8 flex items-center justify-center',
              userButtonTrigger: 'w-8 h-8 flex items-center justify-center rounded-full bg-surface hover:opacity-80 transition-opacity duration-150',
              userButtonAvatarBox: 'w-7 h-7 rounded-full',
              userButtonAvatarImage: 'w-7 h-7 rounded-full object-cover'
            }
          }}
        />
      </div>
    </header>
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

  return (
    <div className="relative min-w-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="campus-press flex h-7 min-w-0 max-w-[160px] items-center gap-[3px] rounded-full bg-surface pl-[7px] pr-2 text-ink"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <PinIcon size={13} className="shrink-0" />
        <span className="block truncate text-[12px] font-bold leading-none">{selectedCollege}</span>
        <CaretDownIcon size={11} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="animate-drop-in absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_16px_40px_rgba(16,24,40,0.14)]">
          <p className="border-b border-line px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate">Choose campus</p>
          <ul className="max-h-60 overflow-auto py-1" role="listbox">
            {collegeNames.length === 0 ? <li className="px-3 py-2 text-[12px] font-semibold text-slate">No campuses found</li> : null}
            {collegeNames.map((c) => {
              const active = c === selectedCollege;
              return (
                <li key={c} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold transition-colors',
                      active ? 'bg-royal-tint text-royal' : 'text-ink hover:bg-surface'
                    )}
                    onClick={() => {
                      setSelectedCollege(c);
                      setOpen(false);
                    }}
                  >
                    <PinIcon size={13} className={cn('shrink-0', active ? 'text-royal' : 'text-text-muted')} />
                    <span className="min-w-0 flex-1 truncate leading-none">{c}</span>
                    {active && <CheckIcon size={13} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
