import type { ReactNode, SVGProps } from 'react';

/**
 * Swoop icon set — filled duotone.
 * Solid primary shape + a 32% secondary layer, 24px grid, coloured with `currentColor`.
 * Use 20–24px in UI. Never outline-only, never emoji.
 * Need one that isn't here? Add it in your feature folder following the same pattern.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

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
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
    <path d="M9.5 21v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V21Z" />
    <path {...SK} d="M2 11.5 12 3l10 8.5" />
  </Svg>
);

export const PrintIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M7 3h10v5H7Z" />
    <rect x="2.5" y="8" width="19" height="9.5" rx="2.5" />
    <rect x="7" y="13" width="10" height="8" rx="1.2" fill="#FFFFFF" stroke="currentColor" strokeWidth={2} />
  </Svg>
);

export const MarketIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M3 4.5V11c0 .5.2 1 .6 1.4l8.5 8.5a2 2 0 0 0 2.8 0l6-6a2 2 0 0 0 0-2.8L12.4 3.6A2 2 0 0 0 11 3H4.5A1.5 1.5 0 0 0 3 4.5Z" />
    <circle cx="7.8" cy="7.8" r="2.2" />
  </Svg>
);

export const HousingIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9.5 21v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4Z" />
    <rect x="7.5" y="6.5" width="3" height="2.5" rx=".6" />
    <rect x="13.5" y="6.5" width="3" height="2.5" rx=".6" />
    <rect x="7.5" y="11" width="3" height="2.5" rx=".6" />
    <rect x="13.5" y="11" width="3" height="2.5" rx=".6" />
  </Svg>
);

export const OrdersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M5 2.5h14v19l-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5L7.3 20 5 21.5Z" />
    <rect x="8" y="7" width="8" height="2" rx="1" />
    <rect x="8" y="11" width="8" height="2" rx="1" />
    <rect x="8" y="15" width="5" height="2" rx="1" />
  </Svg>
);

export const CanteenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} opacity={D2} d="M8 3.5v4M12 2.5v5M16 3.5v4" />
    <path d="M2.5 10.5h19a.5.5 0 0 1 .5.5A9.5 9.5 0 0 1 12.5 20.5h-1A9.5 9.5 0 0 1 2 11a.5.5 0 0 1 .5-.5Z" />
  </Svg>
);

export const GirlsSpaceIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="4" y="10" width="16" height="11.5" rx="3" />
    <path {...SK} d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    <path d="M12 19.2s-3-1.8-3-3.6c0-.9.7-1.6 1.6-1.6.6 0 1.1.3 1.4.8.3-.5.8-.8 1.4-.8.9 0 1.6.7 1.6 1.6 0 1.8-3 3.6-3 3.6Z" />
  </Svg>
);

export const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" />
    <circle cx="8" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="16" cy="12" r="1.5" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" />
    <rect opacity={D2} x="13" y="3.5" width="7.5" height="7.5" rx="2" />
    <rect opacity={D2} x="3.5" y="13" width="7.5" height="7.5" rx="2" />
    <rect x="13" y="13" width="7.5" height="7.5" rx="2" />
  </Svg>
);

/* ── Actions & UI ───────────────────────────────────────── */
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle opacity={D2} cx="10.5" cy="10.5" r="6.5" />
    <circle {...SK} cx="10.5" cy="10.5" r="6.5" />
    <path {...SK} strokeWidth={3} d="m15.6 15.6 4.9 4.9" />
  </Svg>
);

export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M6.5 2.5H14l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path {...SK} d="M12 17.5v-6.5M9 13.5l3-3 3 3" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="M5 12h14" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={2.8} d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="M19 12H5.5M11 5.5 4.5 12l6.5 6.5" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="m9.5 6 6 6-6 6" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} strokeWidth={3} d="M5 12h13M13 6.5 18.5 12 13 17.5" />
  </Svg>
);

export const CaretDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 9.5h11l-5.5 6Z" />
  </Svg>
);

export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path {...SK} d="M4 7h9M19 7h1M4 17h3M13 17h7" />
    <circle cx="16" cy="7" r="2.6" />
    <circle cx="10" cy="17" r="2.6" />
  </Svg>
);

