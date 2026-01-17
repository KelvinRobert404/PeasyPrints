import Link from 'next/link';
import { haptics } from '@/lib/utils/haptics';
import type { OrderDoc } from '@/types/models';

function formatDate(timestamp: any) {
  try {
    const d = (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)) as Date;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function getStatusStyle(status: string) {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700';
    case 'ready':
      return 'bg-blue-50 text-blue-700';
    case 'cancelled':
      return 'bg-red-50 text-red-600';
    case 'printing':
    case 'processing':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function OrderCard({ order }: { order: OrderDoc }) {
  const href = order.id ? `/orders/${order.id}/pickup` : undefined;
  const isActive = ['pending', 'processing', 'printing', 'ready'].includes(order.status?.toLowerCase() || '');

  const content = (
    <div className={`
      bg-white border rounded-xl p-4
      ${isActive ? 'border-blue-200' : 'border-gray-200'}
      active:bg-gray-50 transition-colors
    `}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: Shop & File */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[15px] text-gray-900 truncate">{order.shopName}</div>
          <div className="text-sm text-gray-500 truncate mt-0.5">{order.fileName}</div>
        </div>

        {/* Right: Status & Date */}
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium capitalize ${getStatusStyle(order.status)}`}>
            {order.status}
          </span>
          <span className="text-[11px] text-gray-400">{formatDate(order.timestamp)}</span>
        </div>
      </div>

      {/* CTA for active orders */}
      {isActive && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
            <span className="material-symbols-rounded text-sm">qr_code_2</span>
            Tap to view pickup code
          </div>
        </div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block" onClick={() => haptics.tap()}>{content}</Link>
  ) : (
    content
  );
}
