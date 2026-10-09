'use client';

import { haptics } from '@/lib/utils/haptics';
import type { OrderDoc } from '@/types/models';
import { IconTile, ListRow, StatusLine, Tag } from '@/components/swoop/primitives';
import { ChevronRightIcon, DocIcon, QrIcon } from '@/components/swoop/icons';
import { formatOrderDate, orderStatusMeta } from '@/components/orders/orderStatus';

/** Dense order row: file · ● status • shop · price/date. Taps through to the pickup screen. */
export function OrderCard({ order, divider = true }: { order: OrderDoc; divider?: boolean }) {
  const href = order.id ? `/orders/${order.id}/pickup` : undefined;
  const meta = orderStatusMeta(order.status);
  const cancelled = order.status === 'cancelled';

  const row = (
    <ListRow
      href={href}
      divider={divider}
      leading={<IconTile icon={meta.ready ? QrIcon : DocIcon} tone={meta.ready ? 'go' : 'surface'} shape="square" size={36} iconSize={18} />}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{order.fileName}</span>
          {order.emergency && <Tag tone="royal" className="shrink-0">Rush</Tag>}
          {order.afterDark && <Tag tone="ink" className="shrink-0">After dark</Tag>}
        </span>
      }
      subtitle={<StatusLine open={meta.ready} label={meta.label} detail={order.shopName} />}
      trailing={
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="flex flex-col items-end gap-px">
            <span className={`text-[12.5px] font-bold tabular-nums ${cancelled ? 'text-slate line-through' : 'text-ink'}`}>
              ₹{Number(order.totalCost ?? 0)}
            </span>
            <span className="text-[11px] text-slate">{formatOrderDate(order.timestamp)}</span>
          </span>
          {href && <ChevronRightIcon size={12} className="text-text-muted" />}
        </span>
      }
    />
  );

  // Haptic tick on tap, as before; the row itself is the link.
  return href ? <div onClickCapture={() => haptics.tap()}>{row}</div> : row;
}
