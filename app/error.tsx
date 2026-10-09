'use client';

import { useEffect } from 'react';
import { EmptyState, swButton } from '@/components/swoop/primitives';
import { AlertIcon } from '@/components/swoop/icons';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Route error', error); }, [error]);
  return (
    <main className="flex flex-1 flex-col bg-white px-3 pb-3 pt-3">
      <EmptyState
        icon={AlertIcon}
        title={<span role="heading" aria-level={1}>Something went wrong</span>}
        body="Your payment and order records are not changed by retrying this page."
        action={
          <button type="button" onClick={reset} className={swButton({ size: 'md', className: 'mt-1' })}>
            Try again
          </button>
        }
      />
    </main>
  );
}
