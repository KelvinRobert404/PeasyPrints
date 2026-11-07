import type { ReactNode } from 'react';

/**
 * Swoop illustration series v1.
 * Swoop draws its own art: flat inline SVG, no stock photos, no text.
 * Every piece sits on a 120x110 canvas, is decorative (aria-hidden) and is
 * coloured only with design tokens (CSS vars) plus white. No gradients.
 * Room item art lives in ./illustrations-room.tsx.
 */
export type IllustrationProps = { width?: number; height?: number; className?: string };

/** The only literal colour allowed in Swoop art. */
export const ART_WHITE = '#FFFFFF';

/** Shared 120x110 frame for every Swoop illustration. */
export function ArtFrame({ width = 120, height = 110, className, children }: IllustrationProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 110" width={width} height={height} aria-hidden="true" focusable="false" className={className}>
      {children}
    </svg>
  );
}

/** Soft floor line that anchors standing objects. */
export function ArtGround() {
  return <rect x="10" y="96" width="100" height="6" rx="3" fill="var(--royal-tint)" />;
}

/** Round royal-tint backdrop that lifts white shapes off a white ground. */
function Backdrop() {
  return <circle cx="60" cy="54" r="46" fill="var(--royal-tint)" />;
}

/** Star-burst outline, computed once at module load. */
function starPath(cx: number, cy: number, outer: number, inner: number, points: number) {
  const step = Math.PI / points;
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2;
    const x = (cx + r * Math.cos(a)).toFixed(1);
    const y = (cy + r * Math.sin(a)).toFixed(1);
    parts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  return `${parts.join(' ')}Z`;
}

const DEAL_STAR = starPath(56, 54, 42, 34, 14);

/* ── Print ──────────────────────────────────────────────── */

/** Printer for the Print tile (from the approved Home mockup). */
export function PrinterArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <rect x="30" y="6" width="60" height="36" rx="4" fill={ART_WHITE} />
      <rect x="40" y="16" width="34" height="4" rx="2" fill="var(--royal-tint)" />
      <rect x="40" y="25" width="24" height="4" rx="2" fill="var(--royal-tint)" />
      <rect x="8" y="36" width="104" height="46" rx="14" fill="var(--cream)" />
      <circle cx="96" cy="50" r="4.5" fill="var(--go)" />
      <rect x="22" y="62" width="76" height="8" rx="4" fill="var(--ink)" />
      <rect x="32" y="66" width="56" height="42" rx="3" fill={ART_WHITE} />
      <rect x="40" y="78" width="40" height="4" rx="2" fill="var(--royal)" />
      <rect x="40" y="87" width="28" height="4" rx="2" fill="var(--royal)" />
    </ArtFrame>
  );
}

/** Exam stack: answer sheets, a pencil and a clock. */
export function ExamPrintArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <Backdrop />
      <rect x="34" y="16" width="50" height="68" rx="4" fill="var(--royal-soft)" transform="rotate(7 59 50)" />
      <rect x="26" y="18" width="50" height="68" rx="4" fill={ART_WHITE} />
      <rect x="33" y="28" width="26" height="4" rx="2" fill="var(--royal)" />
      <rect x="33" y="38" width="36" height="3.5" rx="1.75" fill="var(--royal-tint)" />
      <rect x="33" y="46" width="30" height="3.5" rx="1.75" fill="var(--royal-tint)" />
      <rect x="33" y="54" width="34" height="3.5" rx="1.75" fill="var(--royal-tint)" />
      <rect x="33" y="62" width="22" height="3.5" rx="1.75" fill="var(--royal-tint)" />
      <circle cx="70" cy="22" r="9" fill="var(--go)" />
      <path d="M66 22l3 3 5-6" fill="none" stroke={ART_WHITE} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="rotate(-38 40 82)">
        <rect x="22" y="78" width="34" height="8" rx="2" fill="var(--cream)" />
        <rect x="22" y="78" width="6" height="8" rx="2" fill="var(--market)" />
        <path d="M56 78l8 4-8 4Z" fill="var(--ink)" />
      </g>
      <circle cx="92" cy="80" r="15" fill="var(--ink)" />
      <circle cx="92" cy="80" r="11" fill={ART_WHITE} />
      <path d="M92 73v7l5 3" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </ArtFrame>
  );
}

