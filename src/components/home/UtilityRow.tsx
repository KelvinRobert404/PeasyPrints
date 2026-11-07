import type { ComponentType } from 'react';
import { cn } from '@/lib/utils/cn';
import { SmallTile } from '@/components/swoop/primitives';
import { BallIcon, BloodDropIcon, DealIcon, LostFoundIcon, type IconProps } from '@/components/swoop/icons';

type UtilityTile = {
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
  tone: 'ink' | 'royal' | 'market' | 'girls';
};

const UTILITY_TILES: readonly UtilityTile[] = [
  { label: 'Student deals', href: '/campus/deals', icon: DealIcon, tone: 'royal' },
  { label: 'Lost and found', href: '/campus/lost-found', icon: LostFoundIcon, tone: 'ink' },
  { label: 'Blood donors', href: '/campus/blood', icon: BloodDropIcon, tone: 'market' },
  { label: 'Games', href: '/campus/games', icon: BallIcon, tone: 'ink' }
];

/** Home: the four campus utilities, one row of small tiles. */
export function UtilityRow({ className }: { className?: string }) {
  return (
    <nav aria-label="Campus utilities" className={cn('grid grid-cols-4 gap-1.5', className)}>
      {UTILITY_TILES.map((tile) => (
        <SmallTile key={tile.href} label={tile.label} href={tile.href} icon={tile.icon} tone={tile.tone} />
      ))}
    </nav>
  );
}

export default UtilityRow;
