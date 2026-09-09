'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { CampusHeader } from '@/components/campus/CampusHeader';
import { useCampusSession } from '@/hooks/useCampusSession';

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
    const response = await fetch('/api/campus/verifications', { method: 'POST', body: form });
    const data = await response.json();
    setMessage(response.ok ? 'Submitted. The campus team will review it in Godview.' : data.error || 'Could not submit verification.');
    await refresh(); setBusy(null);
  };

  if (loading) return <div className="min-h-screen bg-[#f4f5f7] p-4"><div className="skeleton mx-auto h-72 max-w-md rounded-[30px]" /></div>;
  if (!session.signedIn) return <div className="min-h-screen bg-[#f4f5f7] px-4 py-10"><div className="mx-auto max-w-sm rounded-[28px] bg-white p-7 text-center"><h1 className="font-quinn text-2xl font-bold">Sign in before verifying</h1><Link href="/login?redirect_url=/campus/verify" className="mt-5 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-extrabold text-white">Sign in</Link></div></div>;

  const studentStatus = session.membership?.student.status || 'unverified';
  const girlsStatus = session.membership?.girlsSpace.status || 'unverified';
  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-12"><CampusHeader title="Campus verification" eyebrow="KJU trust layer" accent="#0055ff" />
      <main className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        <section className="overflow-hidden rounded-[30px] bg-[#0b2d76] p-5 text-white"><BadgeCheck size={30} className="text-[#8bb3ff]" /><h1 className="mt-16 font-quinn text-[34px] font-bold leading-[0.95]">One real student.<br />One trusted campus.</h1><p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-white/55">Verification is private. Public profiles show only a display name and verified badge.</p></section>
        <VerificationCard title="Student access" status={studentStatus} description="A verified college email is checked automatically when its KJU domain is configured. Use your iCard as the fallback." onSubmit={(event) => submit(event, 'student')} inputRef={studentFile} busy={busy === 'student'} disabled={studentStatus === 'approved' || studentStatus === 'pending'} />
        <VerificationCard title="Girls’ Space" status={girlsStatus} description="A separate manual review unlocks the private Marketplace and Housing entrances." onSubmit={(event) => submit(event, 'girls_space')} inputRef={girlsFile} busy={busy === 'girls_space'} disabled={studentStatus !== 'approved' || girlsStatus === 'approved' || girlsStatus === 'pending'} />
        {studentStatus !== 'approved' ? <p className="px-2 text-[11px] font-bold text-zinc-500">Complete student verification before requesting Girls’ Space access.</p> : null}
        {message ? <div className="rounded-2xl bg-white p-4 text-sm font-bold text-zinc-700" role="status">{message}</div> : null}
      </main>
    </div>
  );
}

function VerificationCard({ title, status, description, onSubmit, inputRef, busy, disabled }: { title: string; status: string; description: string; onSubmit: (event: FormEvent) => void; inputRef: React.RefObject<HTMLInputElement | null>; busy: boolean; disabled: boolean }) {
  return <form onSubmit={onSubmit} className="rounded-[28px] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-quinn text-xl font-bold">{title}</h2><p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{description}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${status === 'approved' ? 'bg-emerald-100 text-emerald-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'}`}>{status}</span></div><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={disabled} className="mt-5 block w-full rounded-2xl bg-[#f4f5f7] p-3 text-xs font-bold disabled:opacity-50" /><button disabled={disabled || busy} className="campus-press mt-3 h-12 w-full rounded-2xl bg-black text-xs font-extrabold text-white disabled:bg-zinc-300">{busy ? 'Uploading securely…' : status === 'approved' ? 'Verified' : status === 'pending' ? 'Review pending' : 'Submit iCard'}</button></form>;
}
