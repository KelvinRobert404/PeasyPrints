'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckIcon, ClockIcon, DocIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { EmptyState, IconTile, PageHeader, Tag, swButton } from '@/components/swoop/primitives';
import { useCampusSession } from '@/hooks/useCampusSession';
import { cn } from '@/lib/utils/cn';

export default function CampusVerificationPage() {
  const { session, loading, refresh } = useCampusSession();
  const [busy, setBusy] = useState<'student' | 'girls_space' | null>(null);
  const [message, setMessage] = useState('');
  const studentFile = useRef<HTMLInputElement>(null);
  const girlsFile = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent, kind: 'student' | 'girls_space') => {
    event.preventDefault(); setBusy(kind); setMessage('');
    const input = kind === 'student' ? studentFile.current : girlsFile.current;
    const file = input?.files?.[0];
    if (!file) { setMessage('Choose a clear photo or PDF of your college iCard.'); setBusy(null); return; }
    const form = new FormData(); form.append('kind', kind); form.append('file', file);
    try {
      const response = await fetch('/api/campus/verifications', { method: 'POST', body: form });
      // The platform rejects oversized bodies with a non-JSON 413.
      const data = await response.json().catch(() => ({}));
      setMessage(response.ok ? 'Submitted. The campus team will review it in Godview.'
        : response.status === 413 ? 'That file is too large. Please upload a smaller photo (under 4 MB).'
        : data.error || 'Could not submit verification.');
      await refresh();
    } catch {
      setMessage('Could not submit verification. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="px-3 pt-3"><div className="skeleton h-72 rounded-[14px]" /></div>;
  if (!session.signedIn) {
    return (
      <div className="pb-3">
        <PageHeader title="Campus verification" kicker="KJU trust layer" />
        <div className="px-3 pt-2">
          <EmptyState
            icon={ShieldCheckIcon}
            title="Sign in before verifying"
            action={<Link href="/login?redirect_url=/campus/verify" className={cn(swButton({ size: 'sm' }), 'mt-1')}>Sign in</Link>}
          />
        </div>
      </div>
    );
  }

  const studentStatus = session.membership?.student.status || 'unverified';
  const girlsStatus = session.membership?.girlsSpace.status || 'unverified';
  return (
    <div className="pb-3">
      <PageHeader title="Campus verification" kicker="KJU trust layer" />
      <main className="px-3 pt-2">
        <section className="flex items-start gap-2.5 rounded-[14px] bg-surface p-3">
          <IconTile icon={ShieldCheckIcon} tone="royal" size={36} />
          <div className="min-w-0">
            <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">One real student, one trusted campus.</h2>
            <p className="mt-1 text-[11.5px] leading-[1.45] text-slate">Verification is private. Public profiles show only a display name and verified badge.</p>
          </div>
        </section>
        <ol className="pt-3.5">
          <VerificationCard step={1} title="Student access" status={studentStatus} description="A verified college email is checked automatically when its KJU domain is configured. Use your iCard as the fallback." onSubmit={(event) => submit(event, 'student')} inputRef={studentFile} busy={busy === 'student'} disabled={studentStatus === 'approved' || studentStatus === 'pending'} />
          <VerificationCard
            step={2}
            last
            title="Girls’ space"
            status={girlsStatus}
            description="A separate manual review unlocks the private Marketplace and Housing entrances."
            note={studentStatus !== 'approved' ? 'Complete student verification before requesting Girls’ space access.' : undefined}
            onSubmit={(event) => submit(event, 'girls_space')}
            inputRef={girlsFile}
            busy={busy === 'girls_space'}
            disabled={studentStatus !== 'approved' || girlsStatus === 'approved' || girlsStatus === 'pending'}
          />
        </ol>
        {message ? <div className="mt-1 rounded-[12px] bg-surface px-3 py-2.5 text-[12px] font-semibold text-ink" role="status">{message}</div> : null}
      </main>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  if (status === 'approved') return <Tag tone="go">Verified</Tag>;
  if (status === 'pending') return <Tag tone="royal">In review</Tag>;
  if (status === 'unverified') return <Tag className="bg-surface text-text-secondary">Not started</Tag>;
  return <Tag className="bg-market-tint text-market">{status}</Tag>;
}

function VerificationCard({ step, last = false, title, status, description, note, onSubmit, inputRef, busy, disabled }: { step: number; last?: boolean; title: string; status: string; description: string; note?: string; onSubmit: (event: FormEvent) => void; inputRef: React.RefObject<HTMLInputElement | null>; busy: boolean; disabled: boolean }) {
  const [fileName, setFileName] = useState('');
  const approved = status === 'approved';
  const pending = status === 'pending';
  const locked = disabled && !approved && !pending;

  return (
    <li className="flex gap-2.5">
      <div className="flex flex-col items-center" aria-hidden="true">
        <span
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold',
            approved ? 'bg-go-tint text-go-text' : pending ? 'bg-royal-tint text-royal' : locked ? 'bg-surface text-slate' : 'bg-ink text-white'
          )}
        >
          {approved ? <CheckIcon size={14} /> : pending ? <ClockIcon size={14} /> : step}
        </span>
        {!last ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
      </div>
      <form onSubmit={onSubmit} className={cn('min-w-0 flex-1', !last && 'pb-4')}>
        <div className="flex min-h-7 items-center justify-between gap-2">
          <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">{title}</h2>
          <StatusTag status={status} />
        </div>
        <p className="mt-0.5 text-[11.5px] leading-[1.45] text-slate">{description}</p>
        {note ? <p className="mt-1 text-[11px] font-semibold text-text-secondary">{note}</p> : null}
        <label
          className={cn(
            'campus-press mt-2.5 flex h-12 items-center gap-2.5 rounded-[12px] bg-surface px-3 focus-within:ring-2 focus-within:ring-royal/40',
            disabled ? 'pointer-events-none opacity-45' : 'cursor-pointer'
          )}
        >
          <DocIcon size={20} className="shrink-0 text-ink" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-bold text-ink">{fileName || 'Choose your iCard'}</span>
            <span className="block text-[10.5px] text-slate">Photo or PDF</span>
          </span>
          <span className="shrink-0 text-[11.5px] font-bold text-royal">{fileName ? 'Change' : 'Browse'}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={disabled}
            onChange={(event) => setFileName(event.target.files?.[0]?.name || '')}
            className="sr-only"
          />
        </label>
        <button type="submit" disabled={disabled || busy} className={cn(swButton({ size: 'md' }), 'mt-2 w-full')}>
          {busy ? 'Uploading securely…' : approved ? 'Verified' : pending ? 'Review pending' : 'Submit iCard'}
        </button>
      </form>
    </li>
  );
}
