'use client';

// New listing form v2: ticket fields. Resale is capped at the face value.

import { PriceInput } from '@/components/campus/fields/PriceInput';
import { formatPrice } from '@/lib/format/price';
import type { KindFieldsProps } from './registry';
import { CountChips, FIELD_INPUT, FieldLabel, FieldNote } from './TripFields';
import { TICKET_COUNT_MAX, VENUE_MAX, aboveFaceValue, isFreeTerms, istNowLocal } from './payload';

export function TicketFields({ state, update, now }: KindFieldsProps) {
  return (
    <>
      <FieldLabel label="Venue, optional">
        <input
          type="text"
          value={state.venue}
          maxLength={VENUE_MAX}
          onChange={(event) => update({ venue: event.target.value })}
          placeholder="Palace Grounds"
          autoComplete="off"
          className={FIELD_INPUT}
        />
      </FieldLabel>
      <FieldLabel label="Showtime" hint="Ends at showtime">
        <input
          type="datetime-local"
          value={state.showtime}
          min={istNowLocal(now)}
          onChange={(event) => update({ showtime: event.target.value })}
          className={FIELD_INPUT}
        />
      </FieldLabel>
      <div className="grid grid-cols-2 items-start gap-2">
        <PriceInput
          label="Face value, each"
          placeholder="500"
          value={state.faceValue}
          onChange={(faceValue) => update({ faceValue })}
        />
        <CountChips label="Tickets" min={1} max={TICKET_COUNT_MAX} value={state.quantity} onChange={(quantity) => update({ quantity })} />
      </div>
    </>
  );
}

/** Under the price: the face value cap, or the block when the price is over it. */
export function TicketPriceNote({ state }: KindFieldsProps) {
  if (state.faceValue === null || isFreeTerms(state.priceTerms)) return null;
  if (aboveFaceValue(state)) return <FieldNote tone="warn">Above face value. Lower the price.</FieldNote>;
  return <FieldNote>Up to {formatPrice(state.faceValue)}, the face value</FieldNote>;
}
