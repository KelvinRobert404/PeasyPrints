'use client';

export const dynamic = 'force-dynamic';

import { useAuthStore } from '@/lib/stores/authStore';
import { useUser, useClerk } from '@clerk/nextjs';
import { Card, IconTile, ListRow, PageHeader, swButton } from '@/components/swoop/primitives';
import { HelpIcon, LogOutIcon, OrdersIcon, ShieldCheckIcon, UserIcon } from '@/components/swoop/icons';
import { cn } from '@/lib/utils/cn';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const displayName = clerkUser?.fullName || clerkUser?.firstName || user?.email || 'User';
  const displayEmail = clerkUser?.primaryEmailAddress?.emailAddress || user?.email || '';

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PageHeader title="Profile" backHref="/" />

      <main className="flex flex-1 flex-col gap-3 px-3 pb-3 pt-2">
        {/* Identity */}
        <Card className="flex items-center gap-3 p-3">
          <IconTile icon={UserIcon} tone="royal" size={44} />
          <div className="min-w-0">
            <p className="font-heading truncate text-[14.5px] leading-[1.15] text-ink">{displayName}</p>
            {displayEmail && <p className="truncate text-[11.5px] text-slate">{displayEmail}</p>}
          </div>
        </Card>

        {/* Menu */}
        <Card className="px-3">
          <ListRow href="/orders" leading={<IconTile icon={OrdersIcon} />} title="My orders" subtitle="Track current and past orders" />
          <ListRow href="/contact" leading={<IconTile icon={HelpIcon} />} title="Help & support" subtitle="Chat with the Swoop team" />
          <ListRow
            href="/settings/privacy"
            leading={<IconTile icon={ShieldCheckIcon} />}
            title="Privacy settings"
            subtitle="Analytics and account deletion"
            divider={false}
          />
        </Card>

        <button
          type="button"
          onClick={() => signOut({ redirectUrl: '/' })}
          className={cn(swButton({ variant: 'danger', size: 'md' }), 'w-full')}
        >
          <LogOutIcon size={16} />
          Sign out
        </button>
      </main>
    </div>
  );
}
