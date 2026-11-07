'use client';

import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { BookIcon, CheckIcon } from '@/components/swoop/icons';
import { Chip, IconTile, Tag, swButton } from '@/components/swoop/primitives';
import { courseLabel, getProgramme, listProgrammes, validateCourse } from '@/lib/campus/courses';
import type { MembershipCourse } from '@/types/campus';
import { cn } from '@/lib/utils/cn';

export type CourseSubmitResult = { ok: true } | { ok: false; error: string };

const LEVELS = [
  { level: 'ug', label: 'Undergraduate' },
  { level: 'pg', label: 'Postgraduate' },
] as const;

/**
 * Step 3: "What do you study?". Programme, an optional specialisation from the
 * programme's suggestions, and a semester from 1 to the programme's length.
 * Pure UI: the parent saves the course.
 */
export function CourseStep({
  initial,
  note,
  onSubmit,
}: {
  initial?: MembershipCourse | null;
  /** Shown above the form, e.g. a pending ID card. */
  note?: ReactNode;
  onSubmit: (course: MembershipCourse) => Promise<CourseSubmitResult>;
}) {
  const headingId = useId();
  const programmeId = useId();
  const errorId = useId();
  const [programme, setProgramme] = useState(initial?.programmeId ?? '');
  const [specialisation, setSpecialisation] = useState<string | null>(initial?.specialisation ?? null);
  const [semester, setSemester] = useState<number | null>(initial?.semester ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = getProgramme(programme);
  const semesters = useMemo(
    () => (picked ? Array.from({ length: picked.semesters }, (_, index) => index + 1) : []),
    [picked]
  );

  const chooseProgramme = (id: string) => {
    const next = getProgramme(id);
    setProgramme(id);
    setError(null);
    // Keep what still fits the new programme; drop the rest.
    setSpecialisation((current) => (current && next?.specialisations.includes(current) ? current : null));
    setSemester((current) => (current && next && current <= next.semesters ? current : null));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!picked) {
      setError('Pick your course first.');
      return;
    }
    if (!semester) {
      setError('Pick your semester.');
      return;
    }
    const checked = validateCourse({ programmeId: picked.id, semester, specialisation });
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSubmit({
      programmeId: checked.course.programmeId,
      specialisation: checked.course.specialisation,
      semester: checked.course.semester,
    });
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h2 id={headingId} className="font-heading text-[16px] leading-[1.15] text-ink">
          What do you study?
        </h2>
        <p className="mt-1 text-[12px] leading-[1.45] text-slate">So we show notes and books for you.</p>
      </div>
      {note}
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={programmeId} className="text-[12px] font-bold text-ink">
            Course
          </label>
          <select
            id={programmeId}
            value={programme}
            disabled={busy}
            onChange={(event) => chooseProgramme(event.target.value)}
            className={cn(
              'h-11 w-full rounded-[10px] border border-transparent bg-surface px-3 text-[16px] outline-none focus:border-royal focus:bg-white disabled:opacity-45',
              programme ? 'text-ink' : 'text-slate'
            )}
          >
            <option value="" disabled>
              Pick your course
            </option>
            {LEVELS.map(({ level, label }) => (
              <optgroup key={level} label={label}>
                {listProgrammes(level).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.fullName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {picked && picked.specialisations.length > 0 ? (
          <fieldset className="flex min-w-0 flex-col gap-1.5" disabled={busy}>
            <legend className="mb-1.5 text-[12px] font-bold text-ink">
              Specialisation <span className="font-semibold text-slate">(optional)</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {picked.specialisations.map((option) => (
                <Chip
                  key={option}
                  selected={specialisation === option}
                  onClick={() => setSpecialisation((current) => (current === option ? null : option))}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </fieldset>
        ) : null}

        {picked ? (
          <fieldset className="flex min-w-0 flex-col" disabled={busy}>
            <legend className="mb-1.5 text-[12px] font-bold text-ink">Semester</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {semesters.map((value) => {
                const selected = semester === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Semester ${value}`}
                    onClick={() => {
                      setSemester(value);
                      setError(null);
                    }}
                    className={cn(
                      'campus-press h-10 rounded-[10px] text-[13px] transition-colors',
                      selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink'
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate">
              {picked.name} runs sem 1 to {picked.semesters}.
            </p>
          </fieldset>
        ) : null}

        {error ? (
          <p id={errorId} role="alert" className="text-[11.5px] font-semibold text-market">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !picked || !semester}
          aria-describedby={error ? errorId : undefined}
          className={swButton({ size: 'lg', className: 'w-full' })}
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </section>
  );
}

/** Done state: verified, with the saved course. */
export function CourseSummary({
  displayName,
  campusLabel,
  course,
  action,
}: {
  displayName?: string | null;
  campusLabel?: string | null;
  course?: MembershipCourse | null;
  action?: ReactNode;
}) {
  const programme = getProgramme(course?.programmeId);
  const label =
    course && programme
      ? courseLabel({ programmeName: programme.name, specialisation: course.specialisation, semester: course.semester })
      : null;
  return (
    <section className="flex flex-col gap-2 rounded-[14px] bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <IconTile icon={CheckIcon} tone="go" size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-[16px] leading-[1.15] text-ink">
              {displayName ? `Hey ${displayName}, you’re in` : 'You’re in'}
            </h2>
            <Tag tone="go">Verified</Tag>
          </div>
          <p className="mt-1 text-[12px] leading-[1.45] text-slate">
            {campusLabel ? `Verified student at ${campusLabel}.` : 'Verified student.'}
          </p>
        </div>
      </div>
      {label ? (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <BookIcon size={14} className="shrink-0 text-slate" />
          {label}
        </p>
      ) : null}
      {action}
    </section>
  );
}

export default CourseStep;
