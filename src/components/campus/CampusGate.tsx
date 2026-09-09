'use client';

import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCampusSession } from '@/hooks/useCampusSession';

export function CampusGate({ children, girlsOnly = false }: { children: ReactNode; girlsOnly?: boolean }) {
  const { session, loading } = useCampusSession();

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-[#f4f5f7] px-4 py-8">
        <div className="mx-auto max-w-lg space-y-3">
          <div className="skeleton h-24 rounded-[28px]" />
          <div className="grid grid-cols-2 gap-3"><div className="skeleton h-48 rounded-[24px]" /><div className="skeleton h-48 rounded-[24px]" /></div>
        </div>
      </div>
    );
  }

  if (!session.signedIn || !session.verifiedStudent || (girlsOnly && !session.girlsSpaceApproved)) {
    const title = !session.signedIn
      ? 'Your campus is waiting'
      : girlsOnly
        ? 'Girls’ Space is private by design'
        : 'Verify once. Trade with confidence.';
    const description = !session.signedIn
      ? 'Sign in to enter the KJU student marketplace and housing network.'
      : girlsOnly
        ? 'Upload your college iCard for a private, one-time review. Your card is never shown publicly.'
        : 'Use your college email or submit your iCard so everyone here is part of a real campus community.';
    return (
      <div className="min-h-screen bg-[#f4f5f7] px-4 py-10">
        <div className="mx-auto max-w-md overflow-hidden rounded-[32px] bg-[#111] p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
          <div className="mb-16 flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">KJU verified</span>
            <BadgeCheck size={20} className="text-white/70" />
          </div>
          <h1 className="font-quinn text-4xl font-bold leading-[0.96]">{title}</h1>
          <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-white/58">{description}</p>
          <Link
            href={!session.signedIn ? '/login?redirect_url=/campus/verify' : '/campus/verify'}
            className="mt-8 flex h-13 items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-black transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
          >
            {!session.signedIn ? 'Sign in to continue' : girlsOnly ? 'Request private access' : 'Verify student account'}
          </Link>
          <Link href="/" className="mt-3 flex h-11 items-center justify-center text-xs font-bold text-white/50">Back home</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
