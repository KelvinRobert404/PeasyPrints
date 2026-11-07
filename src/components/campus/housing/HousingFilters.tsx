'use client';

import { GenderChips } from '@/components/campus/fields/GenderChips';
import { RingChips } from '@/components/campus/places/RingChips';
import { Chip, SearchPill } from '@/components/swoop/primitives';
import { HOUSING_KINDS, HOUSING_KIND_LABELS } from '@/lib/campus/housing/model';
import { cn } from '@/lib/utils/cn';
import type { HousingFilterState } from '@/hooks/useHousingFeed';
import type { CampusAudience } from '@/types/campus';

const KIND_FILTERS = ['all', ...HOUSING_KINDS] as const;

type Props = {
  audience: CampusAudience;
  value: HousingFilterState;
  onChange: (patch: Partial<HousingFilterState>) => void;
  /** The place the search names, e.g. 'Kothanur'. The ring is ignored then. */
  searchedPlace?: string | null;
  className?: string;
};

/**
 * Housing feed filters: search ('under 9k', 'kjc', 'Kothnur', 'girls'),
 * distance ring, From students toggle, post type and, outside Girls' space, gender.
 */
export function HousingFilters({ audience, value, onChange, searchedPlace, className }: Props) {
  const girls = audience === 'girls';

  return (
    <div className={cn('min-w-0', className)}>
      <SearchPill
        value={value.q}
        onChange={(event) => onChange({ q: event.target.value, showFarther: false })}
        placeholder="Try 'under 9k' or 'Kothanur'"
        aria-label="Search housing by area, price or serial"
        enterKeyHint="search"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
        <RingChips
          value={value.ring}
          onChange={(ring) => onChange({ ring, showFarther: false })}
          label="Distance from campus"
          className={cn(searchedPlace && 'opacity-50')}
        />
        <button
          type="button"
          role="switch"
          aria-checked={value.fromStudents}
          onClick={() => onChange({ fromStudents: !value.fromStudents })}
          className="campus-press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-surface pl-3 pr-1 text-[12px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40"
        >
          From students
          <span
            aria-hidden="true"
            className={cn('relative h-5 w-8 rounded-full transition-colors', value.fromStudents ? 'bg-ink' : 'bg-line')}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.2)] transition-[left]',
                value.fromStudents ? 'left-[14px]' : 'left-0.5',
              )}
            />
          </span>
        </button>
      </div>
      {searchedPlace ? (
        <p className="mt-1 text-[11px] font-semibold text-slate">Showing every post in {searchedPlace}</p>
      ) : null}

      <div role="group" aria-label="Filter by post type" className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 no-scrollbar">
        {KIND_FILTERS.map((kind) => (
          <Chip key={kind} selected={value.kind === kind} onClick={() => onChange({ kind })}>
            {kind === 'all' ? 'All' : HOUSING_KIND_LABELS[kind]}
          </Chip>
        ))}
      </div>

      {girls ? null : (
        <GenderChips
          className="mt-2"
          label="Who can stay"
          value={value.gender}
          onChange={(gender) => onChange({ gender })}
        />
      )}
    </div>
  );
}
