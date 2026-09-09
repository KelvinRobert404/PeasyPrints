'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui' }}><div style={{ maxWidth: 480, textAlign: 'center' }}><h1>PeasyPrints needs a refresh</h1><p>We could not load the application shell. Existing orders and payments remain recorded.</p><button onClick={reset} style={{ minHeight: 44, padding: '0 18px' }}>Try again</button></div></main></body></html>;
}
