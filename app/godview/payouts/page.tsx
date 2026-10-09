'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { swButton } from '@/components/swoop/primitives';
import { WalletIcon } from '../icons';
import { PageHead, StatusTag, TableState, gvCard, gvRow, gvTableHead, type StatusTone } from '../ui';

type Item = { id: string; shopId: string; amount: number; status: string; requestedAt: string | null; reference?: string };

const toneFor = (status: string): StatusTone =>
  status === 'paid' ? 'go' : status === 'processing' ? 'royal' : status === 'failed' ? 'market' : 'slate';

export default function GodviewPayoutsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const load = async () => {
    const response = await fetch('/api/godview/payouts', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to load payouts');
    setItems(data.items || []);
  };
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, []);
  const update = async (id: string, action: 'processing' | 'paid' | 'cancelled') => {
    let reference: string | undefined;
    if (action === 'paid') {
      const entered = window.prompt('Settlement reference');
      if (entered === null) return;
      reference = entered;
    }
    if (action === 'cancelled' && !window.confirm('Cancel this payout request and release the reserved balance?')) return;
    const response = await fetch('/api/godview/payouts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, reference }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to update payout');
    await load();
  };
  return (
    <section>
      <PageHead title="Payout approvals" description="Only administrators can settle or cancel reserved shop balances." />
      {error ? (
        <p role="alert" className="mb-3 rounded-[10px] bg-market-tint px-3 py-2 text-[12px] font-semibold text-market">{error}</p>
      ) : null}
      <div className={cn(gvCard, 'overflow-hidden')}>
        {items.length === 0 ? (
          <TableState icon={WalletIcon} title="No payout requests." />
        ) : (
          <>
            <div className={cn(gvTableHead, 'grid grid-cols-12 gap-4 px-4 py-2')}>
              <div className="col-span-3">Shop</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Requested</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>
            <div>
              {items.map((item) => (
                <div key={item.id} className={cn(gvRow, 'grid min-h-[44px] grid-cols-12 items-center gap-4 px-4 py-1.5 transition-colors hover:bg-surface/60')}>
                  <p className="col-span-3 truncate font-bold">{item.shopId}</p>
                  <div className="col-span-2 text-right font-bold tabular-nums">₹{item.amount}</div>
                  <div className="col-span-2">
                    <StatusTag tone={toneFor(item.status)}>{item.status}</StatusTag>
                  </div>
                  <div className="col-span-2 text-[11.5px] text-slate tabular-nums">
                    {item.requestedAt ? new Date(item.requestedAt).toLocaleString() : 'Unknown date'}
                  </div>
                  <div className="col-span-3 flex justify-end">
                    {!['paid', 'cancelled'].includes(item.status) ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button type="button" className={swButton({ variant: 'surface', size: 'sm' })} onClick={() => void update(item.id, 'processing').catch((reason) => setError(reason.message))}>Processing</button>
                        <button type="button" className={swButton({ variant: 'primary', size: 'sm' })} onClick={() => void update(item.id, 'paid').catch((reason) => setError(reason.message))}>Mark paid</button>
                        <button type="button" className={swButton({ variant: 'danger', size: 'sm' })} onClick={() => void update(item.id, 'cancelled').catch((reason) => setError(reason.message))}>Cancel</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
