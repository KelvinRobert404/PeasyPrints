export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2 bg-white px-3 pb-3 pt-3">
      <div className="h-[42px] animate-pulse rounded-full bg-surface" />
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div className="h-[74px] animate-pulse rounded-[14px] bg-surface" />
        <div className="h-[74px] animate-pulse rounded-[14px] bg-surface" />
      </div>
      <div className="mt-1.5 h-4 w-28 animate-pulse rounded-full bg-surface" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-2/5 animate-pulse rounded-full bg-surface" />
            <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-surface" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
