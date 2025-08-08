'use client';

export const dynamic = 'force-dynamic';

import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useAuthStore } from '@/lib/stores/authStore';

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Profile</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="text-sm text-gray-700">Signed in as: {user?.email || user?.phoneNumber || 'Guest'}</div>
        <button className="h-12 px-4 border rounded" onClick={logout}>Sign out</button>
      </main>
      <BottomNavigation />
    </div>
  );
}
