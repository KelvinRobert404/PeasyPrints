import type { ComponentType } from 'react';
import { ART_WHITE, ArtFrame, ArtGround, type IllustrationProps } from '@/components/swoop/illustrations';

/**
 * Room item art for Set up your room and housing listings.
 * Same rules as the main series: 120x110, flat, CSS-var colours plus white, no text.
 */
export type RoomItemId =
  | 'bed'
  | 'mattress'
  | 'study_table'
  | 'chair'
  | 'fan'
  | 'cooler'
  | 'wardrobe'
  | 'bucket_set'
  | 'kettle'
  | 'lamp'
  | 'curtains'
  | 'shelf';

export function BedArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="12" y="38" width="10" height="58" rx="3" fill="var(--ink)" />
      <rect x="100" y="60" width="8" height="36" rx="3" fill="var(--ink)" />
      <rect x="14" y="72" width="92" height="15" rx="4" fill="var(--royal)" />
      <rect x="20" y="60" width="82" height="14" rx="5" fill="var(--royal-tint)" />
      <rect x="25" y="51" width="24" height="11" rx="5" fill="var(--cream)" />
      <rect x="54" y="57" width="48" height="17" rx="5" fill="var(--royal-soft)" />
      <rect x="54" y="64" width="48" height="3" fill="var(--royal)" />
    </ArtFrame>
  );
}

export function MattressArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <path d="M16 58 34 40h72L90 58Z" fill="var(--royal-soft)" stroke="var(--royal-soft)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M90 58l16-18v28L90 86Z" fill="var(--ink)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <rect x="14" y="58" width="78" height="28" rx="5" fill="var(--royal)" />
      <rect x="20" y="70" width="66" height="3" rx="1.5" fill="var(--royal-soft)" />
      <circle cx="44" cy="49" r="2.5" fill="var(--cream)" />
      <circle cx="62" cy="49" r="2.5" fill="var(--cream)" />
      <circle cx="80" cy="49" r="2.5" fill="var(--cream)" />
      <rect x="22" y="86" width="6" height="10" rx="2" fill="var(--ink)" />
      <rect x="78" y="86" width="6" height="10" rx="2" fill="var(--ink)" />
    </ArtFrame>
  );
}

export function StudyTableArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="28" y="22" width="36" height="24" rx="3" fill="var(--ink)" />
      <rect x="31" y="25" width="30" height="18" rx="2" fill="var(--royal-soft)" />
      <rect x="22" y="45" width="48" height="5" rx="2.5" fill="var(--royal)" />
      <rect x="78" y="40" width="22" height="5" rx="1.5" fill="var(--market)" />
      <rect x="80" y="34" width="18" height="6" rx="1.5" fill="var(--cream)" />
      <rect x="77" y="28" width="20" height="6" rx="1.5" fill="var(--girls)" />
      <rect x="12" y="50" width="96" height="8" rx="3" fill="var(--ink)" />
      <rect x="18" y="58" width="6" height="38" rx="2" fill="var(--ink)" />
      <rect x="96" y="58" width="6" height="38" rx="2" fill="var(--ink)" />
      <rect x="68" y="58" width="28" height="26" rx="3" fill="var(--royal)" />
      <rect x="76" y="68" width="12" height="4" rx="2" fill={ART_WHITE} />
    </ArtFrame>
  );
}

export function ChairArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="38" y="12" width="44" height="42" rx="12" fill="var(--royal)" />
      <rect x="46" y="20" width="28" height="6" rx="3" fill="var(--royal-soft)" />
      <rect x="57" y="52" width="6" height="8" fill="var(--ink)" />
      <rect x="32" y="58" width="56" height="13" rx="6.5" fill="var(--royal-soft)" />
      <rect x="57" y="71" width="6" height="12" fill="var(--ink)" />
      <rect x="34" y="81" width="52" height="5" rx="2.5" fill="var(--ink)" />
      <circle cx="37" cy="90" r="4" fill="var(--ink)" />
      <circle cx="60" cy="90" r="4" fill="var(--ink)" />
      <circle cx="83" cy="90" r="4" fill="var(--ink)" />
    </ArtFrame>
  );
}

