'use client';

// New listing form v2: seat and cab split fields, plus the small field bits
// every kind's fields share (label, chip group, count chips, notes). The bits
// live here, not in registry.tsx, so the field files never import the registry
// at runtime.

import type { ReactNode } from 'react';
import { GenderChips } from '@/components/campus/fields/GenderChips';
import { Chip, Segmented } from '@/components/swoop/primitives';
import { formatPrice } from '@/lib/format/price';
import { cn } from '@/lib/utils/cn';
import type { KindFieldsProps } from './registry';
import {
  CAB_SIZE_MAX,
  CAB_SIZE_MIN,
  OPERATOR_MAX,
  PLACE_MAX,
  istNowLocal,
  seatsLeftMax,
  type CabDirection,
  type TripMode,
} from './payload';

// ---------------------------------------------------------------- shared bits

export const FIELD_INPUT = 'campus-input text-[13px] font-semibold text-ink';

export function FieldLabel({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11.5px] font-bold text-ink">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint ? <span className="mt-0.5 block text-[11px] text-slate">{hint}</span> : null}
    </label>
  );
}

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="min-w-0">
      <span className="block text-[11.5px] font-bold text-ink" aria-hidden="true">
        {label}
      </span>
      <div className="mt-1 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** One chip per whole number from min to max. */
export function CountChips({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const counts = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
  return (
    <ChipGroup label={label}>
      {counts.map((count) => (
        <Chip key={count} selected={value === count} onClick={() => onChange(count)} className="min-w-9 justify-center">
          {count}
        </Chip>
      ))}
    </ChipGroup>
  );
}

/** One short line under a field. 'warn' for things the student should fix or check. */
export function FieldNote({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <p
      role={tone === 'warn' ? 'status' : undefined}
      className={cn(
        'rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-bold',
        tone === 'warn' ? 'bg-market-tint text-market' : 'bg-surface text-slate',
      )}
    >
      {children}
    </p>
  );
}

// ---------------------------------------------------------------- seat

const TRIP_MODES: { value: TripMode; label: string }[] = [
  { value: 'bus', label: 'Bus' },
  { value: 'train', label: 'Train' },
];

export function SeatFields({ state, update, girls, now }: KindFieldsProps) {
  const train = state.tripMode === 'train';
  return (
    <>
      <Segmented label="Seat on" options={TRIP_MODES} value={state.tripMode} onChange={(tripMode) => update({ tripMode })} />
      <div className="grid grid-cols-2 gap-2">
        <FieldLabel label="From">
          <input
            type="text"
            value={state.from}
            maxLength={PLACE_MAX}
            onChange={(event) => update({ from: event.target.value })}
            placeholder="Manipal"
            autoComplete="off"
            className={FIELD_INPUT}
          />
        </FieldLabel>
        <FieldLabel label="To">
          <input
            type="text"
            value={state.to}
            maxLength={PLACE_MAX}
            onChange={(event) => update({ to: event.target.value })}
            placeholder="Chennai"
            autoComplete="off"
            className={FIELD_INPUT}
          />
        </FieldLabel>
      </div>
      <FieldLabel label="Leaves at" hint="Ends when it leaves">
        <input
          type="datetime-local"
          value={state.departure}
          min={istNowLocal(now)}
          onChange={(event) => update({ departure: event.target.value })}
          className={FIELD_INPUT}
        />
      </FieldLabel>
      <FieldLabel label={train ? 'Train name or number, optional' : 'Bus operator, optional'}>
        <input
          type="text"
          value={state.operator}
          maxLength={OPERATOR_MAX}
          onChange={(event) => update({ operator: event.target.value })}
          placeholder={train ? '12658 Chennai Mail' : 'VRL, SRS, KSRTC…'}
          autoComplete="off"
          className={FIELD_INPUT}
        />
      </FieldLabel>
      {train ? <FieldNote tone="warn">Name change rules apply</FieldNote> : null}
      <CountChips label="Seats" min={1} max={seatsLeftMax(state)} value={state.seatsLeft} onChange={(seatsLeft) => update({ seatsLeft })} />
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold text-ink">Seat is for</p>
        <GenderChips
          className="mt-1"
          label="Seat is for"
          value={girls ? 'girls' : state.genderPref}
          onChange={(genderPref) => update({ genderPref })}
          locked={girls}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- cab split

const CAB_DIRECTIONS: { value: CabDirection; label: string }[] = [
  { value: 'to_airport', label: 'To the airport' },
  { value: 'from_airport', label: 'From the airport' },
];

export function CabSplitFields({ state, update, girls, now }: KindFieldsProps) {
  const setCabSize = (cabSize: number) => update({ cabSize, seatsLeft: Math.min(state.seatsLeft, cabSize - 1) });
  return (
    <>
      <Segmented
        label="Which way"
        options={CAB_DIRECTIONS}
        value={state.cabDirection}
        onChange={(cabDirection) => update({ cabDirection })}
      />
      <FieldLabel label="Leaves at" hint="Ends when the cab leaves">
        <input
          type="datetime-local"
          value={state.departure}
          min={istNowLocal(now)}
          onChange={(event) => update({ departure: event.target.value })}
          className={FIELD_INPUT}
        />
      </FieldLabel>
      <CountChips label="People in the cab, with you" min={CAB_SIZE_MIN} max={CAB_SIZE_MAX} value={state.cabSize} onChange={setCabSize} />
      <CountChips label="Seats left" min={1} max={seatsLeftMax(state)} value={state.seatsLeft} onChange={(seatsLeft) => update({ seatsLeft })} />
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold text-ink">Ride with</p>
        <GenderChips
          className="mt-1"
          label="Ride with"
          value={girls ? 'girls' : state.genderPref}
          onChange={(genderPref) => update({ genderPref })}
          locked={girls}
        />
      </div>
    </>
  );
}

/** Under the fare: the whole fare and how it splits. */
export function CabFareNote({ state }: KindFieldsProps) {
  if (state.price === null || state.price <= 0) return <FieldNote>Fare per person, split {state.cabSize} ways</FieldNote>;
  return (
    <FieldNote>
      Total {formatPrice(state.price * state.cabSize)}, split {state.cabSize} ways
    </FieldNote>
  );
}
