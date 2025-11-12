"use client";

import * as React from 'react';
import type { OrderDoc } from '@/types/models';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ShopfrontPendingTableProps {
  orders: (OrderDoc & { id?: string })[];
  isWindows?: boolean;
  onPrint?: (order: OrderDoc & { id?: string }) => void;
  onCancel?: (order: OrderDoc & { id?: string }) => void;
  onMarkPrinted?: (order: OrderDoc & { id?: string }) => void;
  onRevertToProcessing?: (order: OrderDoc & { id?: string }) => void;
  onCollected?: (order: OrderDoc & { id?: string }) => void | Promise<void>;
}

function formatTime(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

function coerceDate(input: any): Date | null {
  const d: Date | null = input?.toDate?.() ? input.toDate() : (input ? new Date(input) : null);
  if (!d || isNaN(d.getTime())) return null;
  return d;
}

export function ShopfrontPendingTable({ orders, isWindows, onPrint, onCancel, onMarkPrinted, onRevertToProcessing, onCollected }: ShopfrontPendingTableProps) {
  return (
    <Table className="bg-white">
      <TableHeader>
        <TableRow>
          <TableHead className="px-3">Customer • Document</TableHead>
          <TableHead className="px-3 hidden md:table-cell">Settings</TableHead>
          <TableHead className="px-3">Status</TableHead>
          <TableHead className="px-3 hidden sm:table-cell">Time</TableHead>
          <TableHead className="px-3 hidden sm:table-cell text-right">Total</TableHead>
          <TableHead className="px-3 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => {
          const time = (() => {
            const d = coerceDate(o.timestamp);
            return d ? formatTime(d) : '';
          })();
          const isPrinted = o.status === 'printed';
          return (
            <TableRow key={o.id ?? `${o.userId}-${String(o.timestamp)}`} className={`align-top ${o.emergency ? 'bg-red-50' : ''}`}>
              <TableCell className="px-3">
                <div className="font-medium truncate max-w-[280px]">{o.userName} • {o.fileName}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs sm:hidden">
                  <Badge variant="outline">{o.printSettings?.paperSize}</Badge>
                  <Badge variant="outline">{o.printSettings?.printFormat}</Badge>
                  <Badge className={o.printSettings?.printColor === 'Black & White' ? 'bg-green-600/10 text-green-700 border-green-600/20' : 'bg-blue-600/10 text-blue-700 border-blue-600/20'}>
                    {o.printSettings?.printColor}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="px-3 hidden md:table-cell">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{o.printSettings?.paperSize}</Badge>
                  <Badge variant="outline">{o.printSettings?.printFormat}</Badge>
                  <Badge className={o.printSettings?.printColor === 'Black & White' ? 'bg-green-600/10 text-green-700 border-green-600/20' : 'bg-blue-600/10 text-blue-700 border-blue-600/20'}>
                    {o.printSettings?.printColor}
                  </Badge>
                  <Badge variant="outline">{o.printSettings?.copies} copies • {o.totalPages} pages</Badge>
                </div>
              </TableCell>
              <TableCell className="px-3">
                <div className="flex items-center gap-2">
                  {o.emergency && <Badge variant="destructive">URGENT</Badge>}
                  {!(o.status === 'processing' || o.status === 'printing' || o.status === 'printed') && (
                    <Badge variant="secondary">{o.status}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-3 hidden sm:table-cell text-gray-700">{time}</TableCell>
              <TableCell className="px-3 hidden sm:table-cell text-right">₹{Number(o.totalCost ?? 0).toFixed(0)}</TableCell>
              <TableCell className="px-3">
                <div className="flex flex-wrap gap-2 justify-end">
                  {o.splitFiles ? (
                    <>
                      {o.fileUrl && (
                        <Button size="sm" variant="outline" onClick={() => { if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>Original</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { const url = (o as any).splitFiles?.bwUrl; if (url) window.open(url, '_blank', 'noopener,noreferrer'); }}>B&W</Button>
                      <Button size="sm" variant="outline" onClick={() => { const url = (o as any).splitFiles?.colorUrl; if (url) window.open(url, '_blank', 'noopener,noreferrer'); }}>Color</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => { if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>Open</Button>
                  )}
                  {isWindows && (
                    <Button size="sm" variant="success" onClick={() => onPrint?.(o)}>Print</Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => onCancel?.(o)}>Cancel</Button>
                  {!isPrinted ? (
                    <Button size="sm" variant="secondary" onClick={() => onMarkPrinted?.(o)}>Printed</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => onRevertToProcessing?.(o)}>Undo Printed</Button>
                  )}
                  {!isPrinted ? (
                    <Button size="sm" disabled>Collected</Button>
                  ) : (
                    <Button size="sm" onClick={() => onCollected?.(o)}>Collected</Button>
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

export default ShopfrontPendingTable;


