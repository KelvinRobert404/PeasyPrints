'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SearchPill, Segmented, swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';
import { FlagIcon } from '../icons';
import { PageHead, StatusTag, TableState, gvCard } from '../ui';

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

  return (
    <div className="space-y-3">
      <PageHead
        kicker="Safety operations"
        title="Campus Content"
        description="Search serials, review reports and manage Marketplace or Housing lifecycle."
        className="pb-0"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Content type"
          value={type}
          onChange={setType}
          options={(['marketplace', 'housing'] as const).map((value) => ({ value, label: value }))}
          className="w-[240px]"
        />
        <SearchPill
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search KJU-M4827 or a title"
          aria-label="Search campus content"
          wrapperClassName="h-9 min-w-64 flex-1"
        />
      </div>
      <div className={cn(gvCard, 'overflow-hidden')}>
        {items.length === 0 ? (
          <TableState icon={FlagIcon} title="No matching posts." />
        ) : items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <div className="min-w-52 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-[6px] bg-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink">{item.serial}</span>
                {item.audience === 'girls' && <StatusTag tone="girls">Girls’ Space</StatusTag>}
                {item.reportCount > 0 && (
                  <StatusTag tone="market">
                    <FlagIcon size={10} />
                    {item.reportCount} reports
                  </StatusTag>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] font-bold text-ink">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-slate">{item.seller?.displayName || item.poster?.displayName} · {item.collegeCode} · {item.status}</p>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => void changeStatus(item, 'active')} className={cn(swButton({ variant: 'surface', size: 'sm' }), 'text-go-text')}>Activate</button>
              <button type="button" onClick={() => void changeStatus(item, 'closed')} className={swButton({ variant: 'surface', size: 'sm' })}>Close</button>
              <button type="button" onClick={() => void changeStatus(item, 'removed')} className={swButton({ variant: 'danger', size: 'sm' })}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
