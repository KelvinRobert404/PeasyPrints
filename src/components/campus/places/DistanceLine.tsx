import { WalkIcon } from '@/components/swoop/icons';
import { formatFromCampus } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';

type Props = {
  /** Rough metres from campus. Null or missing renders nothing. */
  meters: number | null | undefined;
  /** Short campus name for the line, e.g. 'KJU'. */
  campusLabel: string;
  /** Hide the walking icon in tight rows. */
  icon?: boolean;
  className?: string;
};

/** '650 m from KJU, 8 min walk'. Works in server and client components. */
export function DistanceLine({ meters, campusLabel, icon = true, className }: Props) {
  if (typeof meters !== 'number' || !Number.isFinite(meters)) return null;
  return (
    <p className={cn('flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-slate', className)}>
      {icon ? <WalkIcon size={13} className="shrink-0 text-ink" aria-hidden="true" /> : null}
      <span className="truncate">{formatFromCampus(meters, campusLabel)}</span>
    </p>
  );
}
