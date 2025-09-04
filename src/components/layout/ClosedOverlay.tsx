"use client";

import { Button } from "@/components/ui/button";

interface ClosedOverlayProps {
  onOpenNow: () => void;
}

export function ClosedOverlay({ onOpenNow }: ClosedOverlayProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white/95 p-6 text-center shadow-2xl">
        <div className="mb-2 text-2xl font-semibold text-gray-900">Store is Closed</div>
        <div className="mb-6 text-sm text-gray-600">Customers can’t place orders right now.</div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="success" onClick={onOpenNow}>
            Open store now
          </Button>
        </div>
      </div>
    </div>
  );
}


