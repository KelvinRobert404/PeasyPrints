'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Item = { id: string; shopId: string; amount: number; status: string; requestedAt: string | null; reference?: string };

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
  return <section><h1 className="text-xl font-semibold text-zinc-900">Payout approvals</h1><p className="mt-1 text-sm text-zinc-500">Only administrators can settle or cancel reserved shop balances.</p>{error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}<div className="mt-6 overflow-hidden rounded-xl border bg-white">{items.length === 0 ? <p className="p-8 text-sm text-zinc-500">No payout requests.</p> : items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-4 border-b p-4 last:border-0"><div className="min-w-52 flex-1"><p className="text-sm font-semibold">₹{item.amount} · {item.shopId}</p><p className="text-xs text-zinc-500">{item.status} · {item.requestedAt ? new Date(item.requestedAt).toLocaleString() : 'Unknown date'}</p></div>{!['paid', 'cancelled'].includes(item.status) ? <div className="flex gap-2"><Button variant="outline" onClick={() => void update(item.id, 'processing').catch((reason) => setError(reason.message))}>Processing</Button><Button onClick={() => void update(item.id, 'paid').catch((reason) => setError(reason.message))}>Mark paid</Button><Button variant="destructive" onClick={() => void update(item.id, 'cancelled').catch((reason) => setError(reason.message))}>Cancel</Button></div> : null}</div>)}</div></section>;
}
