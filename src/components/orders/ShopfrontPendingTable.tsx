"use client";

import * as React from 'react';
import type { OrderDoc } from '@/types/models';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Printer, X, Check, RotateCcw } from 'lucide-react';

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
      <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
        <TableRow>
          <TableHead className="px-3">Customer • Document</TableHead>
          <TableHead className="px-3 hidden md:table-cell">Configuration</TableHead>
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
          const ps = o.printSettings as any;
          const copiesNum = Number(ps?.copies ?? 1);
          const pagesNum = Number(o.totalPages ?? 0);
          const copiesLabel = `${copiesNum} ${copiesNum === 1 ? 'copy' : 'copies'}`;
          const pagesLabel = `${pagesNum} ${pagesNum === 1 ? 'page' : 'pages'}`;
          const blueSummary = `${copiesLabel} • ${pagesLabel} • ₹${Number(o.totalCost ?? 0).toFixed(0)}`;
          const { greenSummary, isNormal } = (() => {
            const diffs: string[] = [];
            if (ps?.paperSize && ps.paperSize !== 'A4') diffs.push(String(ps.paperSize));
            if (ps?.printFormat === 'Double-Sided') diffs.push('DS'); // SS is default
            if (ps?.printColor && ps.printColor !== 'Black & White') diffs.push('Color'); // BW is default
            const normalOrDiff = diffs.length ? diffs.join(' • ') : 'Normal';
            const summary = time ? `${time} • ${normalOrDiff}` : normalOrDiff;
            return { greenSummary: summary, isNormal: diffs.length === 0 };
          })();
          const greenClass = isNormal
            ? 'bg-black/10 text-black border-black/20'
            : 'bg-green-600/10 text-green-700 border-green-600/20';
          return (
            <TableRow
              key={o.id ?? `${o.userId}-${String(o.timestamp)}`}
              className={`align-middle ${o.emergency ? 'border-l-4 border-red-400' : ''}`}
            >
              <TableCell className="px-3">
                <div
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (isWindows) onPrint?.(o);
                      else if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer');
                    }
                    if (e.key === 'Enter' && e.shiftKey) {
                      if ((o as any).status !== 'printed') onMarkPrinted?.(o);
                      else onRevertToProcessing?.(o);
                    }
                  }}
                >
                  <div className="font-semibold text-gray-900 truncate max-w-[280px]">{o.userName}</div>
                  <div className="flex items-center gap-2">
                    <div className="truncate max-w-[240px]" title={o.fileName}>{o.fileName}</div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hidden sm:inline-flex" title="Click to open file" aria-label="Open file" onClick={() => { if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="sm:hidden mt-1 text-xs text-gray-600 flex items-center gap-2">
                    <Badge variant="secondary">{o.status}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs sm:hidden">
                    <Badge className={`whitespace-nowrap ${greenClass} text-sm px-3 py-1`}>{greenSummary}</Badge>
                    <Badge className="whitespace-nowrap bg-blue-600/10 text-blue-700 border-blue-600/20 text-sm px-3 py-1">{blueSummary}</Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-3 hidden md:table-cell align-middle">
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <Badge className={`whitespace-nowrap ${greenClass} text-sm px-3 py-1`}>{greenSummary}</Badge>
                  <Badge className="whitespace-nowrap bg-blue-600/10 text-blue-700 border-blue-600/20 text-sm px-3 py-1">{blueSummary}</Badge>
                </div>
              </TableCell>
              {/* Time column removed; time is included in condensed badge */}
              <TableCell className="px-3 align-middle">
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {o.splitFiles ? (
                    <>
                      {o.fileUrl && (
                        <Button size="sm" className="h-8 px-2" variant="outline" title="Open original file" aria-label="Open original file" onClick={() => { if (o.fileUrl) window.open(o.fileUrl, '_blank', 'noopener,noreferrer'); }}>Original</Button>
                      )}
                      <Button size="sm" className="h-8 px-2" variant="outline" title="Open black and white file" aria-label="Open black and white file" onClick={() => { const url = (o as any).splitFiles?.bwUrl; if (url) window.open(url, '_blank', 'noopener,noreferrer'); }}>B&W</Button>
                      <Button size="sm" className="h-8 px-2" variant="outline" title="Open color file" aria-label="Open color file" onClick={() => { const url = (o as any).splitFiles?.colorUrl; if (url) window.open(url, '_blank', 'noopener,noreferrer'); }}>Color</Button>
                    </>
                  ) : null}
                  {isWindows && (
                    <Button size="sm" variant="success" title="Click to print" aria-label="Print" onClick={() => onPrint?.(o)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  )}
                  {!isPrinted ? (
                    <Button size="sm" variant="secondary" title="Mark as printed" aria-label="Mark as printed" onClick={() => onMarkPrinted?.(o)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" title="Undo printed" aria-label="Undo printed" onClick={() => onRevertToProcessing?.(o)}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  {!isPrinted ? (
                    <Button size="sm" disabled title="Mark as collected">Collected</Button>
                  ) : (
                    <Button size="sm" title="Click when customer collects" aria-label="Mark as collected" onClick={() => onCollected?.(o)}>Collected</Button>
                  )}
                  <Button size="sm" variant="destructive" title="Cancel this order" aria-label="Cancel order" onClick={() => onCancel?.(o)}>
                    <X className="h-4 w-4" />
                  </Button>
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