export function FanArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="56" y="72" width="8" height="18" rx="2" fill="var(--ink)" />
      <rect x="38" y="86" width="44" height="9" rx="4.5" fill="var(--royal)" />
      <circle cx="60" cy="44" r="32" fill="var(--royal-tint)" stroke="var(--royal)" strokeWidth="4" />
      <ellipse cx="60" cy="28" rx="8" ry="14" fill="var(--royal-soft)" />
      <ellipse cx="60" cy="28" rx="8" ry="14" fill="var(--royal-soft)" transform="rotate(120 60 44)" />
      <ellipse cx="60" cy="28" rx="8" ry="14" fill="var(--royal-soft)" transform="rotate(240 60 44)" />
      <circle cx="60" cy="44" r="7" fill="var(--ink)" />
      <circle cx="60" cy="44" r="2.5" fill="var(--cream)" />
    </ArtFrame>
  );
}

export function CoolerArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="30" y="12" width="60" height="78" rx="8" fill="var(--royal)" />
      <rect x="38" y="20" width="44" height="26" rx="4" fill="var(--royal-tint)" />
      <rect x="42" y="25" width="36" height="3" rx="1.5" fill="var(--ink)" />
      <rect x="42" y="31.5" width="36" height="3" rx="1.5" fill="var(--ink)" />
      <rect x="42" y="38" width="36" height="3" rx="1.5" fill="var(--ink)" />
      <rect x="38" y="52" width="44" height="30" rx="4" fill="var(--cream)" />
      <rect x="46" y="55" width="3" height="24" rx="1.5" fill="var(--royal-soft)" />
      <rect x="54" y="55" width="3" height="24" rx="1.5" fill="var(--royal-soft)" />
      <rect x="62" y="55" width="3" height="24" rx="1.5" fill="var(--royal-soft)" />
      <rect x="70" y="55" width="3" height="24" rx="1.5" fill="var(--royal-soft)" />
      <circle cx="40" cy="93" r="4" fill="var(--ink)" />
      <circle cx="80" cy="93" r="4" fill="var(--ink)" />
      <path d="M98 28c4 3 4 7 0 10s-4 7 0 10" fill="none" stroke="var(--royal-soft)" strokeWidth="3" strokeLinecap="round" />
      <path d="M106 32c4 3 4 7 0 10s-4 7 0 10" fill="none" stroke="var(--royal-soft)" strokeWidth="3" strokeLinecap="round" />
    </ArtFrame>
  );
}

export function WardrobeArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="26" y="8" width="68" height="84" rx="6" fill="var(--royal)" />
      <rect x="59" y="12" width="2" height="76" fill="var(--ink)" />
      <rect x="66" y="18" width="22" height="52" rx="3" fill="var(--royal-soft)" />
      <rect x="69" y="22" width="4" height="20" rx="2" fill="var(--royal-tint)" />
      <rect x="32" y="18" width="22" height="22" rx="3" fill="var(--royal-soft)" />
      <rect x="51" y="46" width="4" height="12" rx="2" fill="var(--cream)" />
      <rect x="65" y="74" width="4" height="10" rx="2" fill="var(--cream)" />
      <rect x="30" y="92" width="6" height="4" rx="1" fill="var(--ink)" />
      <rect x="84" y="92" width="6" height="4" rx="1" fill="var(--ink)" />
    </ArtFrame>
  );
}

export function BucketSetArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <path d="M26 44C26 16 72 16 72 44" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 46h50l-6 50H30Z" fill="var(--royal)" />
      <rect x="20" y="40" width="58" height="9" rx="4.5" fill="var(--ink)" />
      <rect x="30" y="60" width="38" height="4" rx="2" fill="var(--royal-soft)" />
      <path d="M106 74h4a5 5 0 0 1 0 10h-4" fill="none" stroke="var(--market)" strokeWidth="4" />
      <path d="M82 68h24v24a4 4 0 0 1-4 4H86a4 4 0 0 1-4-4Z" fill="var(--market)" />
      <rect x="82" y="68" width="24" height="5" rx="2" fill="var(--ink)" />
      <path d="M94 42c0 0-6 8-6 12a6 6 0 0 0 12 0c0-4-6-12-6-12Z" fill="var(--royal-soft)" />
    </ArtFrame>
  );
}

export function KettleArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <path d="M48 22c-4-3-4-7 0-10" fill="none" stroke="var(--royal-tint)" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 22c-4-3-4-7 0-10" fill="none" stroke="var(--royal-tint)" strokeWidth="3" strokeLinecap="round" />
      <path d="M80 48h8a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6h-6" fill="none" stroke="var(--royal)" strokeWidth="7" strokeLinecap="round" />
      <path d="M36 52 18 40l3-5 17 9Z" fill="var(--royal-soft)" stroke="var(--royal-soft)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M36 38h44l6 52H30Z" fill="var(--royal-soft)" stroke="var(--royal-soft)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="40" y="30" width="36" height="9" rx="4.5" fill="var(--royal)" />
      <rect x="54" y="25" width="8" height="6" rx="2" fill="var(--ink)" />
      <rect x="46" y="52" width="7" height="26" rx="3.5" fill="var(--cream)" />
      <rect x="24" y="88" width="68" height="8" rx="3" fill="var(--ink)" />
      <circle cx="80" cy="92" r="1.8" fill="var(--go)" />
    </ArtFrame>
  );
}

