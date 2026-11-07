'use client';

import { useEffect, useId, useState } from 'react';
import { CloseIcon } from '@/components/swoop/icons';
import { IconButton, swButton } from '@/components/swoop/primitives';
import { FlagIcon } from '@/components/marketplace/icons';
import { cn } from '@/lib/utils/cn';

export type ReportContentType = 'marketplace' | 'housing';

type Props = {
  contentType: ReportContentType;
  contentId: string;
  /** Control the sheet from outside. Leave undefined to use the built-in 'Report this post' link. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in link when the parent opens the sheet itself. */
  trigger?: boolean;
  onSent?: () => void;
  className?: string;
};

const QUICK_REASONS = ['Looks like a scam', 'Wrong price or photos', 'Already sold or gone', 'Rude or unsafe'];
const MIN_REASON = 3;
const MAX_REASON = 400;

const CHIP =
  'campus-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40';

/** 'Report this post' link and its sheet. Sends to POST /api/campus/actions. */
export function ReportSheet({ contentType, contentId, open, onOpenChange, trigger = true, onSent, className }: Props) {
  const titleId = useId();
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const setOpen = (next: boolean) => {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
    if (next) setError('');
  };

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [isOpen]);

  const send = async () => {
    const text = reason.trim();
    if (text.length < MIN_REASON || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/campus/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'report', contentType, contentId, reason: text }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not send report');
      }
      setReason('');
      setSent(true);
      setOpen(false);
      onSent?.();
    } catch (cause) {
      setError((cause as Error).message || 'Could not send report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {trigger ? (
        <div className={cn('flex flex-col items-center', className)}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="campus-press flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-market"
          >
            <FlagIcon size={14} aria-hidden="true" />
            Report this post
          </button>
          {sent ? (
            <p role="status" className="text-[11px] font-semibold text-go-text">
              Thanks. The campus team will look.
            </p>
          ) : null}
        </div>
      ) : null}

      {isOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="mx-auto w-full max-w-md rounded-[14px] bg-white p-4 shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold text-market">Safety report</p>
                <h2 id={titleId} className="font-heading text-[16px] leading-[1.1] text-ink">
                  What should we review?
                </h2>
              </div>
              <IconButton label="Close report" icon={CloseIcon} onClick={() => setOpen(false)} />
            </div>

            <div role="group" aria-label="Quick reasons" className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((quick) => {
                const selected = reason.trim() === quick;
                return (
                  <button
                    key={quick}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setReason(quick)}
                    className={cn(CHIP, selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink')}
                  >
                    {quick}
                  </button>
                );
              })}
            </div>

            <label className="mt-3 block text-[11.5px] font-bold text-ink">
              Tell us more
              <textarea
                autoFocus
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={MAX_REASON}
                className="campus-input mt-1.5 min-h-24 resize-none"
                placeholder="Skip phone numbers and private details."
              />
            </label>

            {error ? (
              <p role="alert" className="mt-2 rounded-[12px] bg-market-tint px-3 py-2 text-[11.5px] font-bold text-market">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy || reason.trim().length < MIN_REASON}
              onClick={() => void send()}
              className={cn(swButton({ variant: 'danger' }), 'mt-3 w-full')}
            >
              {busy ? 'Sending…' : 'Send private report'}
            </button>
            <p className="mt-1.5 text-center text-[10.5px] font-semibold text-slate">Goes to the campus team.</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
