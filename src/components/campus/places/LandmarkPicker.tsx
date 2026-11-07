'use client';

import { useId, useMemo, useState } from 'react';
import { LandmarkIcon, PinIcon, SearchIcon } from '@/components/swoop/icons';
import { IconTile } from '@/components/swoop/primitives';
import { formatDistance, haversineMeters, roundForPrivacy, type LatLng } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';
import type { ListingPlace } from '@/types/campus';
import type { Landmark } from '@/types/college';
import { DistanceLine } from './DistanceLine';

/** What the poster picked. The server adds coordinates and the campus id. */
export type LandmarkPick = Pick<ListingPlace, 'landmarkId' | 'label' | 'area' | 'roughDistanceM'>;

type Props = {
  /** Landmarks of the poster's campus (from the session, never asked). */
  landmarks: readonly Landmark[];
  /** Campus origin, for the distance. */
  origin: LatLng;
  /** Short campus name for the distance line, e.g. 'KJU'. */
  campusCode: string;
  value?: LandmarkPick | null;
  defaultValue?: LandmarkPick | null;
  onChange?: (pick: LandmarkPick | null) => void;
  label?: string;
  className?: string;
};

/** Rough distances for a place that is not in the list. */
const ROUGH_DISTANCES = [500, 1000, 2000, 3000] as const;
const QUICK_COUNT = 6;
const RESULT_COUNT = 8;

const CHIP =
  'campus-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40';

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** 3 exact, 2 word start, 1 substring (3+ chars), 0 none. */
function score(query: string, terms: readonly string[]): number {
  let best = 0;
  for (const raw of terms) {
    const term = normalize(raw);
    if (!term) continue;
    if (term === query) return 3;
    if (term.startsWith(query) || term.includes(` ${query}`)) best = Math.max(best, 2);
    else if (query.length >= 3 && term.includes(query)) best = Math.max(best, 1);
  }
  return best;
}

