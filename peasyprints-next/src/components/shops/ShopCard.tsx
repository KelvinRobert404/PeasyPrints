import Image from 'next/image';
import type { Shop } from '@/types/models';
import { cn } from '@/lib/utils/cn';

interface Props {
  shop: Shop;
  onSelect: (id: string) => void;
}

export function ShopCard({ shop, onSelect }: Props) {
  return (
    <div
      className={cn(
        'w-full rounded-xl border bg-white p-4 mb-4 shadow-sm',
        'hover:shadow-md transition-shadow active:scale-[0.99]'
      )}
      onClick={() => onSelect(shop.id)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        {shop.logoUrl ? (
          <Image src={shop.logoUrl} alt={shop.name} width={56} height={56} className="rounded-md object-cover" />
        ) : (
          <div className="w-14 h-14 bg-gray-100 rounded-md" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate">{shop.name}</div>
          <div className="text-xs text-gray-600 line-clamp-2">{shop.address}</div>
          {shop.timing && <div className="text-xs text-gray-500 mt-1">{shop.timing}</div>}
        </div>
      </div>
    </div>
  );
}
