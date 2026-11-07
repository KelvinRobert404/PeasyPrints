'use client';

import type { ReactNode } from 'react';
import { GenderChips } from '@/components/campus/fields/GenderChips';
import { PriceInput } from '@/components/campus/fields/PriceInput';
import { PriceTermsChips } from '@/components/campus/fields/PriceTermsChips';
import { LandmarkPicker, type LandmarkPick } from '@/components/campus/places/LandmarkPicker';
import { MinusIcon, PlusIcon } from '@/components/swoop/icons';
import { Segmented } from '@/components/swoop/primitives';
import { STAY_TYPE_LABELS } from '@/lib/campus/constants';
import {
  FURNISHINGS,
  FURNISHING_LABELS,
  HOUSE_RULES,
  HOUSE_RULE_OPTION_LABELS,
  HOUSING_KINDS,
  HOUSING_KIND_LABELS,
  HOUSING_STAY_TYPES,
  toggleHouseRule,
  type HouseRuleOption,
  type HousingKind,
  type PostedAs,
  type RentTermsKind,
} from '@/lib/campus/housing/model';
import { MAX_BEDS } from '@/lib/campus/housing/schema';
import { istDateKey } from '@/lib/campus/season';
import type { LatLng } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';
import type { GenderPref } from '@/types/campus';
import type { Landmark } from '@/types/college';
import type { Furnishing, HousingStayType } from '@/types/housing';

/* ──────────────────────────────────────────────────────────
   Housing post form v2: field blocks. State lives in
   HousingPostForm; every block here is controlled.
   ────────────────────────────────────────────────────────── */

/** Who is posting, as the form asks it. Every poster is a verified student. */
export type PosterRole = 'student' | 'owner' | 'agent';

export const POSTER_ROLE_OPTIONS: { value: PosterRole; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'owner', label: 'Owner' },
  { value: 'agent', label: 'Agent' },
];

/** Form role to the stored 'posted as'. A student on a replacement is moving out. */
export function postedAsFor(role: PosterRole, kind: HousingKind): PostedAs {
  if (role === 'agent') return 'agent';
  if (role === 'owner') return 'owner_contact';
  return kind === 'replacement' ? 'leaving' : 'tenant';
}

export function roleFor(postedAs: PostedAs): PosterRole {
  if (postedAs === 'agent') return 'agent';
  if (postedAs === 'owner_contact') return 'owner';
  return 'student';
}

export type MoveInMode = 'now' | 'next_month' | 'next_sem' | 'date';

export const AMENITIES = ['Wi-Fi', 'Attached bath', 'Kitchen', 'Power backup', 'Parking', 'Security', 'Laundry', 'Meals'] as const;
export const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Malayalam', 'Tamil', 'Telugu', 'Bengali', 'Marathi'] as const;
export const MAX_LANGUAGES = 5;
export const MAX_GROUP = 6;
const SHARING_OPTIONS = [1, 2, 3, 4] as const;

export interface HousingFormState {
  kind: HousingKind;
  role: PosterRole;
  /** Agent only: null until the poster says. */
  brokerageCharged: boolean | null;
  brokerageAmount: number | null;
  stayType: HousingStayType | null;
  title: string;
  description: string;
  rentPp: number | null;
  deposit: number | null;
  rentTerms: RentTermsKind;
  moveInMode: MoveInMode | null;
  /** IST date 'YYYY-MM-DD' for 'Pick date'. */
  moveInDate: string;
  bedsLeft: number;
  sharing: number | null;
  whoCanStay: GenderPref | null;
  houseRules: HouseRuleOption[];
  furnishing: Furnishing | null;
  amenities: string[];
  images: string[];
  place: LandmarkPick | null;
  groupSize: number;
  homeState: string;
  languages: string[];
  whatsappNumber: string;
}

/** Field keys used for errors, paste highlights and scroll targets. */
export type FieldKey =
  | 'kind'
  | 'postedAs'
  | 'brokerage'
  | 'stayType'
  | 'title'
  | 'description'
  | 'rentPp'
  | 'deposit'
  | 'rentTerms'
  | 'moveIn'
  | 'bedsLeft'
  | 'sharing'
  | 'whoCanStay'
  | 'houseRules'
  | 'furnishing'
  | 'amenities'
  | 'images'
  | 'place'
  | 'roommate'
  | 'whatsappNumber';

