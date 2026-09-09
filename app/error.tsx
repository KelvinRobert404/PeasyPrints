'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Route error', error); }, [error]);
  return <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-5 text-center">
    <h1 className="text-2xl font-bold">Something went wrong</h1>
    <p className="mt-3 text-sm leading-6 text-zinc-600">Your payment and order records are not changed by retrying this page.</p>
    <button onClick={reset} className="mt-5 min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white">Try again</button>
  </main>;
}