/** Waiting at the counter: a bagged print and a clock. Used on the pickup screen. */
export function PickupWaitArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <rect x="34" y="18" width="26" height="34" rx="2" fill={ART_WHITE} transform="rotate(-6 47 35)" />
      <rect x="38" y="25" width="16" height="3.5" rx="1.75" fill="var(--royal)" transform="rotate(-6 47 35)" />
      <rect x="38" y="32" width="11" height="3.5" rx="1.75" fill="var(--royal)" transform="rotate(-6 47 35)" />
      <path d="M24 40h46l4 42H20Z" fill="var(--cream)" />
      <path d="M24 40h46l1 7H23Z" fill="var(--royal-tint)" />
      <circle cx="47" cy="62" r="7" fill="var(--go)" />
      <path d="M43.5 62l2.5 2.5 4.5-5" fill="none" stroke={ART_WHITE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="92" cy="54" r="18" fill="var(--royal)" />
      <circle cx="92" cy="54" r="13" fill={ART_WHITE} />
      <path d="M92 46v8l6 4" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="92" cy="54" r="2" fill="var(--ink)" />
      <circle cx="108" cy="30" r="3" fill="var(--royal-soft)" />
      <circle cx="114" cy="40" r="2" fill="var(--royal-soft)" />
      <rect x="6" y="82" width="108" height="9" rx="4" fill="var(--ink)" />
      <rect x="14" y="91" width="92" height="15" rx="3" fill="var(--royal-soft)" />
      <rect x="22" y="96" width="30" height="4" rx="2" fill="var(--royal-tint)" />
    </ArtFrame>
  );
}

/* ── Market ─────────────────────────────────────────────── */

/** Shopping bag with a price tag. */
export function MarketArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <path d="M38 42V32a14 14 0 0 1 28 0v10" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
      <rect x="20" y="38" width="64" height="60" rx="10" fill="var(--market)" />
      <rect x="20" y="38" width="64" height="9" rx="4.5" fill="var(--ink)" />
      <circle cx="38" cy="47" r="3" fill={ART_WHITE} />
      <circle cx="66" cy="47" r="3" fill={ART_WHITE} />
      <g transform="rotate(-16 88 68)">
        <path d="M78 52h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H78l-10-16Z" fill="var(--cream)" />
        <circle cx="77" cy="68" r="3" fill="var(--ink)" />
        <rect x="84" y="61" width="16" height="4" rx="2" fill="var(--ink)" />
        <rect x="84" y="70" width="11" height="4" rx="2" fill="var(--ink)" />
      </g>
      <circle cx="102" cy="28" r="4" fill="var(--royal-soft)" />
      <circle cx="94" cy="18" r="2.5" fill="var(--royal-soft)" />
    </ArtFrame>
  );
}

/** Moving out: stacked boxes heading off. */
export function MovingOutArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="16" y="56" width="50" height="40" rx="4" fill="var(--cream)" />
      <rect x="37" y="56" width="8" height="15" fill="var(--royal)" />
      <rect x="24" y="80" width="18" height="9" rx="2" fill={ART_WHITE} />
      <g transform="rotate(-6 44 40)">
        <rect x="26" y="24" width="36" height="32" rx="4" fill="var(--royal-soft)" />
        <rect x="40" y="24" width="8" height="12" fill="var(--ink)" />
      </g>
      <rect x="70" y="64" width="32" height="32" rx="4" fill="var(--royal)" />
      <rect x="82" y="64" width="8" height="11" fill="var(--royal-tint)" />
      <path d="M80 42h26m-8-8 8 8-8 8" fill="none" stroke="var(--ink)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="68" y="30" width="8" height="4" rx="2" fill="var(--royal-tint)" />
      <rect x="64" y="40" width="10" height="4" rx="2" fill="var(--royal-tint)" />
    </ArtFrame>
  );
}

/** Deals: a royal burst with a drawn percent mark. */
export function DealsArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <path d={DEAL_STAR} fill="var(--royal)" strokeLinejoin="round" stroke="var(--royal)" strokeWidth="3" />
      <circle cx="44" cy="42" r="7" fill={ART_WHITE} />
      <circle cx="68" cy="66" r="7" fill={ART_WHITE} />
      <path d="M71 37 41 71" fill="none" stroke={ART_WHITE} strokeWidth="6" strokeLinecap="round" />
      <circle cx="98" cy="88" r="13" fill="var(--cream)" />
      <circle cx="98" cy="88" r="8" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <circle cx="82" cy="100" r="7" fill="var(--go)" />
      <circle cx="18" cy="92" r="4" fill="var(--royal-soft)" />
    </ArtFrame>
  );
}

/* ── Housing ────────────────────────────────────────────── */

