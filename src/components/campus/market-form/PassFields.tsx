'use client';

// New listing form v2: mess and gym pass fields. The price starts at the fair
// price (paid, pro-rata by days left) and follows the dates until the student
// types their own.

import { PriceInput } from '@/components/campus/fields/PriceInput';
import { Segmented } from '@/components/swoop/primitives';
import { formatPrice } from '@/lib/format/price';
import type { KindFieldsProps } from './registry';
import { FIELD_INPUT, FieldLabel, FieldNote } from './TripFields';
import { PROVIDER_MAX, aboveFairPrice, istToday, passChange, passFairPrice, type FormPassType } from './payload';

const PASS_TYPES: { value: FormPassType; label: string }[] = [
  { value: 'mess', label: 'Mess' },
  { value: 'gym', label: 'Gym' },
];

export function PassFields({ state, update, now }: KindFieldsProps) {
  const mess = state.passType === 'mess';
  return (
    <>
      <Segmented label="Pass for" options={PASS_TYPES} value={state.passType} onChange={(passType) => update({ passType })} />
      <FieldLabel label={mess ? 'Mess name, optional' : 'Gym name, optional'}>
        <input
          type="text"
          value={state.provider}
          maxLength={PROVIDER_MAX}
          onChange={(event) => update({ provider: event.target.value })}
          placeholder={mess ? 'Annapoorna mess' : 'Gold’s Gym'}
          autoComplete="off"
          className={FIELD_INPUT}
        />
      </FieldLabel>
      {mess ? <FieldNote tone="warn">Check your mess allows transfer</FieldNote> : null}
      <PriceInput
        label="You paid, optional"
        placeholder="3k"
        value={state.paid}
        onChange={(paid) => update(passChange(state, { paid }, now))}
      />
      <div className="grid grid-cols-2 gap-2">
        <FieldLabel label="Valid from">
          <input
            type="date"
            value={state.validFrom}
            onChange={(event) => update(passChange(state, { validFrom: event.target.value }, now))}
            className={FIELD_INPUT}
          />
        </FieldLabel>
        <FieldLabel label="Valid until">
          <input
            type="date"
            value={state.validUntil}
            min={istToday(now)}
            onChange={(event) => update(passChange(state, { validUntil: event.target.value }, now))}
            className={FIELD_INPUT}
          />
        </FieldLabel>
      </div>
    </>
  );
}

/** Under the price: the live fair price, and a warning when the price is over it. */
export function PassPriceNote({ state, now }: KindFieldsProps) {
  const fair = passFairPrice(state, now);
  if (fair === null) return <FieldNote>Add paid and dates for a fair price</FieldNote>;
  if (fair === 0) return <FieldNote tone="warn">This pass has ended</FieldNote>;
  if (aboveFairPrice(state, now)) {
    return <FieldNote tone="warn">Above fair price of {formatPrice(fair)}</FieldNote>;
  }
  return <FieldNote>Fair price now: {formatPrice(fair)}</FieldNote>;
}
