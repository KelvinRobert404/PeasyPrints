'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowLeft, ChevronRight, CircleHelp, House, LogOut, Package, ShieldCheck, User } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useUser, useClerk } from '@clerk/nextjs';

// Lucide icon component (same call-site API as before)
const ICONS = {
  arrow_back: ArrowLeft,
  person: User,
  package_2: Package,
  chevron_right: ChevronRight,
  help: CircleHelp,
  privacy_tip: ShieldCheck,
  logout: LogOut,
  home: House,
} as const;

function Icon({ name, className = '' }: { name: keyof typeof ICONS; className?: string }) {
  const Cmp = ICONS[name];
  return <Cmp size={20} className={className} />;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const displayName = clerkUser?.fullName || clerkUser?.firstName || user?.email || 'User';
  const displayEmail = clerkUser?.primaryEmailAddress?.emailAddress || user?.email || '';

  return (
    <div className="min-h-screen flex flex-col bg-white pb-20">
      {/* Navbar */}
      <div className="bg-blue-600 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-white active:opacity-70">
          <Icon name="arrow_back" className="text-2xl" />
        </Link>
        <h1 className="text-lg font-semibold text-white">Profile</h1>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-6">
        {/* User Card */}
        <div className="bg-blue-50 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center">
              <Icon name="person" className="text-2xl text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{displayName}</p>
              {displayEmail && (
                <p className="text-sm text-gray-500">{displayEmail}</p>
              )}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="mt-6 space-y-2">
          <Link
            href="/orders"
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl active:bg-gray-50"
          >
            <Icon name="package_2" className="text-xl text-blue-600" />
            <span className="text-sm font-medium text-gray-900">My Orders</span>
            <Icon name="chevron_right" className="ml-auto text-xl text-gray-400" />
          </Link>

          <Link
            href="/contact"
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl active:bg-gray-50"
          >
            <Icon name="help" className="text-xl text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Help & Support</span>
            <Icon name="chevron_right" className="ml-auto text-xl text-gray-400" />
          </Link>

          <Link
            href="/settings/privacy"
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl active:bg-gray-50"
          >
            <Icon name="privacy_tip" className="text-xl text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Privacy settings</span>
            <Icon name="chevron_right" className="ml-auto text-xl text-gray-400" />
          </Link>
        </div>

        {/* Sign Out */}
        <button
          onClick={() => signOut({ redirectUrl: '/' })}
          className="mt-8 w-full flex items-center justify-center gap-2 py-3.5 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 active:bg-gray-200"
        >
          <Icon name="logout" className="text-lg" />
          Sign Out
        </button>
      </main>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-4 left-4 right-4 max-w-[396px] mx-auto">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 py-3.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 text-white font-medium active:scale-[0.98] transition-transform"
        >
          <Icon name="home" className="text-xl" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
