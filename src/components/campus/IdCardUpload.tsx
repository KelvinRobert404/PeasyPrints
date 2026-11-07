'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ClockIcon, DocIcon, GirlsSpaceIcon } from '@/components/swoop/icons';
import { IconTile, Tag, swButton } from '@/components/swoop/primitives';
import type { VerificationKind, VerificationStatus } from '@/types/campus';
import { cn } from '@/lib/utils/cn';

export type UploadResult = { ok: true } | { ok: false; error: string };

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/** POST /api/campus/verifications. Never throws. */
export async function uploadIdCard(kind: VerificationKind, file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  try {
    const response = await fetch('/api/campus/verifications', { method: 'POST', body: form });
    // The platform rejects oversized bodies with a non-JSON 413.
    const data = await response.json().catch(() => ({}));
    if (response.ok) return { ok: true };
    if (response.status === 413) return { ok: false, error: 'That file is too big. Keep it under 4 MB.' };
    if (response.status === 429) return { ok: false, error: 'Too many tries today. Try tomorrow.' };
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Could not send it. Try again.' };
  } catch {
    return { ok: false, error: 'You’re offline. Check your connection.' };
  }
}

/**
 * Picks a photo or PDF of the college ID card and sends it for a manual check.
 * `submit` defaults to the real upload; previews pass a no-op.
 */
export function IdCardUpload({
  kind = 'student',
  onSubmitted,
  submit = uploadIdCard,
  buttonLabel = 'Send ID card',
  className,
}: {
  kind?: VerificationKind;
  onSubmitted?: () => void | Promise<void>;
  submit?: (kind: VerificationKind, file: File) => Promise<UploadResult>;
  buttonLabel?: string;
  className?: string;
}) {
  const inputId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const file = input.current?.files?.[0];
    if (!file) {
      setError('Choose a photo of your ID card first.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await submit(kind, file);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    await onSubmitted?.();
    setBusy(false);
  };

  return (
    <form onSubmit={onSubmit} noValidate className={cn('flex flex-col gap-2', className)}>
      <p className="text-[11.5px] leading-[1.45] text-slate">
        Only the campus team sees it. Never shown publicly.
      </p>
      <label
        htmlFor={inputId}
        className={cn(
          'campus-press flex h-12 items-center gap-2.5 rounded-[12px] bg-surface px-3 focus-within:ring-2 focus-within:ring-royal/40',
          busy ? 'pointer-events-none opacity-45' : 'cursor-pointer'
        )}
      >
        <DocIcon size={20} className="shrink-0 text-ink" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold text-ink">{fileName || 'Choose your ID card'}</span>
          <span className="block text-[10.5px] text-slate">Photo or PDF, under 4 MB</span>
        </span>
        <span className="shrink-0 text-[11.5px] font-bold text-royal">{fileName ? 'Change' : 'Browse'}</span>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPT}
          disabled={busy}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name || '');
            if (error) setError(null);
          }}
          className="sr-only"
        />
      </label>
      {error ? (
        <p id={errorId} role="alert" className="text-[11.5px] font-semibold text-market">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={swButton({ size: 'md', className: 'w-full' })}>
        {busy ? 'Sending…' : buttonLabel}
      </button>
    </form>
  );
}

/** One-line note above the course step while the ID card waits. */
export function IdCardInReviewNote() {
  return (
    <p className="flex items-center gap-1.5 rounded-[12px] bg-royal-tint px-3 py-2 text-[11.5px] font-semibold text-royal">
      <ClockIcon size={14} className="shrink-0" />
      Your ID card is in review.
    </p>
  );
}

/** Shown while a student ID card waits for the campus team. */
export function IdCardPending({ onCheckAgain, checking = false }: { onCheckAgain?: () => void; checking?: boolean }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-[14px] bg-surface px-5 py-6 text-center">
      <IconTile icon={ClockIcon} tone="royal" size={44} />
      <Tag tone="royal">In review</Tag>
      <h2 className="font-heading text-[16px] leading-[1.15] text-ink">Your ID card is in review</h2>
      <p className="max-w-[260px] text-[11.5px] leading-[1.45] text-slate">
        Swoop unlocks once the campus team approves it.
      </p>
      {onCheckAgain ? (
        <button
          type="button"
          onClick={onCheckAgain}
          disabled={checking}
          className={swButton({ variant: 'white', size: 'sm', className: 'mt-1' })}
        >
          {checking ? 'Checking…' : 'Check again'}
        </button>
      ) : null}
    </section>
  );
}

function GirlsStatusTag({ status }: { status: VerificationStatus }) {
  if (status === 'approved') return <Tag tone="go">You’re in</Tag>;
  if (status === 'pending') return <Tag tone="royal">In review</Tag>;
  if (status === 'rejected') return <Tag className="bg-market-tint text-market">Not accepted</Tag>;
  if (status === 'expired') return <Tag className="bg-market-tint text-market">Expired</Tag>;
  if (status === 'revoked') return <Tag className="bg-market-tint text-market">Paused</Tag>;
  return <Tag className="bg-surface text-text-secondary">Not started</Tag>;
}

/**
 * Girls' space: a separate ID card check for the private Marketplace and Housing.
 * Only shown once the student check is approved.
 */
export function GirlsSpaceSection({
  status,
  onSubmitted,
  submit,
}: {
  status: VerificationStatus;
  onSubmitted?: () => void | Promise<void>;
  submit?: (kind: VerificationKind, file: File) => Promise<UploadResult>;
}) {
  const headingId = useId();
  const canUpload = status === 'unverified' || status === 'rejected' || status === 'expired';
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-[14px] border border-line bg-white p-3">
      <div className="flex items-start gap-2.5">
        <IconTile icon={GirlsSpaceIcon} tone="girls" size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 id={headingId} className="font-heading text-[14.5px] leading-[1.1] text-ink">
              Girls’ space
            </h2>
            <GirlsStatusTag status={status} />
          </div>
          <p className="mt-0.5 text-[11.5px] leading-[1.45] text-slate">Private Marketplace and Housing for girls.</p>
        </div>
      </div>
      {status === 'approved' ? (
        <Link href="/girls-space" className={swButton({ variant: 'surface', size: 'md', className: 'w-full' })}>
          Open Girls’ space
        </Link>
      ) : status === 'pending' ? (
        <p className="text-[11.5px] leading-[1.45] text-slate">The campus team is checking your ID card.</p>
      ) : status === 'revoked' ? (
        <p className="text-[11.5px] leading-[1.45] text-slate">Access is paused. Talk to the campus team.</p>
      ) : canUpload ? (
        <IdCardUpload kind="girls_space" onSubmitted={onSubmitted} submit={submit} buttonLabel="Ask for access" />
      ) : null}
    </section>
  );
}

export default IdCardUpload;
