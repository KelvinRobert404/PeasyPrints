'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';

type RequestItem = { id: string; kind: 'student' | 'girls_space'; displayName: string; email?: string | null; collegeCode: string; createdAt: string };
type Membership = { id: string; displayName: string; collegeCode: string; studentStatus: string; studentExpiresAt?: string | null; girlsStatus: string; girlsExpiresAt?: string | null };
type Config = { emailDomains: string[]; pickupPoints: Array<{ id: string; label: string }>; marketplaceEnabled: boolean; housingEnabled: boolean; serialNamespaces: Array<{ product: string; prefix: string; reserved: number; capacity: number }> };

export default function CampusTrustPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [queueResponse, membershipResponse, configResponse] = await Promise.all([
      fetch('/api/godview/campus/verifications?status=pending', { cache: 'no-store' }),
      fetch('/api/godview/campus/memberships', { cache: 'no-store' }),
      fetch('/api/godview/campus/config', { cache: 'no-store' }),
    ]);
    if (!queueResponse.ok || !membershipResponse.ok || !configResponse.ok) return toast.error('Could not load Campus Trust');
    setRequests((await queueResponse.json()).items || []);
    setMemberships((await membershipResponse.json()).items || []);
    setConfig(await configResponse.json());
  }, []);

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

  async function saveConfig() {
    if (!config) return;
    const response = await fetch('/api/godview/campus/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    if (!response.ok) return toast.error((await response.json()).error || 'Configuration failed');
    toast.success('KJU configuration saved');
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">KJU pilot</p><h1 className="mt-1 text-2xl font-bold text-zinc-950">Campus Trust</h1><p className="mt-1 text-sm text-zinc-500">Identity reviews, annual access and college controls.</p></div>
        <button onClick={() => void load()} className="rounded-lg border bg-white p-2.5 text-zinc-600 hover:bg-zinc-50" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {config?.serialNamespaces.map((namespace) => namespace.reserved / namespace.capacity >= 0.8 && <div key={namespace.prefix} className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{namespace.prefix} serial namespace is {Math.round(namespace.reserved / namespace.capacity * 100)}% utilized. Plan a wider serial format before capacity is reached.</div>)}

      <section><h2 className="mb-3 text-sm font-bold text-zinc-900">Pending iCard reviews · {requests.length}</h2><div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {requests.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">The review queue is clear.</p> : requests.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-4 border-b border-zinc-100 p-4 last:border-0">
          <div className={`rounded-lg p-2 ${item.kind === 'girls_space' ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-blue-50 text-blue-700'}`}><ShieldCheck className="h-4 w-4" /></div>
          <div className="min-w-48 flex-1"><p className="text-sm font-semibold text-zinc-900">{item.displayName}</p><p className="text-xs text-zinc-500">{item.kind === 'girls_space' ? 'Girls’ Space' : 'Student'} · {item.email || item.collegeCode}</p></div>
          <a href={`/api/godview/campus/verifications/${item.id}/card`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-zinc-700"><ExternalLink className="h-3.5 w-3.5" />View card</a>
          <button disabled={busy} onClick={() => void decide(item.id, 'reject')} className="rounded-lg border p-2 text-red-600"><X className="h-4 w-4" /></button>
          <button disabled={busy} onClick={() => void decide(item.id, 'approve')} className="rounded-lg bg-zinc-950 p-2 text-white"><Check className="h-4 w-4" /></button>
        </div>)}
      </div></section>

      <section><h2 className="mb-3 text-sm font-bold text-zinc-900">Active and historical memberships</h2><div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-zinc-50 text-zinc-500"><tr><th className="p-3">Student</th><th className="p-3">Student access</th><th className="p-3">Girls’ Space</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{memberships.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-semibold text-zinc-900">{item.displayName}<span className="ml-2 text-zinc-400">{item.collegeCode}</span></td><td className="p-3">{item.studentStatus} {item.studentExpiresAt && <span className="text-zinc-400">· {new Date(item.studentExpiresAt).toLocaleDateString()}</span>}</td><td className="p-3">{item.girlsStatus} {item.girlsExpiresAt && <span className="text-zinc-400">· {new Date(item.girlsExpiresAt).toLocaleDateString()}</span>}</td><td className="space-x-2 p-3 text-right"><button onClick={() => void updateMembership(item.id, 'student', 'renew')} className="font-semibold text-blue-600">Renew</button><button onClick={() => void updateMembership(item.id, 'student', 'revoke')} className="font-semibold text-red-600">Revoke</button></td></tr>)}</tbody></table></div></section>

      {config && <section className="rounded-xl border border-zinc-200 bg-white p-5"><h2 className="text-sm font-bold text-zinc-900">KJU access configuration</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-zinc-600">Verified email domains<textarea value={config.emailDomains.join('\n')} onChange={(event) => setConfig({ ...config, emailDomains: event.target.value.split(/\s+/).filter(Boolean) })} className="mt-2 min-h-28 w-full rounded-lg border p-3 font-mono text-xs" /></label><label className="text-xs font-semibold text-zinc-600">Safe pickup points<textarea value={config.pickupPoints.map((point) => point.label).join('\n')} onChange={(event) => setConfig({ ...config, pickupPoints: event.target.value.split('\n').filter(Boolean).map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label })) })} className="mt-2 min-h-28 w-full rounded-lg border p-3 text-xs" /></label></div><div className="mt-4 flex gap-5 text-xs font-semibold"><label><input type="checkbox" checked={config.marketplaceEnabled} onChange={(event) => setConfig({ ...config, marketplaceEnabled: event.target.checked })} className="mr-2" />Marketplace enabled</label><label><input type="checkbox" checked={config.housingEnabled} onChange={(event) => setConfig({ ...config, housingEnabled: event.target.checked })} className="mr-2" />Housing enabled</label></div><button onClick={() => void saveConfig()} className="mt-5 rounded-lg bg-zinc-950 px-4 py-2.5 text-xs font-bold text-white">Save configuration</button></section>}
    </div>
  );
}
