'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { Segmented, swButton } from '@/components/swoop/primitives';
import { ArrowDownIcon, ArrowUpIcon, DownloadIcon, FilmIcon, RefreshIcon } from '../icons';
import { PageHead, SectionTitle, StatusTag, TableState, gvCard, gvIconBtn, gvRow, type StatusTone } from '../ui';

type Content = { id: string; serial: string; title: string; audience: string; status: string; promotionEligible: boolean; availabilityExpiresAt: string };
type Pack = { id: string; type: string; status: string; templateId: string; createdAt: string; assets?: Array<{ name: string }> };

const packTone = (status: string): StatusTone => (status === 'succeeded' ? 'go' : status === 'failed' ? 'market' : 'slate');

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

  return (
    <div className="space-y-3.5">
      <PageHead
        kicker="peasy-comotion"
        title="Reel Packs"
        description="Choose eligible campus posts, set their order, and hand off a frozen snapshot to the local renderer."
        className="pb-0"
        actions={
          <button type="button" aria-label="Refresh" onClick={() => void load()} className={cn(swButton({ variant: 'surface', size: 'sm' }), 'w-8 px-0')}>
            <RefreshIcon size={15} />
          </button>
        }
      />

      <div className="grid gap-3.5 xl:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Segmented
              label="Content type"
              className="w-[240px]"
              value={type}
              onChange={setType}
              options={[{ value: 'marketplace', label: 'Marketplace' }, { value: 'housing', label: 'Housing' }]}
            />
            <p className="text-[11.5px] font-bold text-slate tabular-nums">Select {min}–{max}</p>
          </div>
          <div className={cn(gvCard, 'overflow-hidden')}>
            {eligible.length === 0 ? (
              <TableState icon={FilmIcon} title="No confirmed, promotion-eligible campus posts." />
            ) : (
              <div>
                {eligible.map((item) => {
                  const checked = selected.includes(item.id);
                  return (
                    <label key={item.id} className={cn(gvRow, 'flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-1.5 transition-colors', checked ? 'bg-royal-tint/50' : 'hover:bg-surface/60')}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} className="h-4 w-4 shrink-0 accent-royal" />
                      <span className="rounded-[6px] bg-surface px-1.5 py-0.5 font-mono text-[10.5px] font-bold">{item.serial}</span>
                      <span className="min-w-0 flex-1 truncate font-bold">{item.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className={cn(gvCard, 'h-fit p-3.5')}>
          <div className="flex items-center gap-2">
            <FilmIcon size={16} className="text-royal" />
            <SectionTitle meta={`${selected.length}/${max}`}>Reel order</SectionTitle>
          </div>
          <div className="mt-3 space-y-1.5">
            {selected.length === 0 ? (
              <p className="rounded-[12px] bg-surface p-4 text-center text-[11.5px] text-slate">Selected posts appear here.</p>
            ) : selected.map((id, index) => {
              const item = content.find((entry) => entry.id === id);
              return (
                <div key={id} className="flex h-10 items-center gap-2 rounded-[10px] border border-line pl-2 pr-1">
                  <span className="w-5 text-center text-[11px] font-extrabold text-slate tabular-nums">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{item?.serial} · {item?.title}</span>
                  <button type="button" onClick={() => move(index, -1)} aria-label="Move up" className={gvIconBtn}>
                    <ArrowUpIcon size={14} />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} aria-label="Move down" className={gvIconBtn}>
                    <ArrowDownIcon size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" disabled={busy || selected.length < min || selected.length > max} onClick={() => void queue()} className={cn(swButton({ variant: 'primary', size: 'md' }), 'mt-3 w-full')}>
            {busy ? 'Queuing…' : 'Queue posting pack'}
          </button>
          <p className="mt-2.5 text-[11px] leading-[1.45] text-slate">Girls’ Space is structurally excluded. The worker receives no phone number, exact address, or private identity.</p>
        </aside>
      </div>

      <section>
        <SectionTitle className="mb-2">Recent packs</SectionTitle>
        <div className={cn(gvCard, 'overflow-hidden')}>
          {packs.length === 0 ? (
            <TableState icon={FilmIcon} title="No packs rendered yet." />
          ) : (
            <div>
              {packs.map((pack) => (
                <div key={pack.id} className={cn(gvRow, 'flex min-h-[44px] flex-wrap items-center gap-3 px-4 py-1.5')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11.5px] font-bold">{pack.id}</p>
                    <p className="text-[11px] text-slate tabular-nums">{pack.type} · {pack.templateId} · {new Date(pack.createdAt).toLocaleString()}</p>
                  </div>
                  <StatusTag tone={packTone(pack.status)}>{pack.status}</StatusTag>
                  {pack.status === 'succeeded' && (
                    <a href={`/api/godview/render-packs/${pack.id}/artifact?name=posting-pack.zip`} className={swButton({ variant: 'primary', size: 'sm' })}>
                      <DownloadIcon size={14} />
                      Download pack
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
