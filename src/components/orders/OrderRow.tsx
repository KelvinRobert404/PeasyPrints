"use client";

import * as React from 'react';
import type { OrderDoc } from '@/types/models';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export interface OrderRowProps {
  order: OrderDoc & { status?: OrderDoc['status'] | 'printed_ready' };
  density?: 'regular' | 'compact';
  onClick?: (order: OrderDoc) => void;
}

function statusToBadgeVariant(status: OrderRowProps['order']['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
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
  return (
    <TableRow className={`cursor-pointer hover:bg-gray-50 ${rowPadding}`} onClick={() => onClick?.(order)}>
      <TableCell className="px-3">
        <div className="font-medium text-gray-900 truncate max-w-[220px]">{order.fileName}</div>
        <div className="text-xs text-gray-500 sm:hidden truncate max-w-[220px]">{order.shopName}</div>
      </TableCell>
      <TableCell className="px-3 hidden sm:table-cell text-gray-700">{order.shopName}</TableCell>
      <TableCell className="px-3">
        <Badge variant={statusToBadgeVariant(order.status)}>
          {order.status === 'printed_ready' ? 'Ready' : String(order.status ?? '').replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell className="px-3 hidden md:table-cell text-gray-700">{formatDate(order.timestamp)}</TableCell>
      <TableCell className="px-3 hidden sm:table-cell text-right text-gray-900">₹{Number(order.totalCost ?? 0).toFixed(0)}</TableCell>
    </TableRow>
  );
});

export default OrderRow;


