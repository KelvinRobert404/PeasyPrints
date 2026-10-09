"use client";

import { swButton } from "@/components/swoop/primitives";
import { LockIcon } from "@/components/swoop/icons";

interface ClosedOverlayProps {
  onOpenNow: () => void;
}

export function ClosedOverlay({ onOpenNow }: ClosedOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/70 backdrop-blur-sm">
      <div className="mx-3 flex w-full max-w-sm flex-col items-center gap-2 rounded-[14px] bg-white px-5 py-6 text-center shadow-[0_8px_30px_rgba(16,24,40,0.18)]">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink">
          <LockIcon size={20} />
        </span>
        <h2 className="font-heading text-[16px] leading-[1.1] text-ink">Store is closed</h2>
        <p className="text-[12px] text-slate">Customers can’t place orders right now.</p>
        <button type="button" onClick={onOpenNow} className={swButton({ variant: "primary", size: "md", className: "mt-2" })}>
          Open store now
        </button>
      </div>
    </div>
  );
}