export type FieldErrors = Partial<Record<FieldKey, string>>;

export function fieldId(key: FieldKey): string {
  return `hf-${key}`;
}

/** 1st of next month as an IST date key. */
export function firstOfNextMonth(now: Date = new Date()): string {
  const [year, month] = istDateKey(now).split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

/** The schema's move-in value: 'now', 'next_sem' or a date key. Null when not picked. */
export function moveInValue(state: Pick<HousingFormState, 'moveInMode' | 'moveInDate'>, now: Date = new Date()): string | null {
  switch (state.moveInMode) {
    case 'now':
      return 'now';
    case 'next_sem':
      return 'next_sem';
    case 'next_month':
      return firstOfNextMonth(now);
    case 'date':
      return state.moveInDate || null;
    default:
      return null;
  }
}

/** A parsed move-in back to the chips. */
export function moveInModeFor(value: string, now: Date = new Date()): Pick<HousingFormState, 'moveInMode' | 'moveInDate'> {
  if (value === 'now') return { moveInMode: 'now', moveInDate: '' };
  if (value === 'next_sem') return { moveInMode: 'next_sem', moveInDate: '' };
  if (value === firstOfNextMonth(now)) return { moveInMode: 'next_month', moveInDate: '' };
  return { moveInMode: 'date', moveInDate: value };
}

/* Shared bits ------------------------------------------------ */

const CHIP =
  'campus-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40';

function chipClass(selected: boolean) {
  return cn(CHIP, selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink');
}

type BlockProps = {
  id: FieldKey;
  label?: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  /** Filled from a pasted WhatsApp post. */
  filled?: boolean;
  children: ReactNode;
  className?: string;
};

/** Label, paste highlight and error line around one field. */
export function FieldBlock({ id, label, hint, optional = false, error, filled = false, children, className }: BlockProps) {
  return (
    <div
      id={fieldId(id)}
      className={cn(
        'min-w-0 scroll-mt-16 rounded-[12px] transition-colors',
        filled && 'bg-royal-tint p-2 ring-1 ring-royal/30',
        error && 'bg-market-tint p-2 ring-1 ring-market/40',
        className,
      )}
    >
      {label ? (
        <div className="mb-1 flex items-center gap-1.5">
          <p className="text-[11.5px] font-bold text-ink">{label}</p>
          {optional ? <span className="text-[10.5px] font-semibold text-slate">Optional</span> : null}
          {filled ? <span className="ml-auto rounded-full bg-royal px-1.5 py-0.5 text-[9.5px] font-bold text-white">From paste</span> : null}
        </div>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1 text-[11px] font-semibold text-slate">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-[11.5px] font-bold text-market">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 pt-3.5">
      <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  display?: string;
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));
  const button =
    'campus-press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink disabled:pointer-events-none disabled:opacity-40 shadow-[0_1px_3px_rgba(16,24,40,0.10)]';
  return (
    <div className="flex h-11 items-center gap-2 rounded-[12px] bg-surface px-1.5">
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => step(-1)} className={button}>
        <MinusIcon size={14} />
      </button>
      <output aria-live="polite" aria-label={label} className="min-w-0 flex-1 text-center text-[13.5px] font-bold tabular-nums text-ink">
        {display ?? value}
      </output>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => step(1)} className={button}>
        <PlusIcon size={14} />
      </button>
    </div>
  );
}

/* Kind ---------------------------------------------------------- */

const KIND_OPTIONS = HOUSING_KINDS.map((value) => ({ value, label: HOUSING_KIND_LABELS[value] }));

export function KindField({ value, onChange, filled }: { value: HousingKind; onChange: (kind: HousingKind) => void; filled?: boolean }) {
  return (
    <FieldBlock id="kind" label="What are you posting?" filled={filled}>
      <Segmented label="Post type" options={KIND_OPTIONS} value={value} onChange={onChange} />
    </FieldBlock>
  );
}

/* Posting as + brokerage --------------------------------------- */

type PostingAsProps = {
  role: PosterRole;
  onRoleChange: (role: PosterRole) => void;
  brokerageCharged: boolean | null;
  brokerageAmount: number | null;
  onBrokerageChange: (charged: boolean | null, amount: number | null) => void;
  errors: FieldErrors;
  filled: ReadonlySet<FieldKey>;
};

export function PostingAsField({ role, onRoleChange, brokerageCharged, brokerageAmount, onBrokerageChange, errors, filled }: PostingAsProps) {
  return (
    <>
      <FieldBlock
        id="postedAs"
        label="Posting as"
        hint={role === 'agent' ? 'Agent posts must say the brokerage.' : role === 'owner' ? 'You share the owner’s contact.' : undefined}
        error={errors.postedAs}
        filled={filled.has('postedAs')}
      >
        <Segmented label="Posting as" options={POSTER_ROLE_OPTIONS} value={role} onChange={onRoleChange} />
      </FieldBlock>
      {role === 'agent' ? (
        <FieldBlock id="brokerage" label="Brokerage" error={errors.brokerage} filled={filled.has('brokerage')}>
          <div role="group" aria-label="Brokerage" className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={brokerageCharged === false} onClick={() => onBrokerageChange(false, null)} className={chipClass(brokerageCharged === false)}>
              No brokerage
            </button>
            <button type="button" aria-pressed={brokerageCharged === true} onClick={() => onBrokerageChange(true, brokerageAmount)} className={chipClass(brokerageCharged === true)}>
              Brokerage charged
            </button>
          </div>
          {brokerageCharged ? (
            <PriceInput
              className="mt-2"
              label="Brokerage amount"
              placeholder="8.5k"
              value={brokerageAmount}
              onChange={(amount) => onBrokerageChange(true, amount)}
            />
          ) : null}
        </FieldBlock>
      ) : null}
    </>
  );
}

/* Stay type ---------------------------------------------------- */

export function StayTypeField({ value, onChange, error, filled }: { value: HousingStayType | null; onChange: (value: HousingStayType) => void; error?: string; filled?: boolean }) {
  return (
    <FieldBlock id="stayType" label="Type of place" error={error} filled={filled}>
      <div role="group" aria-label="Type of place" className="flex flex-wrap gap-1.5">
        {HOUSING_STAY_TYPES.map((type) => (
          <button key={type} type="button" aria-pressed={value === type} onClick={() => onChange(type)} className={chipClass(value === type)}>
            {STAY_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </FieldBlock>
  );
}

/* Rent, deposit, terms ----------------------------------------- */

type RentProps = {
  rentPp: number | null;
  deposit: number | null;
  rentTerms: RentTermsKind;
  onRentChange: (value: number | null) => void;
  onDepositChange: (value: number | null) => void;
  onTermsChange: (value: RentTermsKind) => void;
  errors: FieldErrors;
  filled: ReadonlySet<FieldKey>;
};

export function RentFields({ rentPp, deposit, rentTerms, onRentChange, onDepositChange, onTermsChange, errors, filled }: RentProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <FieldBlock id="rentPp" error={errors.rentPp} filled={filled.has('rentPp')}>
          <PriceInput label="Rent per person" placeholder="8.5k" suffix="pp" value={rentPp} onChange={onRentChange} />
        </FieldBlock>
        <FieldBlock id="deposit" error={errors.deposit} filled={filled.has('deposit')}>
          <PriceInput label="Deposit" placeholder="1L" suffix="dep" value={deposit} onChange={onDepositChange} />
        </FieldBlock>
      </div>
      <FieldBlock id="rentTerms" label="Rent terms" error={errors.rentTerms} filled={filled.has('rentTerms')}>
        <PriceTermsChips mode="rent" label="Rent terms" value={rentTerms} onChange={onTermsChange} />
      </FieldBlock>
    </>
  );
}

/* Move-in ------------------------------------------------------ */

const MOVE_IN_OPTIONS: { value: MoveInMode; label: string }[] = [
  { value: 'now', label: 'Immediate' },
  { value: 'next_month', label: '1st of next month' },
  { value: 'next_sem', label: 'Next sem' },
  { value: 'date', label: 'Pick date' },
];

type MoveInProps = {
  mode: MoveInMode | null;
  date: string;
  onChange: (mode: MoveInMode, date: string) => void;
  error?: string;
  filled?: boolean;
};

export function MoveInField({ mode, date, onChange, error, filled }: MoveInProps) {
  const today = istDateKey(new Date());
  return (
    <FieldBlock id="moveIn" label="Move-in" error={error} filled={filled}>
      <div role="group" aria-label="Move-in" className="flex flex-wrap gap-1.5">
        {MOVE_IN_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => onChange(option.value, option.value === 'date' ? date : '')}
            className={chipClass(mode === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {mode === 'date' ? (
        <label className="mt-2 block text-[11.5px] font-bold text-ink">
          Move-in date
          <input
            type="date"
            min={today}
            value={date}
            onChange={(event) => onChange('date', event.target.value)}
            className="campus-input mt-1"
          />
        </label>
      ) : null}
    </FieldBlock>
  );
}

/* Beds and sharing --------------------------------------------- */

type BedsProps = {
  bedsLeft: number;
  sharing: number | null;
  onBedsChange: (value: number) => void;
  onSharingChange: (value: number | null) => void;
  errors: FieldErrors;
  filled: ReadonlySet<FieldKey>;
};

export function BedsFields({ bedsLeft, sharing, onBedsChange, onSharingChange, errors, filled }: BedsProps) {
  const options: number[] = [...SHARING_OPTIONS];
  if (sharing !== null && !options.includes(sharing)) options.push(sharing);
  return (
    <>
      <FieldBlock id="bedsLeft" label="Beds left" error={errors.bedsLeft} filled={filled.has('bedsLeft')}>
        <Stepper label="Beds left" value={bedsLeft} min={1} max={MAX_BEDS} onChange={onBedsChange} display={`${bedsLeft} ${bedsLeft === 1 ? 'bed' : 'beds'} free`} />
      </FieldBlock>
      <FieldBlock id="sharing" label="Sharing" optional error={errors.sharing} filled={filled.has('sharing')}>
        <div role="group" aria-label="Sharing" className="flex flex-wrap gap-1.5">
          {options.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={sharing === count}
              onClick={() => onSharingChange(sharing === count ? null : count)}
              className={chipClass(sharing === count)}
            >
              {count === 1 ? 'Single' : `${count} sharing`}
            </button>
          ))}
        </div>
      </FieldBlock>
    </>
  );
}

/* Who can stay ------------------------------------------------- */

type WhoProps = {
  value: GenderPref | null;
  onChange: (value: GenderPref) => void;
  locked: boolean;
  error?: string;
  filled?: boolean;
};

export function WhoCanStayField({ value, onChange, locked, error, filled }: WhoProps) {
  return (
    <FieldBlock id="whoCanStay" label="Who can stay" error={error} filled={filled}>
      {/* GenderChips falls back to 'Anyone' when value is undefined. An empty
          value shows no chip picked, so the poster has to choose. */}
      <GenderChips label="Who can stay" locked={locked} value={value ?? ('' as GenderPref)} onChange={onChange} />
    </FieldBlock>
  );
}

/* House rules -------------------------------------------------- */

export function HouseRulesField({
  value,
  onChange,
  error,
  filled,
}: {
  value: HouseRuleOption[];
  onChange: (value: HouseRuleOption[]) => void;
  error?: string;
  filled?: boolean;
}) {
  return (
    <FieldBlock id="houseRules" label="House rules" hint="Pick all that apply." error={error} filled={filled}>
      <div role="group" aria-label="House rules" className="flex flex-wrap gap-1.5">
        {HOUSE_RULES.map((rule) => {
          const selected = value.includes(rule);
          return (
            <button key={rule} type="button" aria-pressed={selected} onClick={() => onChange(toggleHouseRule(value, rule))} className={chipClass(selected)}>
              {HOUSE_RULE_OPTION_LABELS[rule]}
            </button>
          );
        })}
      </div>
    </FieldBlock>
  );
}

/* Furnishing and amenities ------------------------------------- */

export function RoomExtrasFields({
  furnishing,
  amenities,
  onFurnishingChange,
  onAmenitiesChange,
  filled,
}: {
  furnishing: Furnishing | null;
  amenities: string[];
  onFurnishingChange: (value: Furnishing | null) => void;
  onAmenitiesChange: (value: string[]) => void;
  filled: ReadonlySet<FieldKey>;
}) {
  return (
    <>
      <FieldBlock id="furnishing" label="Furnishing" optional filled={filled.has('furnishing')}>
        <div role="group" aria-label="Furnishing" className="flex flex-wrap gap-1.5">
          {FURNISHINGS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={furnishing === option}
              onClick={() => onFurnishingChange(furnishing === option ? null : option)}
              className={chipClass(furnishing === option)}
            >
              {FURNISHING_LABELS[option]}
            </button>
          ))}
        </div>
      </FieldBlock>
      <FieldBlock id="amenities" label="Amenities" optional>
        <div role="group" aria-label="Amenities" className="flex flex-wrap gap-1.5">
          {AMENITIES.map((item) => {
            const selected = amenities.includes(item);
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => onAmenitiesChange(selected ? amenities.filter((entry) => entry !== item) : [...amenities, item])}
                className={chipClass(selected)}
              >
                {item}
              </button>
            );
          })}
        </div>
      </FieldBlock>
    </>
  );
}

