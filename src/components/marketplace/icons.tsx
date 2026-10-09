import type { ReactNode } from 'react';
import type { IconProps } from '@/components/swoop/icons';

/**
 * Marketplace-only icons that are missing from the shared Swoop set.
 * Same pattern as `@/components/swoop/icons`: filled duotone (solid + 32% layer), `currentColor`, 24px grid.
 */
const D2 = 0.32;

function Svg({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const FlagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M6 4h12.2a.8.8 0 0 1 .64 1.28L16.5 8.5l2.34 3.22a.8.8 0 0 1-.64 1.28H6Z" />
    <rect x="4" y="3" width="2.4" height="18" rx="1.2" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" />
    <circle cx="8" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="16" cy="12" r="1.4" />
  </Svg>
);