/** PG building with a lit window and a tree. */
export function HousingArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="80" y="54" width="28" height="44" rx="5" fill="var(--royal-soft)" />
      <rect x="88" y="62" width="12" height="10" rx="2.5" fill={ART_WHITE} />
      <rect x="88" y="78" width="12" height="10" rx="2.5" fill={ART_WHITE} />
      <path d="M24 34 54 12l30 22Z" fill="var(--ink)" stroke="var(--ink)" strokeWidth="5" strokeLinejoin="round" />
      <rect x="28" y="32" width="52" height="66" rx="6" fill="var(--royal)" />
      <rect x="36" y="42" width="14" height="12" rx="3" fill={ART_WHITE} />
      <rect x="58" y="42" width="14" height="12" rx="3" fill="var(--cream)" />
      <rect x="36" y="60" width="14" height="12" rx="3" fill={ART_WHITE} />
      <rect x="58" y="60" width="14" height="12" rx="3" fill={ART_WHITE} />
      <rect x="47" y="80" width="14" height="18" rx="3" fill="var(--ink)" />
      <rect x="14.5" y="80" width="3" height="17" rx="1.5" fill="var(--ink)" />
      <circle cx="16" cy="76" r="10" fill="var(--go)" />
    </ArtFrame>
  );
}

/** Set up your room: bed, poster and a floor lamp. */
export function SetUpRoomArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="30" y="12" width="26" height="32" rx="3" fill="var(--girls)" />
      <rect x="35" y="17" width="16" height="16" rx="2" fill={ART_WHITE} />
      <circle cx="43" cy="25" r="4" fill="var(--cream)" />
      <rect x="10" y="44" width="10" height="52" rx="3" fill="var(--ink)" />
      <rect x="18" y="88" width="5" height="8" rx="1.5" fill="var(--ink)" />
      <rect x="84" y="88" width="5" height="8" rx="1.5" fill="var(--ink)" />
      <rect x="12" y="74" width="80" height="15" rx="4" fill="var(--royal)" />
      <rect x="18" y="64" width="74" height="13" rx="5" fill="var(--royal-tint)" />
      <rect x="22" y="56" width="22" height="10" rx="5" fill="var(--cream)" />
      <rect x="48" y="62" width="44" height="15" rx="5" fill="var(--royal-soft)" />
      <path d="M98 38h16l-4-16h-8Z" fill="var(--cream)" stroke="var(--cream)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="104.5" y="38" width="3" height="52" rx="1.5" fill="var(--ink)" />
      <rect x="98" y="88" width="16" height="5" rx="2.5" fill="var(--ink)" />
    </ArtFrame>
  );
}

/** Next sem room: a door, a hanging key tag and a calendar. */
export function NextSemRoomArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="18" y="16" width="44" height="80" rx="4" fill="var(--royal)" />
      <rect x="25" y="24" width="30" height="24" rx="2.5" fill="var(--royal-soft)" />
      <rect x="25" y="54" width="30" height="34" rx="2.5" fill="var(--royal-soft)" />
      <circle cx="54" cy="60" r="3.5" fill="var(--cream)" />
      <path d="M54 63v9" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      <rect x="49" y="72" width="10" height="14" rx="3" fill="var(--cream)" />
      <circle cx="54" cy="76" r="1.6" fill="var(--ink)" />
      <rect x="70" y="34" width="40" height="40" rx="6" fill={ART_WHITE} stroke="var(--royal-tint)" strokeWidth="3" />
      <path d="M70 40a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v6H70Z" fill="var(--market)" />
      <rect x="78" y="29" width="4" height="9" rx="2" fill="var(--ink)" />
      <rect x="98" y="29" width="4" height="9" rx="2" fill="var(--ink)" />
      <circle cx="80" cy="54" r="2.5" fill="var(--royal-tint)" />
      <circle cx="90" cy="54" r="2.5" fill="var(--royal-tint)" />
      <circle cx="100" cy="54" r="2.5" fill="var(--royal-tint)" />
      <circle cx="80" cy="64" r="2.5" fill="var(--royal-tint)" />
      <circle cx="90" cy="64" r="5" fill="var(--go)" />
      <circle cx="100" cy="64" r="2.5" fill="var(--royal-tint)" />
    </ArtFrame>
  );
}

/* ── Campus ─────────────────────────────────────────────── */

/** Lost and found: a magnifier over a key. */
export function LostFoundArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <Backdrop />
      <g transform="rotate(42 86 82)">
        <rect x="74" y="76" width="28" height="12" rx="6" fill="var(--ink)" />
        <rect x="84" y="76" width="18" height="12" rx="6" fill="var(--royal)" />
      </g>
      <circle cx="52" cy="48" r="28" fill={ART_WHITE} stroke="var(--ink)" strokeWidth="7" />
      <circle cx="42" cy="48" r="8" fill="none" stroke="var(--royal)" strokeWidth="4.5" />
      <path d="M50 48h18m-6 0v7m-6-7v5" fill="none" stroke="var(--royal)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="104" cy="22" r="4" fill="var(--cream)" />
      <circle cx="16" cy="88" r="3" fill="var(--go)" />
    </ArtFrame>
  );
}

