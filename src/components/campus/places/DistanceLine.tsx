'use client';

import { PinIcon, WalkIcon } from '@/components/swoop/icons';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { formatDistance, formatFromCampus } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';

/** Beyond this, a walk time is silly: '12 km from KJU Main' reads better than '150 min walk'. */
export const WALKABLE_MAX_M = 3000;

type Props = {
  /** Rough metres from campus. Null or missing renders nothing. */
  meters: number | null | undefined;
  /**
   * Short campus name for the line, e.g. 'KJU'. When it is the college code of
   * the student's own campus, the line names that campus instead ('KJU Airport Rd').
   */
  campusLabel: string;
  /** Hide the walking icon in tight rows. */
  icon?: boolean;
  className?: string;
};

/** '650 m from KJU Main, 8 min walk', or '12 km from KJU Main' when far. Client component. */
export function DistanceLine({ meters, campusLabel, icon = true, className }: Props) {
  const campus = useCurrentCampus();
  if (typeof meters !== 'number' || !Number.isFinite(meters)) return null;
  const label = campus && campus.code === campusLabel ? campus.label : campusLabel;
  const walkable = meters <= WALKABLE_MAX_M;
  const Icon = walkable ? WalkIcon : PinIcon;
  return (
    <p className={cn('flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-slate', className)}>
      {icon ? <Icon size={13} className="shrink-0 text-ink" aria-hidden="true" /> : null}
      <span className="truncate">{walkable ? formatFromCampus(meters, label) : `${formatDistance(meters)} from ${label}`}</span>
    </p>
  );
}
