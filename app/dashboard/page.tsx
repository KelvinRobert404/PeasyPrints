'use client';

export const dynamic = 'force-dynamic';

import { EmptyState } from '@/components/swoop/primitives';
import { GridIcon } from '@/components/swoop/icons';

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col bg-white px-3 pb-3 pt-3">
      <EmptyState icon={GridIcon} title="Dashboard coming soon" body="Dashboard content is on its way." />
    </main>
  );
}
