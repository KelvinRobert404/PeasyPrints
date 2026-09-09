export default function Loading() {
  return <div role="status" aria-live="polite" className="mx-auto max-w-lg px-5 py-12"><div className="h-7 w-40 animate-pulse rounded bg-zinc-200" /><div className="mt-5 h-32 animate-pulse rounded-2xl bg-zinc-100" /><span className="sr-only">Loading</span></div>;
}
