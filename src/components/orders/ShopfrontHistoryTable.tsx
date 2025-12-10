"use client";

import * as React from 'react';
import type { OrderDoc } from '@/types/models';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ShopfrontHistoryTableProps {
  orders: (OrderDoc & { id?: string; orderId?: string })[];
  onUndoCollected?: (order: any) => void;
  onUndoCancelled?: (order: any) => void;
  showUndo?: boolean;
}

function coerceDate(input: any): Date | null {
  const d: Date | null = input?.toDate?.() ? input.toDate() : (input ? new Date(input) : null);
  if (!d || isNaN(d.getTime())) return null;
  return d;
}

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function ShopfrontHistoryTable({ orders, onUndoCollected, onUndoCancelled, showUndo = true }: ShopfrontHistoryTableProps) {
  return (
    <Table className="bg-white">
      <TableHeader className="sticky top-0 z-10 bg-white">
        <TableRow>
          <TableHead className="px-3">Customer • Document</TableHead>
          <TableHead className="px-3 hidden md:table-cell">Configuration</TableHead>
          <TableHead className="px-3">Status</TableHead>
          <TableHead className="px-3 hidden sm:table-cell">Date</TableHead>
          <TableHead className="px-3 hidden sm:table-cell text-right">Total</TableHead>
          <TableHead className="px-3 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => {
          const d = coerceDate((o as any).historyTimestamp || o.timestamp);
          return (
            <TableRow key={(o as any).id ?? `${o.userId}-${String((o as any).historyTimestamp || o.timestamp)}`} className={`${o.status === 'cancelled' ? 'opacity-60' : ''}`}>
              <TableCell className="px-3">
                <div className="font-medium truncate max-w-[280px]">{o.userName} • {o.fileName}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs sm:hidden">
                  {o.jobType && (<Badge variant="secondary">{o.jobType}</Badge>)}
                  <Badge variant="outline">{o.printSettings?.paperSize}</Badge>
                  <Badge variant="outline">{o.printSettings?.printFormat}</Badge>
                </div>
              </TableCell>
              <TableCell className="px-3 hidden md:table-cell">
                <div className="flex flex-wrap gap-2 text-xs">
                  {o.jobType && (<Badge variant="secondary">{o.jobType}</Badge>)}
                  <Badge variant="outline">{o.printSettings?.paperSize}</Badge>
                  <Badge variant="outline">{o.printSettings?.printFormat}</Badge>
                  <Badge className={o.printSettings?.printColor === 'Black & White' ? 'bg-green-600/10 text-green-700 border-green-600/20' : 'bg-blue-600/10 text-blue-700 border-blue-600/20'}>
                    {o.printSettings?.printColor}
                  </Badge>
                  <Badge variant="outline">{o.printSettings?.copies} copies • {o.totalPages} pages</Badge>
                </div>
              </TableCell>
              <TableCell className="px-3">
                {o.status === 'completed' ? (
                  <Badge variant="secondary">completed</Badge>
                ) : o.status === 'cancelled' ? (
                  <Badge variant="destructive">cancelled</Badge>
                ) : (
                  <Badge variant="secondary">{o.status}</Badge>
                )}
              </TableCell>
              <TableCell className="px-3 hidden sm:table-cell text-gray-700">{d ? formatDate(d) : ''}</TableCell>
              <TableCell className="px-3 hidden sm:table-cell text-right">₹{Number(o.totalCost ?? 0).toFixed(0)}</TableCell>
              <TableCell className="px-3">
                <div className="flex flex-wrap gap-2 justify-end">
                  {showUndo && o.status === 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => onUndoCollected?.(o)}>Undo Collected</Button>
                  )}
                  {showUndo && o.status === 'cancelled' && (
                    <Button size="sm" variant="outline" onClick={() => onUndoCancelled?.(o)}>Undo Cancelled</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default ShopfrontHistoryTable;
