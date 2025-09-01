import Link from 'next/link';
import type { OrderDoc } from '@/types/models';
import { Card } from '@/components/ui/card';

function isToday(timestamp: any) {
  try {
    const d = (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)) as Date;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  } catch {
    return false;
  }
}

function formatDate(timestamp: any) {
  try {
    const d = (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)) as Date;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export function OrderCard({ order }: { order: OrderDoc }) {
  const showCta = isToday(order.timestamp);
  const href = order.id ? `/orders/${order.id}/pickup` : undefined;
  const content = (
    <Card className="bg-white border border-black rounded-2xl p-5 mb-3">
      <div className="flex items-start justify-between">
        <div className="text-black">
          <div className="font-semibold text-[14px] leading-none mb-1">{order.shopName}</div>
          <div className="text-[12px] text-gray-700">{order.fileName}</div>
        </div>
        <div className="text-[12px] text-black text-bold text-right">
          <div className="capitalize">{order.status}</div>
          <div className="text-[10px]">{formatDate(order.timestamp)}</div>
        </div>
      </div>
      {showCta && (
        <div className="mt-2 text-[10px] uppercase font-bold text-black">
          Ready to collect? Click here for your pickup screen.
        </div>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="block">{content}</Link>
  ) : (
    content
  );
}
