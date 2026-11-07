'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IconButton, IconTile, swButton } from '@/components/swoop/primitives';
import { CheckIcon, CloseIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { listColleges } from '@/lib/campus/catalog';
import { cn } from '@/lib/utils/cn';
import { ExternalIcon, RefreshIcon } from '../icons';
import { PageHead, SectionTitle, StatusTag, TableState, gvCard, gvInput, gvTableHead, type StatusTone } from '../ui';
import { CollegeConfigEditor } from './CollegeConfigEditor';

function membershipTone(status: string): StatusTone {
  const value = (status || '').toLowerCase();
  if (['active', 'approved', 'verified'].includes(value)) return 'go';
  if (['revoked', 'rejected'].includes(value)) return 'market';
  if (value === 'pending') return 'royal';
  return 'slate';
}

const METHOD_LABELS: Record<string, string> = {
  college_email: 'College email',
  google: 'Google',
  email_code: 'Email code',
  id_card: 'iCard',
};

const COLLEGE_OPTIONS = listColleges().map((college) => ({ id: college.id, label: college.shortName }));

function methodLabel(method?: string | null) {
  return method ? METHOD_LABELS[method] || method : null;
}

type RequestItem = {
  id: string;
  kind: 'student' | 'girls_space';
  displayName: string;
  email?: string | null;
  collegeCode: string | null;
  campusLabel: string | null;
  method: string | null;
  course: string | null;
  createdAt: string;
};
type Membership = {
  id: string;
  displayName: string;
  collegeCode: string | null;
  campusLabel: string | null;
  method: string | null;
  course: string | null;
  studentStatus: string;
  studentExpiresAt?: string | null;
  girlsStatus: string;
  girlsExpiresAt?: string | null;
};

export default function CampusTrustPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [collegeFilter, setCollegeFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const filter = collegeFilter ? `collegeId=${encodeURIComponent(collegeFilter)}` : '';
    const [queueResponse, membershipResponse] = await Promise.all([
      fetch(`/api/godview/campus/verifications?status=pending${filter ? `&${filter}` : ''}`, { cache: 'no-store' }),
      fetch(`/api/godview/campus/memberships${filter ? `?${filter}` : ''}`, { cache: 'no-store' }),
    ]);
    if (!queueResponse.ok || !membershipResponse.ok) return toast.error('Could not load Campus Trust');
    setRequests((await queueResponse.json()).items || []);
    setMemberships((await membershipResponse.json()).items || []);
  }, [collegeFilter]);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    let reason: string | undefined;
    if (action === 'reject') {
      const entered = window.prompt('Reason for rejection');
      if (entered === null) return;
      reason = entered || 'Unable to verify the submitted card';
    }
    setBusy(true);
    const response = await fetch(`/api/godview/campus/verifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }) });
    setBusy(false);
    if (!response.ok) return toast.error((await response.json()).error || 'Action failed');
    toast.success(action === 'approve' ? 'Verification approved' : 'Verification rejected');
    void load();
  }

  async function updateMembership(id: string, kind: 'student' | 'girls_space', action: 'renew' | 'revoke') {
    if (action === 'revoke' && !window.confirm('Revoke this entitlement and delete its retained iCard?')) return;
    const response = await fetch('/api/godview/campus/memberships', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, kind, action }) });
    if (!response.ok) return toast.error((await response.json()).error || 'Action failed');
    toast.success(action === 'renew' ? 'Renewed for one academic year' : 'Access revoked');
    void load();
  }

  return (
    <div className="space-y-5">
      <PageHead
        kicker="All colleges"
        title="Campus Trust"
        description="Identity reviews, annual access and college controls."
        actions={(
          <>
            <select
              value={collegeFilter}
              onChange={(event) => setCollegeFilter(event.target.value)}
              aria-label="Show reviews and members for"
              className={cn(gvInput, 'w-40 cursor-pointer')}
            >
              <option value="">All colleges</option>
              {COLLEGE_OPTIONS.map((college) => <option key={college.id} value={college.id}>{college.label}</option>)}
            </select>
            <IconButton label="Refresh" icon={RefreshIcon} onClick={() => void load()} />
          </>
        )}
        className="pb-0"
      />

      <section className="space-y-2">
        <SectionTitle meta={requests.length}>Pending iCard reviews</SectionTitle>
        <div className={cn(gvCard, 'overflow-hidden')}>
          {requests.length === 0 ? (
            <TableState icon={ShieldCheckIcon} title="The review queue is clear." className="h-28" />
          ) : requests.map((item) => (
            <div key={item.id} className="flex min-h-[52px] flex-wrap items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
              <IconTile icon={ShieldCheckIcon} tone={item.kind === 'girls_space' ? 'girls' : 'royal'} shape="square" size={30} iconSize={16} />
              <div className="min-w-48 flex-1">
                <p className="text-[12.5px] font-bold text-ink">{item.displayName}</p>
                <p className="text-[11px] text-slate">
                  {[item.kind === 'girls_space' ? 'Girls’ Space' : 'Student', item.campusLabel || item.collegeCode, methodLabel(item.method), item.course, item.email]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <a
                href={`/api/godview/campus/verifications/${item.id}/card`}
                target="_blank"
                rel="noreferrer"
                className={swButton({ variant: 'surface', size: 'sm' })}
              >
                <ExternalIcon size={14} />View card
              </a>
              <button type="button" disabled={busy} onClick={() => void decide(item.id, 'reject')} className={swButton({ variant: 'danger', size: 'sm' })}>
                <CloseIcon size={13} />Reject
              </button>
              <button type="button" disabled={busy} onClick={() => void decide(item.id, 'approve')} className={swButton({ variant: 'primary', size: 'sm' })}>
                <CheckIcon size={13} />Approve
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Active and historical memberships</SectionTitle>
        <div className={cn(gvCard, 'overflow-x-auto')}>
          <table className="w-full text-left text-[12.5px] text-ink">
            <thead className={gvTableHead}>
              <tr>
                <th className="px-4 py-2 font-extrabold">Student</th>
                <th className="px-4 py-2 font-extrabold">Campus</th>
                <th className="px-4 py-2 font-extrabold">Course</th>
                <th className="px-4 py-2 font-extrabold">Student access</th>
                <th className="px-4 py-2 font-extrabold">Girls’ Space</th>
                <th className="px-4 py-2 text-right font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((item) => (
                <tr key={item.id} className="h-11 border-b border-line last:border-b-0">
                  <td className="px-4 py-1.5 font-bold">
                    {item.displayName}
                    {item.collegeCode && <span className="ml-2 text-[11px] font-semibold text-slate">{item.collegeCode}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-[12px] text-text-secondary">{item.campusLabel || '–'}</td>
                  <td className="px-4 py-1.5 text-[12px] text-text-secondary">{item.course || '–'}</td>
                  <td className="px-4 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <StatusTag tone={membershipTone(item.studentStatus)}>{item.studentStatus}</StatusTag>
                      {methodLabel(item.method) && <span className="text-[11px] text-slate">{methodLabel(item.method)}</span>}
                      {item.studentExpiresAt && <span className="text-[11px] text-slate tabular-nums">· {new Date(item.studentExpiresAt).toLocaleDateString()}</span>}
                    </span>
                  </td>
                  <td className="px-4 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <StatusTag tone={membershipTone(item.girlsStatus)}>{item.girlsStatus}</StatusTag>
                      {item.girlsExpiresAt && <span className="text-[11px] text-slate tabular-nums">· {new Date(item.girlsExpiresAt).toLocaleDateString()}</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => void updateMembership(item.id, 'student', 'renew')}
                      className="h-7 rounded-[8px] px-2 text-[12px] font-bold text-royal transition-colors hover:bg-royal-tint"
                    >
                      Renew
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateMembership(item.id, 'student', 'revoke')}
                      className="ml-1 h-7 rounded-[8px] px-2 text-[12px] font-bold text-market transition-colors hover:bg-market-tint"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <CollegeConfigEditor />
    </div>
  );
}