export const BookmarkIcon = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    {filled ? (
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z" />
    ) : (
      <path {...SK} d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z" />
    )}
  </Svg>
);

export const EditIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19Z" />
    <path {...SK} d="M14 6.5l3.5 3.5" />
    <path d="M4 20l4.5-1-3.5-3.5Z" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M6 7h12l-1 13a1.5 1.5 0 0 1-1.5 1.4h-7A1.5 1.5 0 0 1 7 20Z" />
    <rect x="4" y="4.5" width="16" height="2.5" rx="1.25" />
    <rect x="9.5" y="2.5" width="5" height="2.5" rx="1" />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M5 10h14v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" />
    <path {...SK} d="M12 14V3M8 7l4-4 4 4" />
  </Svg>
);

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="8" y="8" width="13" height="13" rx="2.5" />
    <path d="M5.5 3h9A2.5 2.5 0 0 1 17 5.5V6H8a2 2 0 0 0-2 2v9h-.5A2.5 2.5 0 0 1 3 14.5v-9A2.5 2.5 0 0 1 5.5 3Z" />
  </Svg>
);

export const LogOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M4 4h9v16H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    <path {...SK} d="M11 12h10M17 8l4 4-4 4" />
  </Svg>
);

export const SettingsIcon = FilterIcon;

/* ── Status & info ──────────────────────────────────────── */
export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle opacity={D2} cx="12" cy="12" r="10" />
    <rect x="11" y="10.5" width="2.2" height="7" rx="1.1" />
    <circle cx="12.1" cy="7.3" r="1.4" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M10.3 3.9a2 2 0 0 1 3.4 0l8 13.6A2 2 0 0 1 20 20.5H4a2 2 0 0 1-1.7-3Z" />
    <rect x="11" y="8.5" width="2.2" height="6.5" rx="1.1" />
    <circle cx="12.1" cy="17.4" r="1.3" />
  </Svg>
);

export const ShieldCheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 2.5 4.5 5.3v5.9c0 4.8 3.2 8.6 7.5 10.3 4.3-1.7 7.5-5.5 7.5-10.3V5.3Z" />
    <path {...SK} strokeWidth={2.6} d="m8.7 12 2.3 2.3 4.4-4.6" />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="4" y="10" width="16" height="11.5" rx="3" />
    <path {...SK} d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    <rect x="11" y="13.5" width="2.2" height="4.5" rx="1.1" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle opacity={D2} cx="12" cy="12" r="9" />
    <path {...SK} strokeWidth={3} d="M12 7v5l3.5 2" />
  </Svg>
);

export const TicketIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M3.5 7A2.5 2.5 0 0 1 6 4.5h12A2.5 2.5 0 0 1 20.5 7v2.2a2.8 2.8 0 0 0 0 5.6V17a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17v-2.2a2.8 2.8 0 0 0 0-5.6Z" />
    <path {...SK} strokeWidth={3} d="m8.5 12 2.5 2.5 4.5-5" />
  </Svg>
);

export const InboxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M3 13h5l1.5 3h5l1.5-3h5v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path {...SK} d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13" />
    <path {...SK} d="M3 13h5l1.5 3h5l1.5-3h5" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path fillRule="evenodd" d="M12 2a7.5 7.5 0 0 0-7.5 7.5c0 5.3 6.2 11.6 6.9 12.3a.9.9 0 0 0 1.2 0c.7-.7 6.9-7 6.9-12.3A7.5 7.5 0 0 0 12 2Zm0 10.2a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4.2" />
    <path opacity={D2} d="M4 20.2C4 16.4 7.6 14 12 14s8 2.4 8 6.2c0 .5-.4.8-.8.8H4.8c-.4 0-.8-.3-.8-.8Z" />
  </Svg>
);

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2H3Z" />
    <rect x="7" y="2.5" width="2.2" height="5" rx="1.1" />
    <rect x="14.8" y="2.5" width="2.2" height="5" rx="1.1" />
  </Svg>
);

