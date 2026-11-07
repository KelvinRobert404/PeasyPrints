'use client';

// New listing form v2: vehicle fields. Plate state, RC and insurance only for
// motor types; a cycle has none of them.

import { Chip, Segmented } from '@/components/swoop/primitives';
import { PLATE_STATES, type PlateStateCode } from '@/lib/campus/market';
import type { VehicleOffer } from '@/types/market';
import type { KindFieldsProps } from './registry';
import { ChipGroup, FIELD_INPUT, FieldLabel, FieldNote } from './TripFields';
import { insuranceValidity, isMotorType, type FormVehicleType } from './payload';

const VEHICLE_TYPES: { value: FormVehicleType; label: string }[] = [
  { value: 'cycle', label: 'Cycle' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'bike', label: 'Bike' },
  { value: 'car', label: 'Car' },
];

const OFFERS: { value: VehicleOffer; label: string }[] = [
  { value: 'sale', label: 'Sell' },
  { value: 'rent', label: 'Rent out' },
];

export function VehicleFields({ state, update, now }: KindFieldsProps) {
  const motor = isMotorType(state.vehicleType);
  const insurance = motor ? insuranceValidity(state.insuranceUntil, now) : null;
  return (
    <>
      <Segmented
        label="Vehicle type"
        options={VEHICLE_TYPES}
        value={state.vehicleType}
        onChange={(vehicleType) => update({ vehicleType })}
      />
      <Segmented label="Sell or rent" options={OFFERS} value={state.offer} onChange={(offer) => update({ offer })} />
      {motor ? (
        <>
          <FieldLabel label="Plate state">
            <select
              value={state.plateState}
              onChange={(event) => update({ plateState: event.target.value as PlateStateCode })}
              className={FIELD_INPUT}
            >
              {PLATE_STATES.map((plate) => (
                <option key={plate.code} value={plate.code}>
                  {plate.code}, {plate.name}
                </option>
              ))}
            </select>
          </FieldLabel>
          <ChipGroup label="RC with you?">
            <Chip
              selected={state.rcWithSeller === true}
              onClick={() => update({ rcWithSeller: state.rcWithSeller === true ? null : true })}
            >
              Yes, RC with me
            </Chip>
            <Chip
              selected={state.rcWithSeller === false}
              onClick={() => update({ rcWithSeller: state.rcWithSeller === false ? null : false })}
            >
              Not with me
            </Chip>
          </ChipGroup>
          <FieldLabel label="Insurance valid till, optional">
            <input
              type="date"
              value={state.insuranceUntil}
              onChange={(event) => update({ insuranceUntil: event.target.value })}
              className={FIELD_INPUT}
            />
          </FieldLabel>
          {insurance === 'expired' ? <FieldNote tone="warn">Insurance lapsed</FieldNote> : null}
          {insurance === 'expiring' ? <FieldNote>Insurance ends within a month</FieldNote> : null}
        </>
      ) : null}
    </>
  );
}
