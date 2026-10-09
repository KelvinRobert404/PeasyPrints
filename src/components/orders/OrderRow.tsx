"use client";

import * as React from 'react';
import type { OrderDoc } from '@/types/models';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type StatusLike = OrderDoc['status'] | 'printed_ready';

export interface OrderRowProps {
  order: OrderDoc & { status?: StatusLike };
  density?: 'regular' | 'compact';
  onClick?: (order: OrderDoc) => void;
}

function statusToBadgeVariant(status: StatusLike | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'printed':
    case 'completed':
    case 'printed_ready':
      return 'default';
    case 'cancelled':
      return 'destructive';
    case 'pending':
    case 'processing':
    case 'printing':
    case 'collected':
    default:
      return 'secondary';
  }
}

function formatDate(ts: any) {
  try {
    const d = (ts?.toDate ? ts.toDate() : new Date(ts)) as Date;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export const OrderRow = React.memo(function OrderRow({ order, density = 'regular', onClick }: OrderRowProps) {
  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-2.5';
  const statusLike = (order.status ?? '') as StatusLike;
  return (
    <TableRow className={`cursor-pointer hover:bg-surface ${rowPadding}`}>
      <TableCell className="px-3" onClick={() => onClick?.(order)}>
        <div className="font-bold text-[12.5px] text-ink truncate max-w-[220px]">{order.fileName}</div>
        <div className="text-[11px] text-slate sm:hidden truncate max-w-[220px]">{order.shopName}</div>
      </TableCell>
      <TableCell className="px-3 hidden sm:table-cell text-text-secondary" onClick={() => onClick?.(order)}>{order.shopName}</TableCell>
      <TableCell className="px-3" onClick={() => onClick?.(order)}>
        <Badge variant={statusToBadgeVariant(statusLike)}>
          {statusLike === 'printed_ready' ? 'Ready' : String(order.status ?? '').replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell className="px-3 hidden md:table-cell text-text-secondary" onClick={() => onClick?.(order)}>{formatDate(order.timestamp)}</TableCell>
      <TableCell className="px-3 hidden sm:table-cell text-right text-ink" onClick={() => onClick?.(order)}>₹{Number(order.totalCost ?? 0).toFixed(0)}</TableCell>
    </TableRow>
  );
});

export default OrderRow;


