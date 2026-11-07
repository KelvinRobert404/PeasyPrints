'use client';

import { useId } from 'react';
import { CloseIcon, PlusIcon } from '@/components/swoop/icons';
import { MAX_BUNDLE_ITEMS } from '@/lib/campus/market';
import { formatPrice, parsePriceInput } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';
import { BUNDLE_PART_TITLE_MAX, HAND_OVER_MAX, newBundleRow, type BundleRow } from './payload';

type Props = {
  rows: BundleRow[];
  onRowsChange: (rows: BundleRow[]) => void;
  /** 'YYYY-MM-DD' or empty. */
  availableUntil: string;
  onAvailableUntilChange: (value: string) => void;
  handOver: string;
  onHandOverChange: (value: string) => void;
  /** Free bundles hide the per-thing prices. */
  free?: boolean;
  className?: string;
};

const INPUT =
  'h-10 min-w-0 rounded-[10px] border border-transparent bg-surface px-3 text-[13px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate focus:border-royal focus:bg-white';

/** Today in IST as 'YYYY-MM-DD', for the date box minimum. */
function todayIst(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function rowPreview(text: string): { label: string; invalid: boolean } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parsed = parsePriceInput(trimmed);
  return parsed === null ? { label: 'Try 1.5k or 900', invalid: true } : { label: formatPrice(parsed), invalid: false };
}

/**
 * Room clear-out list: one row per thing with an optional price, add and
 * remove, the date it is available till and a short hand-over line.
 */
export function BundleItemsField({
  rows,
  onRowsChange,
  availableUntil,
  onAvailableUntilChange,
  handOver,
  onHandOverChange,
  free = false,
  className,
}: Props) {
  const id = useId();
  const full = rows.length >= MAX_BUNDLE_ITEMS;

  const update = (rowId: string, patch: Partial<BundleRow>) =>
    onRowsChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  const remove = (rowId: string) => {
    const next = rows.filter((row) => row.id !== rowId);
    onRowsChange(next.length ? next : [newBundleRow()]);
  };
  const add = () => {
    if (!full) onRowsChange([...rows, newBundleRow()]);
  };

  return (
    <div className={cn('min-w-0 space-y-3', className)}>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p id={`${id}-things`} className="text-[11.5px] font-bold text-ink">
            What is in it?
          </p>
          <span className="text-[11px] font-semibold tabular-nums text-slate">
            {rows.length} of {MAX_BUNDLE_ITEMS}
          </span>
        </div>
        <ul aria-labelledby={`${id}-things`} className="mt-1 space-y-1.5">
          {rows.map((row, index) => {
            const preview = free ? null : rowPreview(row.priceText);
            return (
              <li key={row.id}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={row.title}
                    maxLength={BUNDLE_PART_TITLE_MAX}
                    onChange={(event) => update(row.id, { title: event.target.value })}
                    placeholder={index === 0 ? 'Table fan' : 'Another thing'}
                    aria-label={`Thing ${index + 1}`}
                    autoComplete="off"
                    className={cn(INPUT, 'flex-1')}
                  />
                  {free ? null : (
                    <label className="flex h-10 w-[92px] shrink-0 items-center gap-1 rounded-[10px] border border-transparent bg-surface pl-2.5 pr-2 focus-within:border-royal focus-within:bg-white">
                      <span className="text-[12px] font-bold text-slate" aria-hidden="true">
                        Rs
                      </span>
                      <span className="sr-only">Price for thing {index + 1}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.priceText}
                        onChange={(event) => update(row.id, { priceText: event.target.value })}
                        placeholder="500"
                        autoComplete="off"
                        aria-invalid={preview?.invalid || undefined}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold tabular-nums text-ink outline-none placeholder:font-medium placeholder:text-slate"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    aria-label={`Remove thing ${index + 1}`}
                    className="campus-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink"
                  >
                    <CloseIcon size={13} />
                  </button>
                </div>
                {preview ? (
                  <p className={cn('mt-0.5 pr-12 text-right text-[11px] font-bold tabular-nums', preview.invalid ? 'text-market' : 'text-slate')}>
                    {preview.label}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={add}
          disabled={full}
          className="campus-press mt-1.5 inline-flex h-8 items-center gap-1 rounded-full bg-surface px-3 text-[12px] font-bold text-ink disabled:opacity-45"
        >
          <PlusIcon size={13} aria-hidden="true" />
          {full ? 'List is full' : 'Add a thing'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-[11.5px] font-bold text-ink">
          Available till
          <input
            type="date"
            value={availableUntil}
            min={todayIst()}
            onChange={(event) => onAvailableUntilChange(event.target.value)}
            className={cn(INPUT, 'mt-1 block w-full')}
          />
        </label>
        <label className="block min-w-0 text-[11.5px] font-bold text-ink">
          Hand over
          <input
            type="text"
            value={handOver}
            maxLength={HAND_OVER_MAX}
            onChange={(event) => onHandOverChange(event.target.value)}
            placeholder="At my PG gate, after 5 pm"
            autoComplete="off"
            className={cn(INPUT, 'mt-1 block w-full')}
          />
          <span className="mt-0.5 block text-right text-[11px] font-semibold tabular-nums text-slate">
            {handOver.length}/{HAND_OVER_MAX}
          </span>
        </label>
      </div>
    </div>
  );
}
