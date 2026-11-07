'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { GirlsSpaceIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { IconTile, swButton, Tag } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';
import { useCampusSession } from '@/hooks/useCampusSession';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import type { CampusSession, OnboardingStep } from '@/types/campus';

type GateBlock = { kind: 'signin' } | { kind: 'girls' } | { kind: 'onboard'; step: OnboardingStep } | null;

/** What stands between this student and the page, else null. */
function gateBlock(session: CampusSession, girlsOnly: boolean): GateBlock {
  if (!session.signedIn) return { kind: 'signin' };
  const needs = session.onboarding?.needs ?? (session.verifiedStudent ? null : 'verify');
  if (girlsOnly && (needs || !session.verifiedStudent || !session.girlsSpaceApproved)) return { kind: 'girls' };
  if (needs) return { kind: 'onboard', step: needs };
  if (!session.verifiedStudent) return { kind: 'onboard', step: 'verify' };
  return null;
}

const ONBOARD_COPY: Record<OnboardingStep, { description: string; action: string }> = {
  college: { description: 'Pick your college, then verify.', action: 'Pick your college' },
  verify: { description: 'Use your college email or iCard.', action: 'Verify student account' },
  course: { description: 'Add your course to finish.', action: 'Finish setup' },
};

export function CampusGate({ children, girlsOnly = false }: { children: ReactNode; girlsOnly?: boolean }) {
  const { session, loading } = useCampusSession();
  const campus = useCurrentCampus();
  const pathname = usePathname() || '/';

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

  const block = gateBlock(session, girlsOnly);
  if (!block) return <>{children}</>;

  const next = encodeURIComponent(pathname);
  const code = campus?.code ?? 'campus';
  let title: string;
  let description: string;
  let action: string;
  let href: string;
  if (block.kind === 'signin') {
    title = `Hey, sign in to see ${code} posts`;
    description = 'Buy, sell and rent near campus.';
    action = 'Sign in to continue';
    href = `/login?redirect_url=${next}`;
  } else if (block.kind === 'girls') {
    title = 'Girls’ Space is private by design';
    description = 'Upload your college iCard for a private, one-time review. Your card is never shown publicly.';
    action = 'Request private access';
    href = `/campus/verify?next=${next}`;
  } else {
    title = 'Verify once to buy, sell and rent';
    description = ONBOARD_COPY[block.step].description;
    action = ONBOARD_COPY[block.step].action;
    href = `/campus/verify?next=${next}`;
  }

  return (
    <div className="min-h-[70vh] bg-white px-3 pt-6">
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-[14px] bg-surface px-5 py-6 text-center">
        <IconTile icon={girlsOnly ? GirlsSpaceIcon : ShieldCheckIcon} tone={girlsOnly ? 'girls' : 'royal'} size={44} />
        <Tag tone="white">Only verified students</Tag>
        <h1 className="font-heading text-[16px] leading-[1.1] text-ink">{title}</h1>
        <p className="max-w-[280px] text-[11.5px] leading-[1.45] text-text-secondary">{description}</p>
        <Link href={href} className={cn(swButton({ variant: 'primary' }), 'mt-2 w-full')}>
          {action}
        </Link>
        <Link href="/" className={cn(swButton({ variant: 'ghost', size: 'sm' }), 'w-full')}>Back home</Link>
      </div>
    </div>
  );
}
