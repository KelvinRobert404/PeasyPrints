// 'Furnish your room' tiles: room art, typical price and how many are near
// you. No hooks, so it renders on the server too.

import Link from 'next/link';
import { ROOM_ART } from '@/components/swoop/illustrations-room';
import { SectionHeader } from '@/components/swoop/primitives';
import { FURNISH_TILES, type FurnishTileId } from '@/lib/campus/market';
import { formatPrice } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';

function countText(n: number): string {
  return n > 0 ? `${n} near you` : 'None yet';
}

/**
 * Eight furnish tiles, 4-up (8-up when the section is 36rem or wider). `counts` comes from groupMarketFeed().furnishCounts.
 * Each tile links to `${hrefBase}${id}`.
 */
export function FurnishTiles({
  counts,
  title = 'Furnish your room',
  hrefBase = '/marketplace?furnish=',
  className,
}: {
  counts?: Partial<Record<FurnishTileId, number>>;
  /** Section title. Pass null to leave it out. */
  title?: string | null;
  hrefBase?: string;
  className?: string;
}) {
  return (
    <section className={cn('@container min-w-0', className)} aria-label={title ?? 'Furnish your room'}>
      {title ? <SectionHeader title={title} className="mb-2" /> : null}
      <ul className="grid grid-cols-4 gap-1.5 @xl:grid-cols-8">
        {FURNISH_TILES.map((tile) => {
          const Art = ROOM_ART[tile.id];
          const count = counts?.[tile.id] ?? 0;
          return (
            <li key={tile.id} className="min-w-0">
              <Link
                href={`${hrefBase}${tile.id}`}
                className="campus-press flex min-h-[112px] flex-col items-center gap-0.5 rounded-[12px] bg-surface px-1 pb-1.5 pt-1 text-center text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
              >
                <Art width={56} height={51} />
                <span className="w-full truncate text-[11px] font-bold leading-[1.2]">{tile.label}</span>
                <span className="w-full truncate text-[10px] font-semibold leading-[1.2] text-slate">About {formatPrice(tile.typicalPrice)}</span>
                <span className={cn('w-full truncate text-[10px] font-bold leading-[1.2]', count > 0 ? 'text-go-text' : 'text-slate')}>
                  {countText(count)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
