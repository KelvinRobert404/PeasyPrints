'use client';

import { useId, useMemo, useState } from 'react';
import { IconTile, SearchPill, Tag } from '@/components/swoop/primitives';
import { CheckIcon, LandmarkIcon, PinIcon } from '@/components/swoop/icons';
import { campusesOf, getCampus, listColleges, searchColleges } from '@/lib/campus/catalog';
import type { CollegePick } from '@/lib/stores/collegeStore';
import type { Campus, College } from '@/types/college';
import { cn } from '@/lib/utils/cn';

type CollegePickerProps = {
  value: CollegePick | null;
  /** Called with a full pick, or null when a new college still needs a campus. */
  onChange: (pick: CollegePick | null) => void;
  className?: string;
};

/**
 * Pre-sign-in college and campus picker. Presentational: the parent owns the
 * value (usually useCollegeStore's pick) and the next step.
 */
export function CollegePicker({ value, onChange, className }: CollegePickerProps) {
  const headingId = useId();
  const [query, setQuery] = useState('');
  // College whose campus rows are open. Starts on the current pick.
  const [openCollegeId, setOpenCollegeId] = useState<string | null>(value?.collegeId ?? null);

  const colleges = useMemo<readonly College[]>(
    () => (query.trim() ? searchColleges(query) : listColleges()),
    [query]
  );

  const chooseCollege = (college: College) => {
    const campuses = campusesOf(college.id);
    if (campuses.length === 1) {
      setOpenCollegeId(null);
      onChange({ collegeId: college.id, campusId: campuses[0].id });
      return;
    }
    setOpenCollegeId((open) => (open === college.id ? null : college.id));
    // Picking another college clears the old campus until a new one is chosen.
    if (value && value.collegeId !== college.id) onChange(null);
  };

  const chooseCampus = (campus: Campus) => {
    onChange({ collegeId: campus.collegeId, campusId: campus.id });
  };

  const pickedCampus = getCampus(value?.campusId);

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-2', className)}>
      <h2 id={headingId} className="font-heading text-[16px] text-ink">
        Hey, which college are you at?
      </h2>
      <SearchPill
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your college"
        aria-label="Search colleges"
        autoComplete="off"
        enterKeyHint="search"
      />
      {colleges.length === 0 ? (
        <p className="px-1 py-3 text-[12px] text-slate">No college found. Try its short name.</p>
      ) : (
        <ul className="flex flex-col">
          {colleges.map((college) => {
            const campuses = campusesOf(college.id);
            const multi = campuses.length > 1;
            const open = multi && openCollegeId === college.id;
            const selected = value?.collegeId === college.id;
            const subtitle = selected && pickedCampus
              ? pickedCampus.label
              : multi
                ? `${campuses.length} campuses`
                : campuses[0]?.label ?? college.name;
            return (
              <li key={college.id}>
                <button
                  type="button"
                  aria-pressed={selected && !open}
                  aria-expanded={multi ? open : undefined}
                  onClick={() => chooseCollege(college)}
                  className={cn(
                    'campus-press flex w-full items-center gap-2.5 rounded-[12px] px-2 text-left transition-colors',
                    selected ? 'bg-royal-tint' : 'bg-white'
                  )}
                >
                  <IconTile icon={LandmarkIcon} tone={selected ? 'royal' : 'surface'} size={32} />
                  <span className="flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-px">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-bold text-ink">{college.shortName}</span>
                      {college.launchState === 'waitlist' && <Tag tone="ink">Opening soon</Tag>}
                    </span>
                    <span className="truncate text-[11px] text-slate">{subtitle}</span>
                  </span>
                  {selected && !open && <CheckIcon size={16} className="shrink-0 text-royal" />}
                </button>
                {open && (
                  <ul aria-label={`${college.shortName} campuses`} className="ml-[42px] flex flex-col border-l border-line pl-2">
                    {campuses.map((campus) => {
                      const campusSelected = value?.campusId === campus.id;
                      return (
                        <li key={campus.id}>
                          <button
                            type="button"
                            aria-pressed={campusSelected}
                            onClick={() => chooseCampus(campus)}
                            className={cn(
                              'campus-press flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2 text-left transition-colors',
                              campusSelected ? 'bg-royal-tint' : 'bg-white'
                            )}
                          >
                            <PinIcon size={16} className={cn('shrink-0', campusSelected ? 'text-royal' : 'text-slate')} />
                            <span className="flex min-w-0 flex-1 flex-col gap-px">
                              <span className="truncate text-[12px] font-bold text-ink">{campus.label}</span>
                              <span className="truncate text-[11px] text-slate">{campus.name}</span>
                            </span>
                            {campusSelected && <CheckIcon size={16} className="shrink-0 text-royal" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default CollegePicker;
