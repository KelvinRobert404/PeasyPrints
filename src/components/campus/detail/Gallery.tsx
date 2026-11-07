import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@/components/swoop/icons';
import { cn } from '@/lib/utils/cn';

type Props = {
  /** Student uploads only. */
  images: readonly string[];
  title: string;
  /** Icon for a post with no photo. */
  fallback: ComponentType<IconProps>;
  /** Swoop art for a post with no photo; wins over the icon. */
  art?: ReactNode;
  className?: string;
};

/**
 * Listing photos: one photo, a swipeable row, or an icon or art tile when the
 * student added none. Never a stock photo. Works in server and client components.
 */
export function Gallery({ images, title, fallback: Fallback, art, className }: Props) {
  if (!images.length) {
    return (
      <div className={cn('grid aspect-[4/3] place-items-center rounded-[14px] bg-surface', className)}>
        {art ?? <Fallback size={44} className="text-text-muted" aria-hidden="true" />}
        <span className="sr-only">No photos yet</span>
      </div>
    );
  }

  if (images.length === 1) {
    return <img src={images[0]} alt={title} className={cn('aspect-[4/3] w-full rounded-[14px] bg-surface object-cover', className)} />;
  }

  return (
    <div className={cn('relative', className)}>
      <div
        role="group"
        aria-label={`${images.length} photos of ${title}`}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto rounded-[14px] no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
      >
        {images.map((src, index) => (
          <img
            key={`${src}-${index}`}
            src={src}
            alt={index === 0 ? title : `${title}, photo ${index + 1}`}
            className="aspect-[4/3] w-[88%] shrink-0 snap-start rounded-[14px] bg-surface object-cover"
          />
        ))}
      </div>
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-white" aria-hidden="true">
        {images.length} photos
      </span>
    </div>
  );
}
