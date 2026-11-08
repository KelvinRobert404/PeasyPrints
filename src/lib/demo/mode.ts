// Demo mode: Swoop on sample data, run locally by `npm run demo`.
// Dev only: it can never turn on in a production build. Demo implies fixture mode.
// No imports, so the proxy, the client, shims and node tests can all use it.

export function isDemoMode(): boolean {
  // Literal process.env reads so Next can inline them into client bundles.
  return process.env.NEXT_PUBLIC_SWOOP_DEMO === '1' && process.env.NODE_ENV !== 'production';
}