export const RupeeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle opacity={D2} cx="12" cy="12" r="10" />
    <path {...SK} strokeWidth={2.2} d="M8.5 7.5h7M8.5 10.5h7M10.5 7.5c3 0 3.5 3 0 3H8.5l5.5 6" />
  </Svg>
);

export const QrIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path opacity={D2} d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3v2h-3zM14 18h2v3h-2z" />
  </Svg>
);

export const StoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M4 10.5h16V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20Z" />
    <path d="M3.6 3.8A1.5 1.5 0 0 1 5 2.8h14a1.5 1.5 0 0 1 1.4 1l1.4 4.4a2.8 2.8 0 0 1-5.4 1.3 2.8 2.8 0 0 1-4.4.9 2.8 2.8 0 0 1-4.4-.9 2.8 2.8 0 0 1-5.4-1.3Z" />
    <rect x="9.5" y="14.5" width="5" height="7" rx="1" />
  </Svg>
);

export const SparklesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3.5 11.8 8.2 16.5 10l-4.7 1.8L10 16.5l-1.8-4.7L3.5 10l4.7-1.8Z" />
    <path opacity={D2} d="m17.5 13 .9 2.2 2.1.8-2.1.8-.9 2.2-.9-2.2-2.1-.8 2.1-.8Z" />
    <path opacity={D2} d="m17 3 .6 1.4 1.4.6-1.4.6L17 7l-.6-1.4L15 5l1.4-.6Z" />
  </Svg>
);

export const GiftIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="4" y="11" width="16" height="10" rx="2" />
    <rect x="3" y="7" width="18" height="4.5" rx="1.5" />
    <rect x="10.8" y="7" width="2.4" height="14" />
    <path {...SK} strokeWidth={2} d="M12 7C10.5 3.8 7 3.5 7 5.6 7 7 9.5 7 12 7Zm0 0c1.5-3.2 5-3.5 5-1.4C17 7 14.5 7 12 7Z" />
  </Svg>
);

/* ── Documents & print types ────────────────────────────── */
export const DocIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M6.5 2.5H14l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M14 2.5V6a1.5 1.5 0 0 0 1.5 1.5H19Z" />
    <rect x="8" y="11" width="8" height="2" rx="1" />
    <rect x="8" y="15" width="6" height="2" rx="1" />
  </Svg>
);

export const NotesIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="5" y="3" width="15" height="18.5" rx="2" />
    <rect x="9" y="8" width="7" height="2" rx="1" />
    <rect x="9" y="12" width="5" height="2" rx="1" />
    <path {...SK} d="M3.5 6.5h3M3.5 11.5h3M3.5 16.5h3" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect opacity={D2} x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="2" />
    <path d="M3 17.5 8.5 12l4 4 3-3 5.5 5.5V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
  </Svg>
);

export const ColorIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-1.2-1-1.6-1-2.7 0-1 .8-1.8 1.8-1.8h2.1A4.3 4.3 0 0 0 21 10.4C21 6.2 17 3 12 3Z" />
    <circle cx="7.5" cy="11" r="1.7" />
    <circle cx="10" cy="7" r="1.7" />
    <circle cx="15" cy="7.2" r="1.7" />
  </Svg>
);

export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M5 3.5A1.5 1.5 0 0 1 6.5 2H19v17H6.5A1.5 1.5 0 0 0 5 20.5Z" />
    <path d="M5 20.5A1.5 1.5 0 0 1 6.5 19H19v3H6.5A1.5 1.5 0 0 1 5 20.5Z" />
    <rect x="9" y="6" width="7" height="2" rx="1" />
  </Svg>
);

export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.2-1.8A1.5 1.5 0 0 1 9.8 3.5h4.4a1.5 1.5 0 0 1 1.3.7L16.7 6h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" />
    <circle cx="12" cy="13" r="4" />
  </Svg>
);

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path opacity={D2} d="m12 13 9-4.5-9-4.5-9 4.5Z" />
    <path d="m3 12.5 9 4.5 9-4.5v2.2l-9 4.5-9-4.5Z" />
  </Svg>
);
