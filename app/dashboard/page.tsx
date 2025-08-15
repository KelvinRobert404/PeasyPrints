'use client';

export const dynamic = 'force-dynamic';

import { BottomNavigation } from '@/components/layout/BottomNavigation';

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="text-sm text-gray-600">Dashboard content coming soon...</div>
      </main>
      <BottomNavigation />
    </div>
  );
}
