'use client';

import { useEffect, useId, useRef, useState, type ComponentType } from 'react';
import { Chip, swButton } from '@/components/swoop/primitives';
import { BedIcon, HomeIcon, HousingIcon, LockIcon, PinIcon, UsersIcon, type IconProps } from '@/components/swoop/icons';
import { getCampus } from '@/lib/campus/catalog';
import { STAY_TYPE_LABELS } from '@/lib/campus/constants';
import { formatFromCampus, haversineMeters, roundForPrivacy } from '@/lib/format/distance';
import type { StayChoice } from '@/lib/stores/collegeStore';
import type { StayType } from '@/types/campus';
import { cn } from '@/lib/utils/cn';

const STAY_OPTIONS: { type: StayType; icon: ComponentType<IconProps> }[] = [
  { type: 'pg', icon: BedIcon },
  { type: 'flat', icon: HousingIcon },
  { type: 'hostel', icon: UsersIcon },
  { type: 'home', icon: HomeIcon },
];

type LocateStatus = 'idle' | 'locating' | 'done' | 'denied' | 'failed';

type StayStepProps = {
  /** Campus the distance is measured from (the pick's campus). */
  campusId: string | null;
  value: StayChoice | null;
  onChange: (stay: StayChoice | null) => void;
  /** Called after Skip clears the stay. */
  onSkip?: () => void;
  className?: string;
};

/**
 * Optional stay step: a stay type chip plus an optional phone-GPS distance.
 * Coordinates never leave this callback: only a rounded distance is kept.
 * Never asks for an area.
 */
export function StayStep({ campusId, value, onChange, onSkip, className }: StayStepProps) {
  const headingId = useId();
  const campus = getCampus(campusId);
  const [status, setStatus] = useState<LocateStatus>(value?.distanceM != null ? 'done' : 'idle');
  // Distance found before a chip was chosen. Rounded metres only.
  const [pendingDistance, setPendingDistance] = useState<number | null>(null);
  const mounted = useRef(true);
  // Latest props for the async location callback.
  const latest = useRef({ value, onChange });

  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const distanceM = value?.distanceM ?? pendingDistance;

  const chooseType = (type: StayType) => {
    onChange({ type, distanceM });
  };

  const locate = () => {
    if (!campus) return;
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      setStatus('failed');
      return;
    }
    const origin = { lat: campus.origin.lat, lng: campus.origin.lng };
    setStatus('locating');
    geo.getCurrentPosition(
      (position) => {
        // Measure on the phone, keep only the rounded distance, drop the coordinates.
        const meters = roundForPrivacy(
          haversineMeters({ lat: position.coords.latitude, lng: position.coords.longitude }, origin)
        );
        if (!mounted.current) return;
        const { value: current, onChange: emit } = latest.current;
        if (current) emit({ type: current.type, distanceM: meters });
        else setPendingDistance(meters);
        setStatus('done');
      },
      (error) => {
        if (!mounted.current) return;
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'failed');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const skip = () => {
    setPendingDistance(null);
    setStatus('idle');
    onChange(null);
    onSkip?.();
  };

  const locationLine =
    status === 'locating'
      ? 'Finding you...'
      : status === 'denied'
        ? 'Location is off. Pick one above.'
        : status === 'failed'
          ? 'Could not find you. Pick one above.'
          : distanceM != null && campus
            ? formatFromCampus(distanceM, campus.label)
            : 'Optional. Shows what is near you.';

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-0.5">
        <h2 id={headingId} className="font-heading text-[16px] text-ink">
          Hey, where do you stay?
        </h2>
        <p className="text-[11.5px] text-slate">Helps us show stuff near you.</p>
      </div>

      <div role="group" aria-label="Where you stay" className="flex flex-wrap gap-1.5">
        {STAY_OPTIONS.map(({ type, icon: Icon }) => (
          <Chip key={type} selected={value?.type === type} onClick={() => chooseType(type)}>
            <Icon size={14} />
            {STAY_TYPE_LABELS[type]}
          </Chip>
        ))}
      </div>

      {campus && (
        <div className="flex flex-col gap-1.5 rounded-[14px] bg-surface p-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={locate}
              disabled={status === 'locating'}
              className={swButton({ variant: 'white', size: 'sm' })}
            >
              <PinIcon size={14} className="text-royal" />
              {distanceM != null ? 'Update location' : 'Use my location'}
            </button>
            <span
              role="status"
              aria-live="polite"
              className={cn(
                'min-w-0 flex-1 truncate text-[11.5px]',
                status === 'done' && distanceM != null ? 'font-bold text-ink' : 'text-slate'
              )}
            >
              {locationLine}
            </span>
          </div>
          <p className="flex items-center gap-1 text-[11px] text-slate">
            <LockIcon size={12} className="shrink-0" />
            We keep only the distance
          </p>
        </div>
      )}

      <button type="button" onClick={skip} className={cn(swButton({ variant: 'ghost', size: 'sm' }), 'self-start')}>
        Skip
      </button>
    </section>
  );
}

export default StayStep;
