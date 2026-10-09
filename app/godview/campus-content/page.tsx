'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

type Item = { id: string; serial: string; title: string; audience: string; status: string; collegeCode: string; reportCount: number; seller?: { displayName: string }; poster?: { displayName: string } };

export default function CampusContentPage() {
  const [type, setType] = useState<'marketplace' | 'housing'>('marketplace');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/godview/campus/content?type=${type}&q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    if (!response.ok) return toast.error('Could not load campus content');
    setItems((await response.json()).items || []);
  }, [query, type]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 180); return () => window.clearTimeout(timer); }, [load]);

  async function changeStatus(item: Item, status: 'active' | 'removed' | 'closed') {
    let reason = '';
    if (status === 'removed') {
      const entered = window.prompt('Moderation reason');
      if (entered === null) return;
      reason = entered || 'Removed after administrative review';
    }
    const response = await fetch('/api/godview/campus/content', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id: item.id, status, reason }) });
    if (!response.ok) return toast.error((await response.json()).error || 'Status update failed');
    toast.success(`${item.serial} updated`);
    void load();
  }

  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Safety operations</p><h1 className="mt-1 text-2xl font-bold text-zinc-950">Campus Content</h1><p className="mt-1 text-sm text-zinc-500">Search serials, review reports and manage Marketplace or Housing lifecycle.</p></div>
    <div className="flex flex-wrap gap-3"><div className="rounded-lg bg-zinc-100 p-1">{(['marketplace', 'housing'] as const).map((value) => <button key={value} onClick={() => setType(value)} className={`rounded-md px-4 py-2 text-xs font-bold capitalize ${type === value ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}>{value}</button>)}</div><label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search KJU-M4827 or a title" className="h-10 w-full rounded-lg border bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500" /></label></div>
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">{items.length === 0 ? <p className="p-10 text-center text-sm text-zinc-500">No matching posts.</p> : items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-4 border-b p-4 last:border-0"><div className="min-w-52 flex-1"><div className="flex items-center gap-2"><span className="rounded bg-zinc-100 px-2 py-1 font-mono text-[11px] font-bold">{item.serial}</span>{item.audience === 'girls' && <span className="rounded bg-fuchsia-50 px-2 py-1 text-[10px] font-bold text-fuchsia-700">Girls’ Space</span>}{item.reportCount > 0 && <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700"><ShieldAlert className="h-3 w-3" />{item.reportCount} reports</span>}</div><p className="mt-2 text-sm font-semibold text-zinc-900">{item.title}</p><p className="mt-0.5 text-xs text-zinc-500">{item.seller?.displayName || item.poster?.displayName} · {item.collegeCode} · {item.status}</p></div><div className="flex gap-2"><button onClick={() => void changeStatus(item, 'active')} className="rounded-lg border px-3 py-2 text-xs font-semibold text-emerald-700">Activate</button><button onClick={() => void changeStatus(item, 'closed')} className="rounded-lg border px-3 py-2 text-xs font-semibold text-zinc-600">Close</button><button onClick={() => void changeStatus(item, 'removed')} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Remove</button></div></div>)}</div>
  </div>;
}
