import type { OrderDoc } from '@/types/models';

export function OrderCard({ order }: { order: OrderDoc }) {
  return (
    <div className="w-full border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-1">
        <div className="font-semibold text-sm">{order.shopName}</div>
        <div className="text-xs text-gray-600">{order.status}</div>
      </div>
      <div className="text-xs text-gray-700">{order.fileName}</div>
      <div className="text-xs text-gray-500 mt-1">Pages: {order.totalPages} • Total: ₹{order.totalCost}</div>
    </div>
  );
}
