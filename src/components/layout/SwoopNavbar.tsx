'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useCampusSession } from '@/hooks/useCampusSession';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { cn } from '@/lib/utils/cn';
import { SwoopLogo } from '@/components/swoop/Logo';
import { IconButton } from '@/components/swoop/primitives';
import { InboxIcon, PinIcon } from '@/components/swoop/icons';

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
        <CampusChip />
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

const chipClass = 'flex h-7 min-w-0 max-w-[160px] items-center gap-[3px] rounded-full bg-surface pl-[7px] pr-2 text-ink';

/** Read-only campus label from the session. Students never pick it here. */
function CampusChip() {
  const { loading } = useCampusSession();
  const campus = useCurrentCampus();

  if (campus) {
    return (
      <span className={chipClass} title={campus.label}>
        <PinIcon size={13} className="shrink-0" />
        <span className="block truncate text-[12px] font-bold leading-none">{campus.label}</span>
      </span>
    );
  }

  if (loading) {
    return <span aria-hidden="true" className="h-7 w-[84px] shrink animate-pulse rounded-full bg-surface" />;
  }

  return (
    <Link href="/login" className={cn('campus-press', chipClass)}>
      <PinIcon size={13} className="shrink-0" />
      <span className="block truncate text-[12px] font-bold leading-none">Pick college</span>
    </Link>
  );
}