export function LampArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <path d="M78 48h20l14 46H64Z" fill="var(--cream)" />
      <path d="M48 88 36 58l30-22" fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="36" cy="58" r="5" fill="var(--royal)" />
      <path d="M60 30l28-12 12 26-24 6Z" fill="var(--royal)" stroke="var(--royal)" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="88" cy="48" r="6" fill="var(--cream)" />
      <rect x="28" y="86" width="40" height="9" rx="4.5" fill="var(--ink)" />
    </ArtFrame>
  );
}

export function CurtainsArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <rect x="26" y="20" width="68" height="70" rx="4" fill="var(--royal-tint)" />
      <rect x="32" y="26" width="25" height="28" rx="2" fill={ART_WHITE} />
      <rect x="63" y="26" width="25" height="28" rx="2" fill={ART_WHITE} />
      <rect x="32" y="58" width="25" height="26" rx="2" fill={ART_WHITE} />
      <rect x="63" y="58" width="25" height="26" rx="2" fill={ART_WHITE} />
      <circle cx="78" cy="38" r="5" fill="var(--cream)" />
      <rect x="10" y="14" width="100" height="5" rx="2.5" fill="var(--ink)" />
      <circle cx="10" cy="16.5" r="4" fill="var(--ink)" />
      <circle cx="110" cy="16.5" r="4" fill="var(--ink)" />
      <path d="M14 19h30c-6 26 6 50-4 78H14Z" fill="var(--girls)" />
      <path d="M106 19H76c6 26-6 50 4 78h26Z" fill="var(--girls)" />
      <rect x="12" y="58" width="32" height="5" rx="2.5" fill="var(--cream)" />
      <rect x="76" y="58" width="32" height="5" rx="2.5" fill="var(--cream)" />
      <rect x="8" y="98" width="104" height="5" rx="2.5" fill="var(--royal-tint)" />
    </ArtFrame>
  );
}

export function ShelfArt(props: IllustrationProps) {
  return (
    <ArtFrame {...props}>
      <ArtGround />
      <rect x="24" y="8" width="72" height="88" rx="4" fill="var(--ink)" />
      <rect x="30" y="14" width="60" height="24" rx="2" fill="var(--royal-tint)" />
      <rect x="30" y="44" width="60" height="24" rx="2" fill="var(--royal-tint)" />
      <rect x="30" y="74" width="60" height="16" rx="2" fill="var(--royal-tint)" />
      <rect x="34" y="18" width="7" height="20" rx="1.5" fill="var(--royal)" />
      <rect x="42" y="22" width="6" height="16" rx="1.5" fill="var(--market)" />
      <rect x="49" y="19" width="8" height="19" rx="1.5" fill="var(--cream)" />
      <rect x="62" y="20" width="6" height="18" rx="1.5" fill="var(--girls)" transform="rotate(16 65 38)" />
      <rect x="76" y="28" width="10" height="10" rx="2" fill="var(--royal-soft)" />
      <rect x="36" y="58" width="12" height="10" rx="2" fill="var(--market)" />
      <circle cx="38" cy="52" r="5" fill="var(--go)" />
      <circle cx="46" cy="50" r="6" fill="var(--go)" />
      <rect x="60" y="50" width="6" height="18" rx="1.5" fill="var(--royal-soft)" />
      <rect x="67" y="48" width="7" height="20" rx="1.5" fill="var(--royal)" />
      <rect x="75" y="53" width="6" height="15" rx="1.5" fill="var(--cream)" />
      <rect x="36" y="78" width="22" height="12" rx="2" fill="var(--royal)" />
      <rect x="62" y="80" width="22" height="10" rx="2" fill="var(--cream)" />
    </ArtFrame>
  );
}

export const ROOM_ART: Record<RoomItemId, ComponentType<IllustrationProps>> = {
  bed: BedArt,
  mattress: MattressArt,
  study_table: StudyTableArt,
  chair: ChairArt,
  fan: FanArt,
  cooler: CoolerArt,
  wardrobe: WardrobeArt,
  bucket_set: BucketSetArt,
  kettle: KettleArt,
  lamp: LampArt,
  curtains: CurtainsArt,
  shelf: ShelfArt
};
