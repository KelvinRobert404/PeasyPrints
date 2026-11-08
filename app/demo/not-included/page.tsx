'use client';

// /demo/not-included?area=godview|shopfront: the demo proxy sends the admin
// console and the shop dashboard here. Demo only: a 404 everywhere else.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { use } from 'react';
import { isDemoMode } from '@/lib/demo/mode';
import { SwoopLogo } from '@/components/swoop/Logo';
import { Tag, swButton } from '@/components/swoop/primitives';
import { EmptyArt } from '@/components/swoop/illustrations';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Area = 'godview' | 'shopfront';

const COPY: Record<Area | 'other', { title: string; lines: string[] }> = {
  godview: {
    title: "The admin console isn't in the demo",
    lines: ['It is for the Swoop team, not students.', 'The demo shows the student app only.'],
  },
  shopfront: {
    title: "The shop dashboard isn't in the demo",
    lines: ['It is for print shop owners.', 'The demo shows the student app only.'],
  },
  other: {
    title: "This part isn't in the demo",
    lines: ['The demo shows the student app only.'],
  },
};

function readArea(value: string | string[] | undefined): Area | 'other' {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'godview' || raw === 'shopfront' ? raw : 'other';
}

export default function NotIncludedPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isDemoMode()) notFound();
  return <NotIncluded searchParams={searchParams} />;
}

function NotIncluded({ searchParams }: { searchParams: SearchParams }) {
  const copy = COPY[readArea(use(searchParams).area)];

  return (
    <main className="flex flex-1 flex-col px-3 pb-4 pt-3">
      <div className="flex items-center gap-1.5">
        <SwoopLogo size={15} />
        <Tag tone="royal">Demo</Tag>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <EmptyArt width={120} height={110} />
        <h1 className="mt-3 font-heading text-[16px] leading-[1.15] text-ink">{copy.title}</h1>
        {copy.lines.map((line) => (
          <p key={line} className="mt-1 text-[12px] leading-[1.4] text-slate">
            {line}
          </p>
        ))}
        <div className="mt-4 flex w-full max-w-[280px] flex-col gap-1.5">
          <Link href="/" className={swButton({ variant: 'primary', size: 'md', className: 'w-full' })}>
            Back to Swoop
          </Link>
          <Link href="/demo" className={swButton({ variant: 'ghost', size: 'md', className: 'w-full' })}>
            Demo start
          </Link>
        </div>
      </div>

      <p className="text-center text-[11px] text-slate">Sample data. Nothing here is real.</p>
    </main>
  );
}
