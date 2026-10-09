'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#FFFFFF', color: '#101828', fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 320, textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>Swoop needs a refresh</h1>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#71717A' }}>
              We could not load the application shell. Existing orders and payments remain recorded.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 16, height: 40, padding: '0 18px', border: 0, borderRadius: 10, background: '#0055FF', color: '#FFFFFF', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
