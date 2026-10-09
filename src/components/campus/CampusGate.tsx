'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { GirlsSpaceIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { IconTile, swButton, Tag } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';
import { useCampusSession } from '@/hooks/useCampusSession';

export function CampusGate({ children, girlsOnly = false }: { children: ReactNode; girlsOnly?: boolean }) {
  const { session, loading } = useCampusSession();

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-white px-3 pt-3" aria-busy="true">
        <div className="mx-auto max-w-lg space-y-2" aria-hidden="true">
          <div className="h-8 w-1/2 animate-pulse rounded-full bg-surface" />
          <div className="h-10 animate-pulse rounded-full bg-surface" />
          <div className="grid grid-cols-3 gap-1.5 pt-1.5">
            {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-[112px] animate-pulse rounded-[12px] bg-surface" />)}
          </div>
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
      <div className="min-h-[70vh] bg-white px-3 pt-6">
        <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-[14px] bg-surface px-5 py-6 text-center">
          <IconTile icon={girlsOnly ? GirlsSpaceIcon : ShieldCheckIcon} tone={girlsOnly ? 'girls' : 'royal'} size={44} />
          <Tag tone="white">KJU verified</Tag>
          <h1 className="font-heading text-[16px] leading-[1.1] text-ink">{title}</h1>
          <p className="max-w-[280px] text-[11.5px] leading-[1.45] text-text-secondary">{description}</p>
          <Link
            href={!session.signedIn ? '/login?redirect_url=/campus/verify' : '/campus/verify'}
            className={cn(swButton({ variant: 'primary' }), 'mt-2 w-full')}
          >
            {!session.signedIn ? 'Sign in to continue' : girlsOnly ? 'Request private access' : 'Verify student account'}
          </Link>
          <Link href="/" className={cn(swButton({ variant: 'ghost', size: 'sm' }), 'w-full')}>Back home</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
