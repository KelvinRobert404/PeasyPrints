"use client";

import { useMemo, useState } from 'react';
import { useShopStore } from '@/lib/stores/shopStore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function toLocalMonthYear(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function BillingSummary() {
  const { historyOrders, orders, payouts, receivableAmount, payoutRequests, requestPayout, confirmPayoutSettlement } = useShopStore() as any;
  const [month, setMonth] = useState<string>(() => toLocalMonthYear(new Date()));
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutOpen, setPayoutOpen] = useState<boolean>(false);

  const coerceDate = (input: any): Date | null => {
    const d: Date | null = input?.toDate?.() ? input.toDate() : (input ? new Date(input) : null);
    if (!d || isNaN(d.getTime())) return null;
    return d;
  };

  const combinedCompleted = useMemo(() => {
    // Start with history (already mirrored on completion)
    const list: any[] = Array.isArray(historyOrders) ? [...historyOrders] : [];
    const seenOrderIds = new Set<string>();
    for (const h of list) {
      if ((h as any).orderId) seenOrderIds.add((h as any).orderId);
    }
    // Add completed orders that might not have a history mirror (legacy)
    const completedOrders = (Array.isArray(orders) ? orders : []).filter((o: any) => o.status === 'completed');
    for (const o of completedOrders) {
      const oid = (o as any).id;
      if (oid && !seenOrderIds.has(oid)) {
        list.push(o);
      }
    }
    return list;
  }, [historyOrders, orders]);

  const monthStats = useMemo(() => {
    const [y, m] = month.split('-').map((x) => Number(x));
    const start = new Date(y, (m - 1), 1, 0, 0, 0, 0);
    const end = new Date(y, (m - 1) + 1, 0, 23, 59, 59, 999);
    const list = combinedCompleted
      .filter((o: any) => o.status === 'completed')
      .filter((o: any) => {
        const dt = coerceDate(o.historyTimestamp) || coerceDate(o.timestamp);
        if (!dt) return false;
        return dt >= start && dt <= end;
      });
    const total = list.reduce((s: number, o: any) => s + Number(o.totalCost || 0), 0);
    return { list, total, count: list.length };
  }, [combinedCompleted, month]);

  const totalOfListed = useMemo(() => monthStats.list.reduce((s: number, o: any) => s + Number(o.totalCost || 0), 0), [monthStats.list]);
  // Available balance derived from history minus payouts to match dashboard expectations
  const derivedAllTimeRevenue = useMemo(() => {
    return (Array.isArray(historyOrders) ? historyOrders : [])
      .filter((o: any) => o.status === 'completed')
      .reduce((sum: number, o: any) => sum + Number(o.totalCost || 0), 0);
  }, [historyOrders]);
  const totalPayouts = useMemo(() => (Array.isArray(payouts) ? payouts : []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0), [payouts]);
  const maxPayout = Math.max(0, derivedAllTimeRevenue - totalPayouts);
  const formatShortDate = (d: Date) => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const day = d.getDate();
    const mon = months[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    return `${day} ${mon} - ${yy}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous month"
            onClick={() => {
              const [y, m] = month.split('-').map((x) => Number(x));
              const d = new Date(y, m - 2, 1);
              setMonth(toLocalMonthYear(d));
            }}
          >
            ‹
          </Button>
          <div className="min-w-[140px] text-center font-semibold">
            {new Date(Number(month.split('-')[0]), Number(month.split('-')[1]) - 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-label="Next month"
            onClick={() => {
              const [y, m] = month.split('-').map((x) => Number(x));
              const d = new Date(y, m, 1);
              setMonth(toLocalMonthYear(d));
            }}
          >
            ›
          </Button>
        </div>
      </div>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>Enter an amount up to ₹{maxPayout}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              inputMode="numeric"
              placeholder={`Up to ₹${maxPayout}`}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const amt = Number(payoutAmount || '0');
                if (!amt || amt < 1) return;
                if (amt > maxPayout) return;
                void requestPayout(amt);
                setPayoutAmount('');
                setPayoutOpen(false);
              }}
            >
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded border bg-white">
          <div className="text-xs text-gray-500">Total orders</div>
          <div className="text-xl font-semibold">{monthStats.count}</div>
        </div>
        <div className="p-3 rounded border bg-white">
          <div className="text-xs text-gray-500">Monthly total</div>
          <div className="text-xl font-semibold">₹{monthStats.total}</div>
        </div>
        <div className="p-3 rounded border bg-white">
          <div className="text-xs text-gray-500">Available balance</div>
          <div className="text-xl font-semibold">₹{maxPayout}</div>
          <div className="mt-2">
            <Button size="sm" onClick={() => setPayoutOpen(true)}>Request payout</Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-600">Orders this month</div>
        <div className="rounded border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                  <TableHead>Date</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Username</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                  <TableHead>Color</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthStats.list.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell>
                    {(() => {
                      const fromHistory = o.historyTimestamp?.toDate?.() ? o.historyTimestamp.toDate() : (o.historyTimestamp ? new Date(o.historyTimestamp) : null);
                      const fallback = o.timestamp?.toDate?.() ? o.timestamp.toDate() : (o.timestamp ? new Date(o.timestamp) : null);
                      const dt = fromHistory && !isNaN(fromHistory.getTime()) ? fromHistory : (fallback && !isNaN(fallback.getTime()) ? fallback : null);
                      return dt && !isNaN(dt.getTime()) ? formatShortDate(dt) : '-';
                    })()}
                  </TableCell>
                  <TableCell className="truncate max-w-[320px]">{o.fileName}</TableCell>
                  <TableCell className="truncate max-w-[200px]">{o.userName}</TableCell>
                  <TableCell className="text-right">{o.totalPages}</TableCell>
                  <TableCell>{o.printSettings?.printColor === 'Black & White' ? 'B&W' : 'Color'}</TableCell>
                  <TableCell className="text-right">₹{o.totalCost}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} className="text-right font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold">₹{totalOfListed}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutRequests.map((r) => {
                const expected = (r as any).expectedAt?.toDate?.() ? (r as any).expectedAt.toDate() : (r as any).expectedAt ? new Date((r as any).expectedAt) : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>₹{r.amount}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'paid' ? 'success' : r.status === 'processing' ? 'secondary' : 'outline'}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>{expected ? expected.toLocaleString() : '-'}</TableCell>
                    <TableCell className="text-right">
                      {r.status === 'paid' ? (
                        <Button size="sm" onClick={() => { void confirmPayoutSettlement(r.id, r.amount); }}>Confirm received</Button>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}


