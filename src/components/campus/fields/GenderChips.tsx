'use client';

import { useEffect, useState } from 'react';
import { LockIcon } from '@/components/swoop/icons';
import { GENDER_PREF_LABELS } from '@/lib/campus/constants';
import { cn } from '@/lib/utils/cn';
import type { GenderPref } from '@/types/campus';

const OPTIONS: readonly GenderPref[] = ['girls', 'boys', 'anyone'];

const CHIP =
  'campus-press inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 disabled:pointer-events-none';

type Props = {
  value?: GenderPref;
  defaultValue?: GenderPref;
  onChange?: (value: GenderPref) => void;
  /** Girls' space posts: fixed to 'For girls', other options greyed out. */
  locked?: boolean;
  label?: string;
  className?: string;
};

/** 'For girls / For boys / Anyone' chips. */
export function GenderChips({ value, defaultValue = 'anyone', onChange, locked = false, label = 'Who can reply', className }: Props) {
  const [inner, setInner] = useState<GenderPref>(defaultValue);
  const current: GenderPref = locked ? 'girls' : value ?? inner;

  // A locked field always reports girls, so the parent's form state matches what is shown.
  useEffect(() => {
    if (locked && value !== 'girls') onChange?.('girls');
  }, [locked, value]);

  const pick = (next: GenderPref) => {
    if (locked) return;
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  return (
    <div className={cn('min-w-0', className)}>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {OPTIONS.map((option) => {
          const selected = option === current;
          const off = locked && !selected;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              aria-disabled={locked || undefined}
              disabled={off}
              onClick={() => pick(option)}
              className={cn(
                CHIP,
                selected
                  ? option === 'girls'
                    ? 'bg-girls font-bold text-white'
                    : 'bg-ink font-bold text-white'
                  : 'bg-surface font-semibold text-ink',
                off && 'opacity-45',
                locked && selected && 'cursor-default',
              )}
            >
              {locked && selected ? <LockIcon size={13} aria-hidden="true" /> : null}
              {GENDER_PREF_LABELS[option]}
            </button>
          );
        })}
      </div>
      {locked ? <p className="mt-1 text-[11px] font-semibold text-slate">Girls&apos; space posts are for girls only.</p> : null}
    </div>
  );
}