function searchLandmarks(landmarks: readonly Landmark[], query: string): Landmark[] {
  const q = normalize(query);
  if (!q) return landmarks.slice(0, QUICK_COUNT);
  return landmarks
    .map((landmark, index) => ({
      landmark,
      index,
      score: Math.max(score(q, [landmark.label, ...landmark.aliases]), score(q, [landmark.area]) - 0.5),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, RESULT_COUNT)
    .map((entry) => entry.landmark);
}

/**
 * Posters only: pick a landmark near campus (alias search), which fills the
 * area and shows '650 m from KJU, 8 min walk'. 'Other' takes a typed area and
 * a rough distance. Viewers never see this.
 */
export function LandmarkPicker({ landmarks, origin, campusCode, value, defaultValue = null, onChange, label = 'Where is it?', className }: Props) {
  const id = useId();
  const [inner, setInner] = useState<LandmarkPick | null>(defaultValue);
  const picked = value !== undefined ? value : inner;
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [other, setOther] = useState(() => Boolean(picked && picked.landmarkId === null));
  const [otherArea, setOtherArea] = useState(() => (picked && picked.landmarkId === null ? picked.area : ''));
  const [otherDistance, setOtherDistance] = useState<number | null>(() =>
    picked && picked.landmarkId === null ? picked.roughDistanceM : null,
  );

  const distances = useMemo(() => {
    const map = new Map<string, number>();
    for (const landmark of landmarks) map.set(landmark.id, roundForPrivacy(haversineMeters(origin, landmark)));
    return map;
  }, [landmarks, origin.lat, origin.lng]);

  const results = useMemo(() => searchLandmarks(landmarks, query), [landmarks, query]);

  const commit = (next: LandmarkPick | null) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  const pickLandmark = (landmark: Landmark) => {
    setOther(false);
    setEditing(false);
    setQuery('');
    commit({ landmarkId: landmark.id, label: landmark.label, area: landmark.area, roughDistanceM: distances.get(landmark.id) ?? null });
  };

  const updateOther = (area: string, distance: number | null) => {
    setOtherArea(area);
    setOtherDistance(distance);
    const trimmed = area.trim();
    commit(trimmed && distance !== null ? { landmarkId: null, label: trimmed, area: trimmed, roughDistanceM: distance } : null);
  };

  const openOther = () => {
    setOther(true);
    setEditing(false);
    const typed = query.trim();
    updateOther(otherArea || typed, otherDistance);
  };

  const showPicked = Boolean(picked && picked.landmarkId !== null && !editing);

  return (
    <div className={cn('min-w-0', className)}>
      <p id={`${id}-label`} className="text-[11.5px] font-bold text-ink">
        {label}
      </p>

      {showPicked && picked ? (
        <div className="mt-1 flex items-center gap-2.5 rounded-[12px] bg-surface p-2.5">
          <IconTile icon={LandmarkIcon} tone="royal" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-ink">{picked.label}</p>
            {picked.area && picked.area !== picked.label ? <p className="truncate text-[11px] text-slate">{picked.area}</p> : null}
            <DistanceLine meters={picked.roughDistanceM} campusLabel={campusCode} className="mt-0.5" />
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="campus-press inline-flex h-8 shrink-0 items-center rounded-full bg-white px-3 text-[12px] font-bold text-ink"
          >
            Change
          </button>
        </div>
      ) : null}

      {!showPicked && !other ? (
        <div className="mt-1">
          <label className="flex h-10 items-center gap-2 rounded-full bg-surface pl-3 pr-1.5 focus-within:ring-2 focus-within:ring-royal/30">
            <SearchIcon size={15} className="shrink-0 text-ink" aria-hidden="true" />
            <span className="sr-only">Search a landmark</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hospital, hostel, area…"
              autoComplete="off"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate"
            />
          </label>
          <ul aria-labelledby={`${id}-label`} className="mt-1">
            {results.map((landmark) => {
              const meters = distances.get(landmark.id);
              const selected = picked?.landmarkId === landmark.id;
              return (
                <li key={landmark.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => pickLandmark(landmark)}
                    className={cn(
                      'campus-press flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-1.5 text-left',
                      selected ? 'bg-royal-tint' : 'hover:bg-surface',
                    )}
                  >
                    <PinIcon size={16} className="shrink-0 text-ink" aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[12.5px] font-bold text-ink">{landmark.label}</span>
                      {landmark.area !== landmark.label ? <span className="truncate text-[11px] text-slate">{landmark.area}</span> : null}
                    </span>
                    {typeof meters === 'number' ? (
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate">{formatDistance(meters)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {query.trim() && results.length === 0 ? (
              <li className="px-1.5 py-2 text-[11.5px] text-slate">No landmark by that name.</li>
            ) : null}
            <li>
              <button
                type="button"
                onClick={openOther}
                className="campus-press flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-1.5 text-left hover:bg-surface"
              >
                <PinIcon size={16} className="shrink-0 text-slate" aria-hidden="true" />
                <span className="text-[12.5px] font-bold text-ink">Other place</span>
              </button>
            </li>
          </ul>
          {editing && picked ? (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="campus-press mt-1 inline-flex h-8 items-center rounded-full px-3 text-[12px] font-bold text-ink"
            >
              Keep {picked.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {other ? (
        <div className="mt-1 space-y-2 rounded-[12px] bg-surface p-2.5">
          <label className="block text-[11.5px] font-bold text-ink">
            Area name
            <input
              type="text"
              value={otherArea}
              maxLength={60}
              onChange={(event) => updateOther(event.target.value, otherDistance)}
              placeholder="e.g. Kothanur"
              autoComplete="off"
              className="mt-1 h-10 w-full rounded-[10px] border border-transparent bg-white px-3 text-[13px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate focus:border-royal"
            />
          </label>
          <div>
            <p className="text-[11.5px] font-bold text-ink">How far from {campusCode}?</p>
            <div role="group" aria-label={`Rough distance from ${campusCode}`} className="mt-1 flex flex-wrap gap-1.5">
              {ROUGH_DISTANCES.map((meters) => {
                const selected = otherDistance === meters;
                return (
                  <button
                    key={meters}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateOther(otherArea, meters)}
                    className={cn(CHIP, selected ? 'bg-ink font-bold text-white' : 'bg-white font-semibold text-ink')}
                  >
                    About {formatDistance(meters)}
                  </button>
                );
              })}
            </div>
          </div>
          <DistanceLine meters={picked && picked.landmarkId === null ? picked.roughDistanceM : null} campusLabel={campusCode} />
          <button
            type="button"
            onClick={() => {
              setOther(false);
              commit(null);
            }}
            className="campus-press inline-flex h-8 items-center rounded-full bg-white px-3 text-[12px] font-bold text-ink"
          >
            Pick from the list
          </button>
        </div>
      ) : null}
    </div>
  );
}
