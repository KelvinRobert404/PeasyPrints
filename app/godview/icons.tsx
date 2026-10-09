import type { ReactNode } from 'react';
import type { IconProps } from '@/components/swoop/icons';

/**
 * Godview-only icons. Same pattern as `@/components/swoop/icons`:
 * filled duotone (solid primary + 32% secondary layer), 24px grid, `currentColor`.
 * Shared icons (GridIcon, OrdersIcon, StoreIcon, RupeeIcon, TicketIcon, ShieldCheckIcon,
 * SearchIcon, EditIcon, TrashIcon, CheckIcon, CloseIcon, PlusIcon, ClockIcon, PinIcon, UserIcon,
 * DocIcon, ImageIcon, PrintIcon, LayersIcon, AlertIcon, InfoIcon, ChevronRightIcon ...) come from the shared set.
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

/* ── Navigation ─────────────────────────────────────────── */
export const MegaphoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M6 15.5h3.2l1.3 4.6a1.4 1.4 0 0 1-1.4 1.8H8a1.5 1.5 0 0 1-1.4-1Z" />
    <path d="M3 10a2.5 2.5 0 0 1 2.5-2.5H9l8.1-4.3A1.3 1.3 0 0 1 19 4.4v15.2a1.3 1.3 0 0 1-1.9 1.2L9 16.5H5.5A2.5 2.5 0 0 1 3 14Z" />
    <rect opacity={D2} x="20" y="9.5" width="2.2" height="5" rx="1.1" />
  </Svg>
);

export const CapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M6 11.5v4.3c0 1.6 2.7 3.7 6 3.7s6-2.1 6-3.7v-4.3l-6 3.1Z" />
    <path d="M11.3 3.7a1.6 1.6 0 0 1 1.4 0l9.2 4.6a.8.8 0 0 1 0 1.4l-9.2 4.6a1.6 1.6 0 0 1-1.4 0L2.1 9.7a.8.8 0 0 1 0-1.4Z" />
    <rect x="19.6" y="9" width="1.9" height="7" rx=".95" />
  </Svg>
);

export const WalletIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" />
    <path d="M4 6.2A2.5 2.5 0 0 1 6 3.3l9.6-1.6A1.5 1.5 0 0 1 17.4 3.2V5H5.5c-.6 0-1.1.4-1.5 1.2Z" />
    <path d="M15 11h6v4.5h-6a2.25 2.25 0 0 1 0-4.5Z" />
  </Svg>
);

export const FlagIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="2.5" width="2.4" height="19.5" rx="1.2" />
    <path opacity={D2} d="M6.4 4h12.1a1 1 0 0 1 .8 1.6L16.5 9.5l2.8 3.9a1 1 0 0 1-.8 1.6H6.4Z" />
  </Svg>
);

export const FilmIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="3" y="3" width="18" height="18" rx="3" />
    <path d="M10 8.7v6.6a.8.8 0 0 0 1.2.7l5.2-3.3a.8.8 0 0 0 0-1.4l-5.2-3.3a.8.8 0 0 0-1.2.7Z" />
    <path {...SK} strokeWidth={2} d="M7 3v18M3 8h4M3 16h4" />
  </Svg>
);

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={2.8} d="M4 6.5h16M4 12h16M4 17.5h10" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 3a6 6 0 0 0-6 6v3.6L4.4 15.4A1 1 0 0 0 5.3 17h13.4a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Z" />
    <path d="M9 18.5h6a3 3 0 0 1-6 0Z" />
    <rect x="10.8" y="1.5" width="2.4" height="3" rx="1.2" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="m14.5 6-6 6 6 6" />
  </Svg>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="M12 19V5.5M6 11l6-6 6 6" />
  </Svg>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="M12 5v13.5M6 13l6 6 6-6" />
  </Svg>
);

/* ── Actions ────────────────────────────────────────────── */
export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="2.1" />
    <circle cx="12" cy="12" r="2.1" />
    <circle cx="18.5" cy="12" r="2.1" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M20.5 3.8v5.4a.8.8 0 0 1-.8.8h-5.4a.6.6 0 0 1-.4-1L19.5 3.4a.6.6 0 0 1 1 .4Z" />
  </Svg>
);

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 5C6.6 5 3 9.4 2 11.4a1.4 1.4 0 0 0 0 1.2C3 14.6 6.6 19 12 19s9-4.4 10-6.4a1.4 1.4 0 0 0 0-1.2C21 9.4 17.4 5 12 5Z" />
    <circle cx="12" cy="12" r="3.6" />
  </Svg>
);

export const EyeOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 5C6.6 5 3 9.4 2 11.4a1.4 1.4 0 0 0 0 1.2C3 14.6 6.6 19 12 19s9-4.4 10-6.4a1.4 1.4 0 0 0 0-1.2C21 9.4 17.4 5 12 5Z" />
    <path {...SK} strokeWidth={2.6} d="M4 4l16 16" />
  </Svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="3" y="5" width="16" height="16" rx="3" />
    <path {...SK} d="M11 13 20.5 3.5M14 3.5h6.5V10" />
  </Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M3 14h18v4.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5Z" />
    <path {...SK} d="M12 3v11M7.5 9.5 12 14l4.5-4.5" />
  </Svg>
);

export const SaveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M5.5 3H16l5 5v10.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3Z" />
    <rect x="7" y="3" width="8" height="5" rx="1" />
    <rect x="7" y="13" width="10" height="8" rx="1.5" />
  </Svg>
);

/* ── Data ───────────────────────────────────────────────── */
export const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="2.5" y="4.5" width="19" height="15" rx="3" />
    <path {...SK} d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="5.5" y="2" width="13" height="20" rx="3" />
    <rect x="9.5" y="17.5" width="5" height="2" rx="1" />
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle opacity={D2} cx="12" cy="12" r="10" />
    <path {...SK} strokeWidth={2} d="M2.5 12h19M12 2.2c2.6 2.7 3.9 6 3.9 9.8s-1.3 7.1-3.9 9.8c-2.6-2.7-3.9-6-3.9-9.8S9.4 4.9 12 2.2Z" />
  </Svg>
);

export const PercentIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle opacity={D2} cx="12" cy="12" r="10" />
    <circle cx="8.6" cy="8.6" r="2" />
    <circle cx="15.4" cy="15.4" r="2" />
    <path {...SK} strokeWidth={2.2} d="m16 8-8 8" />
  </Svg>
);
