'use client';

import type { Shop } from '@/types/models';
import { cn } from '@/lib/utils/cn';
import { ListRow, StatusLine } from '@/components/swoop/primitives';
import { StoreIcon } from '@/components/swoop/icons';
import { shopHours, shopServices } from '@/components/shops/shopMeta';

interface Props {
  shop: Shop;
  onSelect?: (id: string) => void;
  /** Render as a link instead of calling onSelect. */
  href?: string;
  /** Show the street address under the status line. */
  showAddress?: boolean;
  divider?: boolean;
  className?: string;
}

/** 44px shop thumb: the shop's logo when it has one, otherwise a surface tile with a duotone icon. */
export function ShopThumb({ shop, size = 44, className }: { shop: Shop; size?: number; className?: string }) {
  const closed = !shop.isOpen;
  return shop.logoUrl ? (
    <img
      src={shop.logoUrl}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn('block shrink-0 rounded-[10px] bg-surface object-cover', closed && 'opacity-55 grayscale', className)}
    />
  ) : (
    <span
      className={cn('grid shrink-0 place-items-center rounded-[10px] bg-surface text-ink', closed && 'text-text-muted', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <StoreIcon size={Math.round(size * 0.5)} />
    </span>
  );
}

/** Shop row: thumb · name · ● Open • hours • services. */
export function ShopCard({ shop, onSelect, href, showAddress = false, divider = true, className }: Props) {
  const open = Boolean(shop.isOpen);
  const hours = shopHours(shop);
  const services = shopServices(shop);

  return (
    <ListRow
      href={href}
      onClick={href ? undefined : onSelect ? () => onSelect(shop.id) : undefined}
      divider={divider}
      className={className}
      leading={<ShopThumb shop={shop} />}
      title={<span className="font-heading text-[12.5px] leading-[1.15]">{shop.name}</span>}
      subtitle={
        <>
          <span className="flex min-w-0 items-center gap-1">
            <StatusLine open={open} label={open ? 'Open' : 'Closed'} detail={hours} />
            {services.length > 0 && (
              <>
                <span className="text-[11.5px] text-text-muted">•</span>
                <span className="truncate text-[11.5px] font-medium text-slate">{services.join(' · ')}</span>
              </>
            )}
          </span>
          {showAddress && shop.address && <span className="mt-px block truncate">{shop.address}</span>}
        </>
      }
    />
  );
}
