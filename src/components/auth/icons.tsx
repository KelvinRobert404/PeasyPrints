import type { ReactNode } from 'react';
import type { IconProps } from '@/components/swoop/icons';

/**
 * Extra Swoop icons for auth, account and info screens.
 * Same pattern as `@/components/swoop/icons`: filled duotone, solid shape + 32% layer, `currentColor`, 24px grid.
 */

const SK = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const;

const D2 = 0.32;

function Svg({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="3" y="13" width="18" height="8.5" rx="2.5" />
    <path {...SK} d="M12 3v11M7.5 9.5 12 14l4.5-4.5" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 2.5a9.5 9.5 0 0 0-8.3 14.1L2.5 21.5l5-1.3A9.5 9.5 0 1 0 12 2.5Z" />
    <path
      transform="translate(6.6 6.6) scale(0.45)"
      d="M20 15.4c-1.2 0-2.4-.2-3.5-.6a1 1 0 0 0-1 .2l-1.6 2c-2.8-1.4-5.5-3.9-6.9-6.8l2-1.7c.3-.3.3-.7.2-1-.4-1.1-.6-2.3-.6-3.5 0-.5-.4-1-1-1H4.2C3.7 3 3 3.2 3 4c0 9.3 7.7 17 17 17 .7 0 1-.6 1-1.2v-3.4c0-.6-.4-1-1-1Z"
    />
  </Svg>
);

export const BugIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} opacity={D2} d="M3 13h3M18 13h3M4 7.5l3 2M20 7.5l-3 2M4 19l3-2.5M20 19l-3-2.5" />
    <path d="M12 6.5c3.3 0 6 2.7 6 6v2.5a6 6 0 0 1-12 0v-2.5c0-3.3 2.7-6 6-6Z" />
    <path opacity={D2} d="M8.5 6.5a3.5 3.5 0 0 1 7 0Z" />
  </Svg>
);

export const BulbIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 2.5a7 7 0 0 0-4 12.7V17h8v-1.8a7 7 0 0 0-4-12.7Z" />
    <rect x="8.5" y="18.3" width="7" height="2" rx="1" />
    <rect x="10" y="21" width="4" height="1.6" rx=".8" />
    <path {...SK} strokeWidth={2} d="M12 8v5" />
  </Svg>
);

export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="2.5" y="2.5" width="19" height="19" rx="4" />
    <rect x="6.5" y="12" width="2.6" height="6" rx="1.3" />
    <rect x="10.7" y="7" width="2.6" height="11" rx="1.3" />
    <rect x="14.9" y="10" width="2.6" height="8" rx="1.3" />
  </Svg>
);
