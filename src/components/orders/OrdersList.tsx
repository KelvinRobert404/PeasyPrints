"use client";

import * as React from 'react';
import type { OrderDoc } from '@/types/models';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface OrdersListProps {
  orders: OrderDoc[];
  isLoading?: boolean;
  error?: string | null;
  enableSelection?: boolean;
  onOrderClick?: (order: OrderDoc) => void;
  density?: 'regular' | 'compact';
}

function isToday(ts: any) {
  try {
    const d = (ts?.toDate ? ts.toDate() : new Date(ts)) as Date;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  } catch {
    return false;
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

function statusToBadgeVariant(status: OrderDoc['status'] | 'printed_ready'): 'default' | 'secondary' | 'destructive' | 'outline' {
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

export function OrdersList({ orders, isLoading, error, onOrderClick, density = 'regular' }: OrdersListProps) {
  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-2.5';

  const { todayOrders, olderOrders } = React.useMemo(() => {
    const today = orders.filter((o) => isToday(o.timestamp));
    const older = orders.filter((o) => !isToday(o.timestamp));
    return { todayOrders: today, olderOrders: older };
  }, [orders]);

  return (
    <div className="w-full">
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}

      {isLoading && (
        <div className="space-y-2 mb-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      )}

      {!isLoading && orders.length === 0 && !error && (
        <div className="text-sm text-gray-600">No orders yet</div>
      )}

      {todayOrders.length > 0 && (
        <div className="mb-2 text-xs font-semibold text-gray-700">Today</div>
      )}

      {todayOrders.length > 0 && (
        <Table className="bg-white">
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">Document</TableHead>
              <TableHead className="px-3 hidden sm:table-cell">Shop</TableHead>
              <TableHead className="px-3">Status</TableHead>
              <TableHead className="px-3 hidden md:table-cell">Date</TableHead>
              <TableHead className="px-3 hidden sm:table-cell text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {todayOrders.map((order) => (
              <TableRow key={order.id ?? `${order.userId}-${order.timestamp}`}
                className={`cursor-pointer hover:bg-gray-50 ${rowPadding}`}
              >
                <TableCell className="px-3" onClick={() => onOrderClick?.(order)}>
                  <div className="font-medium text-gray-900 truncate max-w-[220px]">{order.fileName}</div>
                  <div className="text-xs text-gray-500 sm:hidden truncate max-w-[220px]">{order.shopName}</div>
                </TableCell>
                <TableCell className="px-3 hidden sm:table-cell text-gray-700" onClick={() => onOrderClick?.(order)}>{order.shopName}</TableCell>
                <TableCell className="px-3" onClick={() => onOrderClick?.(order)}>
                  <Badge variant={statusToBadgeVariant((order as any).status)}>
                    {((order as any).status === 'printed_ready') ? 'Ready' : String(order.status).replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 hidden md:table-cell text-gray-700" onClick={() => onOrderClick?.(order)}>{formatDate(order.timestamp)}</TableCell>
                <TableCell className="px-3 hidden sm:table-cell text-right text-gray-900" onClick={() => onOrderClick?.(order)}>₹{Number(order.totalCost ?? 0).toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {olderOrders.length > 0 && (
        <div className="mt-4 mb-2 text-xs font-semibold text-gray-700">Older</div>
      )}

      {olderOrders.length > 0 && (
        <Table className="bg-white">
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">Document</TableHead>
              <TableHead className="px-3 hidden sm:table-cell">Shop</TableHead>
              <TableHead className="px-3">Status</TableHead>
              <TableHead className="px-3 hidden md:table-cell">Date</TableHead>
              <TableHead className="px-3 hidden sm:table-cell text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {olderOrders.map((order) => (
              <TableRow key={order.id ?? `${order.userId}-${order.timestamp}-older`}
                className={`cursor-pointer hover:bg-gray-50 ${rowPadding}`}
              >
                <TableCell className="px-3" onClick={() => onOrderClick?.(order)}>
                  <div className="font-medium text-gray-900 truncate max-w-[220px]">{order.fileName}</div>
                  <div className="text-xs text-gray-500 sm:hidden truncate max-w-[220px]">{order.shopName}</div>
                </TableCell>
                <TableCell className="px-3 hidden sm:table-cell text-gray-700" onClick={() => onOrderClick?.(order)}>{order.shopName}</TableCell>
                <TableCell className="px-3" onClick={() => onOrderClick?.(order)}>
                  <Badge variant={statusToBadgeVariant((order as any).status)}>
                    {((order as any).status === 'printed_ready') ? 'Ready' : String(order.status).replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 hidden md:table-cell text-gray-700" onClick={() => onOrderClick?.(order)}>{formatDate(order.timestamp)}</TableCell>
                <TableCell className="px-3 hidden sm:table-cell text-right text-gray-900" onClick={() => onOrderClick?.(order)}>₹{Number(order.totalCost ?? 0).toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default OrdersList;