/** Blood donors: a drop with a plus and a heart. */
export function BloodArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <path d="M58 10C58 10 26 46 26 66a32 32 0 0 0 64 0C90 46 58 10 58 10Z" fill="var(--market)" />
      <ellipse cx="40" cy="54" rx="3.5" ry="7" fill={ART_WHITE} transform="rotate(25 40 54)" />
      <rect x="54" y="60" width="11" height="25" rx="3" fill={ART_WHITE} />
      <rect x="47" y="67" width="25" height="11" rx="3" fill={ART_WHITE} />
      <path d="M100 44c-8-6-12-10-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 5-4 9-12 15Z" fill="var(--girls)" />
      <circle cx="104" cy="62" r="3" fill="var(--royal-soft)" />
    </ArtFrame>
  );
}

/** Games: a controller and a die. */
export function GamesArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <g transform="rotate(14 60 24)">
        <rect x="48" y="12" width="24" height="24" rx="5" fill="var(--cream)" />
        <circle cx="54" cy="18" r="2.2" fill="var(--ink)" />
        <circle cx="60" cy="24" r="2.2" fill="var(--ink)" />
        <circle cx="66" cy="30" r="2.2" fill="var(--ink)" />
      </g>
      <path
        d="M30 46h60a20 20 0 0 1 19.5 15.6l4 18A12 12 0 0 1 92 86L82 76H38L28 86a12 12 0 0 1-21.5-6.4l4-18A20 20 0 0 1 30 46Z"
        fill="var(--ink)"
      />
      <rect x="31" y="54" width="6" height="18" rx="2" fill={ART_WHITE} />
      <rect x="25" y="60" width="18" height="6" rx="2" fill={ART_WHITE} />
      <circle cx="84" cy="56" r="4" fill="var(--royal-soft)" />
      <circle cx="92" cy="63" r="4" fill="var(--go)" />
      <circle cx="76" cy="63" r="4" fill="var(--market)" />
      <circle cx="84" cy="70" r="4" fill="var(--cream)" />
      <rect x="54" y="60" width="12" height="4" rx="2" fill="var(--royal)" />
      <rect x="20" y="98" width="80" height="5" rx="2.5" fill="var(--royal-tint)" />
    </ArtFrame>
  );
}

/** Verification: a student ID with a green shield. */
export function VerifyArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="12" y="24" width="78" height="54" rx="8" fill="var(--royal)" />
      <rect x="20" y="33" width="22" height="28" rx="4" fill="var(--royal-soft)" />
      <circle cx="31" cy="43" r="5" fill="var(--cream)" />
      <path d="M23 58a8 8 0 0 1 16 0Z" fill="var(--cream)" />
      <rect x="48" y="36" width="30" height="5" rx="2.5" fill={ART_WHITE} />
      <rect x="48" y="46" width="22" height="4" rx="2" fill="var(--royal-tint)" />
      <rect x="20" y="67" width="40" height="4" rx="2" fill="var(--royal-tint)" />
      <path d="M90 46l20 8v14c0 14-9 22-20 26-11-4-20-12-20-26V54Z" fill="var(--go)" stroke="var(--go)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M81 69l6 6 12-12" fill="none" stroke={ART_WHITE} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </ArtFrame>
  );
}

/** Empty state: an open, empty box. */
export function EmptyArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <path d="M30 52 40 36h40l10 16Z" fill="var(--ink)" />
      <path d="M30 52 12 40l22-5 8 17Z" fill="var(--royal-soft)" />
      <path d="M90 52l18-12-22-5-8 17Z" fill="var(--royal-soft)" />
      <rect x="28" y="50" width="64" height="46" rx="4" fill="var(--royal)" />
      <rect x="28" y="50" width="64" height="8" rx="3" fill="var(--ink)" />
      <rect x="50" y="68" width="20" height="5" rx="2.5" fill="var(--royal-soft)" />
      <circle cx="60" cy="22" r="3" fill="var(--royal-soft)" />
      <circle cx="48" cy="14" r="2" fill="var(--royal-tint)" />
      <circle cx="74" cy="16" r="2.5" fill="var(--cream)" />
    </ArtFrame>
  );
}
