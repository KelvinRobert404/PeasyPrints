'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Film, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Content = { id: string; serial: string; title: string; audience: string; status: string; promotionEligible: boolean; availabilityExpiresAt: string };
type Pack = { id: string; type: string; status: string; templateId: string; createdAt: string; assets?: Array<{ name: string }> };

export default function ReelPacksPage() {
  const [type, setType] = useState<'marketplace' | 'housing'>('marketplace');
  const [content, setContent] = useState<Content[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [contentResponse, packsResponse] = await Promise.all([fetch(`/api/godview/campus/content?type=${type}`, { cache: 'no-store' }), fetch('/api/godview/render-packs', { cache: 'no-store' })]);
    if (!contentResponse.ok || !packsResponse.ok) return toast.error('Could not load Reel Packs');
    setContent((await contentResponse.json()).items || []);
    setPacks((await packsResponse.json()).items || []);
  }, [type]);
  useEffect(() => { setSelected([]); void load(); }, [load]);

  const eligible = useMemo(() => content.filter((item) => item.audience === 'campus' && item.status === 'active' && item.promotionEligible !== false && new Date(item.availabilityExpiresAt).getTime() > Date.now()), [content]);
  const min = type === 'marketplace' ? 4 : 3;
  const max = type === 'marketplace' ? 8 : 5;

  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < max ? [...current, id] : current); }
  function move(index: number, direction: -1 | 1) { setSelected((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  async function queue() {
    setBusy(true);
    const response = await fetch('/api/godview/render-packs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, contentIds: selected, templateId: type === 'marketplace' ? 'campus-editorial-v1' : 'housing-editorial-v1' }) });
    setBusy(false);
    if (!response.ok) return toast.error((await response.json()).error || 'Could not queue pack');
    toast.success('Immutable render snapshot queued'); setSelected([]); void load();
  }

  return <div className="space-y-7"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">peasy-comotion</p><h1 className="mt-1 text-2xl font-bold text-zinc-950">Reel Packs</h1><p className="mt-1 text-sm text-zinc-500">Choose eligible campus posts, set their order, and hand off a frozen snapshot to the local renderer.</p></div><button onClick={() => void load()} className="rounded-lg border bg-white p-2.5"><RefreshCw className="h-4 w-4" /></button></div>
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]"><section><div className="mb-3 flex items-center justify-between"><div className="rounded-lg bg-zinc-100 p-1">{(['marketplace', 'housing'] as const).map((value) => <button key={value} onClick={() => setType(value)} className={`rounded-md px-4 py-2 text-xs font-bold capitalize ${type === value ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>{value}</button>)}</div><p className="text-xs font-semibold text-zinc-500">Select {min}–{max}</p></div><div className="overflow-hidden rounded-xl border bg-white">{eligible.length === 0 ? <p className="p-10 text-center text-sm text-zinc-500">No confirmed, promotion-eligible campus posts.</p> : eligible.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 border-b p-4 last:border-0"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="h-4 w-4 accent-zinc-950" /><span className="rounded bg-zinc-100 px-2 py-1 font-mono text-[11px] font-bold">{item.serial}</span><span className="flex-1 text-sm font-semibold text-zinc-800">{item.title}</span></label>)}</div></section>
    <aside className="h-fit rounded-xl border bg-white p-5"><div className="flex items-center gap-2"><Film className="h-4 w-4 text-violet-600" /><h2 className="text-sm font-bold">Reel order</h2></div><div className="mt-4 space-y-2">{selected.length === 0 ? <p className="rounded-lg bg-zinc-50 p-5 text-center text-xs text-zinc-500">Selected posts appear here.</p> : selected.map((id, index) => { const item = content.find((entry) => entry.id === id); return <div key={id} className="flex items-center gap-2 rounded-lg border p-2"><span className="w-5 text-center text-xs font-bold text-zinc-400">{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold">{item?.serial} · {item?.title}</span><button onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button><button onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button></div>; })}</div><button disabled={busy || selected.length < min || selected.length > max} onClick={() => void queue()} className="mt-4 w-full rounded-lg bg-zinc-950 px-4 py-3 text-xs font-bold text-white disabled:opacity-40">{busy ? 'Queuing…' : 'Queue posting pack'}</button><p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Girls’ Space is structurally excluded. The worker receives no phone number, exact address, or private identity.</p></aside></div>
    <section><h2 className="mb-3 text-sm font-bold">Recent packs</h2><div className="overflow-hidden rounded-xl border bg-white">{packs.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">No packs rendered yet.</p> : packs.map((pack) => <div key={pack.id} className="flex flex-wrap items-center gap-4 border-b p-4 last:border-0"><div className="flex-1"><p className="font-mono text-xs font-bold">{pack.id}</p><p className="mt-1 text-xs text-zinc-500">{pack.type} · {pack.templateId} · {new Date(pack.createdAt).toLocaleString()}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${pack.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : pack.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{pack.status}</span>{pack.status === 'succeeded' && <a href={`/api/godview/render-packs/${pack.id}/artifact?name=posting-pack.zip`} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-bold text-white"><Download className="h-3.5 w-3.5" />Download pack</a>}</div>)}</div></section></div>;
}