/* Place -------------------------------------------------------- */

type PlaceProps = {
  landmarks: readonly Landmark[];
  origin: LatLng;
  campusCode: string;
  value: LandmarkPick | null;
  onChange: (pick: LandmarkPick | null) => void;
  error?: string;
  filled?: boolean;
};

export function PlaceField({ landmarks, origin, campusCode, value, onChange, error, filled }: PlaceProps) {
  return (
    <FieldBlock id="place" error={error} filled={filled} hint="Never share the door number.">
      <LandmarkPicker label="Where is it?" landmarks={landmarks} origin={origin} campusCode={campusCode} value={value} onChange={onChange} />
    </FieldBlock>
  );
}

/* Roommate block ----------------------------------------------- */

type RoommateProps = {
  groupSize: number;
  homeState: string;
  languages: string[];
  onGroupSizeChange: (value: number) => void;
  onHomeStateChange: (value: string) => void;
  onLanguagesChange: (value: string[]) => void;
  error?: string;
};

export function RoommateFields({ groupSize, homeState, languages, onGroupSizeChange, onHomeStateChange, onLanguagesChange, error }: RoommateProps) {
  return (
    <FieldBlock id="roommate" error={error} className="space-y-2.5">
      <div>
        <p className="mb-1 text-[11.5px] font-bold text-ink">How many of you?</p>
        <Stepper
          label="People looking"
          value={groupSize}
          min={1}
          max={MAX_GROUP}
          onChange={onGroupSizeChange}
          display={groupSize === 1 ? 'Just me' : `We are ${groupSize} looking`}
        />
      </div>
      <label className="block text-[11.5px] font-bold text-ink">
        <span className="flex items-center gap-1.5">
          Home state <span className="text-[10.5px] font-semibold text-slate">Optional</span>
        </span>
        <input
          type="text"
          value={homeState}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => onHomeStateChange(event.target.value)}
          placeholder="e.g. Kerala"
          className="campus-input mt-1"
        />
      </label>
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-ink">
          Languages <span className="text-[10.5px] font-semibold text-slate">Up to {MAX_LANGUAGES}</span>
        </p>
        <div role="group" aria-label="Languages" className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((language) => {
            const selected = languages.includes(language);
            const full = !selected && languages.length >= MAX_LANGUAGES;
            return (
              <button
                key={language}
                type="button"
                aria-pressed={selected}
                disabled={full}
                onClick={() => onLanguagesChange(selected ? languages.filter((entry) => entry !== language) : [...languages, language])}
                className={cn(chipClass(selected), full && 'opacity-45')}
              >
                {language}
              </button>
            );
          })}
        </div>
      </div>
    </FieldBlock>
  );
}

/* Text inputs -------------------------------------------------- */

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  hint,
  optional,
  error,
  filled,
  multiline = false,
  type = 'text',
  inputMode,
}: {
  id: FieldKey;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  optional?: boolean;
  error?: string;
  filled?: boolean;
  multiline?: boolean;
  type?: 'text' | 'tel';
  inputMode?: 'text' | 'tel' | 'numeric';
}) {
  const inputId = `${fieldId(id)}-input`;
  return (
    <FieldBlock id={id} error={error} filled={filled} hint={hint}>
      <label htmlFor={inputId} className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-ink">
        {label}
        {optional ? <span className="text-[10.5px] font-semibold text-slate">Optional</span> : null}
        {filled ? <span className="ml-auto rounded-full bg-royal px-1.5 py-0.5 text-[9.5px] font-bold text-white">From paste</span> : null}
      </label>
      {multiline ? (
        <textarea
          id={inputId}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className="campus-input min-h-24 resize-none py-2.5"
        />
      ) : (
        <input
          id={inputId}
          type={type}
          inputMode={inputMode}
          value={value}
          maxLength={maxLength}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className="campus-input"
        />
      )}
    </FieldBlock>
  );
}
