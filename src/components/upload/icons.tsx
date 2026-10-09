import type { ReactNode } from 'react';
import type { IconProps } from '@/components/swoop/icons';

/**
 * Print-flow icons missing from the shared Swoop set.
 * Same pattern as `@/components/swoop/icons`: filled duotone (solid + 32% layer),
 * 24px grid, `currentColor`.
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

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="m14.5 6-6 6 6 6" />
  </Svg>
);

/** Rush upgrade. */
export const BoltIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle opacity={D2} cx="12" cy="12" r="9.5" />
    <path d="M13.2 3.5 6.8 13.1a.6.6 0 0 0 .5.9h3.9l-1.1 6.5 6.4-9.6a.6.6 0 0 0-.5-.9h-3.9Z" />
  </Svg>
);

/** After-dark upgrade. */
export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="m18 3 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
    <path d="M14.5 4.2A8.5 8.5 0 1 0 19.8 15a7 7 0 0 1-5.3-10.8Z" />
  </Svg>
);

/** Indeterminate progress; pair with `animate-spin`. */
export const SpinnerIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle {...SK} opacity={D2} cx="12" cy="12" r="8.5" />
    <path {...SK} d="M20.5 12A8.5 8.5 0 0 0 12 3.5" />
  </Svg>
);
