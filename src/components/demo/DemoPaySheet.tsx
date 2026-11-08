'use client';

// Demo only: the stand-in for Razorpay Checkout's payment window. Opened by
// the demo Razorpay class (src/lib/demo/client/checkout.ts) in its own React
// root, so it needs no provider. Pay, Payment fails and Cancel each play one
// Checkout outcome. No money moves.

import { useEffect, useId, useRef, useState } from 'react';
import { CloseIcon, DocIcon, QrIcon } from '@/components/swoop/icons';
import { IconButton, IconTile, Tag, swButton } from '@/components/swoop/primitives';
import { SpinnerIcon } from '@/components/upload/icons';
import { formatPrice } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';

export interface DemoPaySheetProps {
  /** Order amount in paise, as Checkout gets it. */
  amountPaise: number;
  /** What is being paid for, e.g. the file name. */
  description?: string;
  /** Resolves once the payment is recorded; rejects with a message to show. */
  onPay: () => Promise<void>;
  /** Resolves once the failed payment is recorded; rejects with a message to show. */
  onFail: () => Promise<void>;
  onCancel: () => void;
}

type Busy = 'pay' | 'fail' | null;

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Could not reach the demo. Try again.';
}

export function DemoPaySheet({ amountPaise, description, onPay, onFail, onCancel }: DemoPaySheetProps) {
  const titleId = useId();
  const lineId = useId();
  const payRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const price = formatPrice(Math.max(0, Number(amountPaise) || 0) / 100);

  const busyRef = useRef<Busy>(null);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    mounted.current = true;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    payRef.current?.focus();
    // Capture phase, so Escape closes only this sheet.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (!busyRef.current) onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      mounted.current = false;
      window.removeEventListener('keydown', onKey, true);
      returnTo?.focus();
    };
  }, [onCancel]);

  const run = async (kind: Exclude<Busy, null>) => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'pay' ? onPay() : onFail());
    } catch (err) {
      if (mounted.current) setError(messageOf(err));
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={lineId}
        aria-busy={busy ? 'true' : undefined}
        className="mx-auto w-full max-w-sm rounded-[14px] bg-white p-3.5 shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Tag tone="royal">Demo</Tag>
            <h2 id={titleId} className="mt-1 font-heading text-[22px] leading-none tabular-nums text-ink">
              Pay {price}
            </h2>
          </div>
          <IconButton label="Cancel payment" icon={CloseIcon} onClick={() => (busy ? undefined : onCancel())} />
        </div>

        <p id={lineId} className="mt-1.5 text-[12.5px] font-semibold text-ink">
          Demo payment. No money moves.
        </p>

        <div className="mt-2.5 flex flex-col divide-y divide-line rounded-[12px] bg-surface">
          {description ? (
            <div className="flex items-center gap-2.5 px-3 py-2">
              <IconTile icon={DocIcon} tone="royal" shape="square" size={30} />
              <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{description}</p>
            </div>
          ) : null}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <IconTile icon={QrIcon} tone="go" shape="square" size={30} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-ink">UPI</p>
              <p className="text-[11px] font-semibold text-slate">Sample account. Nothing is charged.</p>
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-2 text-[11.5px] font-bold text-market">
            {error}
          </p>
        ) : null}

        <button
          ref={payRef}
          type="button"
          disabled={busy !== null}
          onClick={() => void run('pay')}
          className={cn(swButton({ size: 'lg' }), 'mt-3 w-full')}
        >
          {busy === 'pay' ? <SpinnerIcon size={18} className="animate-spin" /> : null}
          {busy === 'pay' ? 'Paying…' : `Pay ${price}`}
        </button>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('fail')}
            className={cn(swButton({ variant: 'danger', size: 'md' }), 'w-full')}
          >
            {busy === 'fail' ? <SpinnerIcon size={16} className="animate-spin" /> : null}
            Payment fails
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={onCancel}
            className={cn(swButton({ variant: 'surface', size: 'md' }), 'w-full')}
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
