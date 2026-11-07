'use client';

// New listing form v2: the kind registry (kind -> its own fields) and the form
// shell the /marketplace/new page renders. Kinds without an entry in
// KIND_FIELDS stay hidden from the picker.

import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CampusGate } from '@/components/campus/CampusGate';
import { GenderChips } from '@/components/campus/fields/GenderChips';
import { PhotoField } from '@/components/campus/fields/PhotoField';
import { PriceInput } from '@/components/campus/fields/PriceInput';
import { PriceTermsChips } from '@/components/campus/fields/PriceTermsChips';
import { LandmarkPicker, type LandmarkPick } from '@/components/campus/places/LandmarkPicker';
import {
  BedIcon,
  BoxIcon,
  CabIcon,
  HandIcon,
  PassIcon,
  ScooterIcon,
  SeatIcon,
  TicketIcon,
  type IconProps,
} from '@/components/swoop/icons';
import { Chip, IconTile, PageHeader, SectionHeader, swButton } from '@/components/swoop/primitives';
import { useCampusConfig } from '@/hooks/useCampusConfig';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { MARKET_CATEGORIES, MARKET_CATEGORY_LABELS, MARKET_KIND_POST_LABELS } from '@/lib/campus/market';
import { wantedPlaceholder } from '@/lib/search/campusSearch';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience } from '@/types/campus';
import type { ItemCondition, MarketKind, PriceTerms } from '@/types/market';
import { BundleItemsField } from './BundleItemsField';
import {
  BUNDLE_DESCRIPTION_MAX,
  DESCRIPTION_MAX,
  TITLE_MAX,
  buildMarketPayload,
  initialFormState,
  isFreeTerms,
  maxPhotosFor,
  priceTermsFor,
  switchKind,
  type FormKind,
  type MarketFormState,
} from './payload';

// ---------------------------------------------------------------- registry

export type KindFieldsProps = {
  state: MarketFormState;
  update: (patch: Partial<MarketFormState>) => void;
};

export interface KindEntry {
  titleLabel: string;
  titlePlaceholder: string;
  priceLabel: string;
  priceOptions: readonly PriceTerms[];
  /** Item, bundle and vehicle need a landmark; the rest may skip it. */
  landmarkRequired: boolean;
  landmarkLabel: string;
  descriptionPlaceholder: string;
  submitLabel: string;
  /** The kind's own fields, shown after the price. */
  Fields?: ComponentType<KindFieldsProps>;
}

export interface KindPickerOption {
  kind: MarketKind;
  label: string;
  hint: string;
  icon: ComponentType<IconProps>;
}

/** Step 1, in display order. Only kinds with fields in KIND_FIELDS are shown. */
export const KIND_PICKER: readonly KindPickerOption[] = [
  { kind: 'item', label: 'Sell', hint: 'One thing, one price', icon: BoxIcon },
  { kind: 'wanted', label: 'Wanted', hint: 'Ask campus for something', icon: HandIcon },
  { kind: 'bundle', label: 'Clear out room', hint: 'Many things, one post', icon: BedIcon },
  { kind: 'seat', label: 'Seat', hint: 'Pass on a spare seat', icon: SeatIcon },
  { kind: 'cab_split', label: 'Cab split', hint: 'Share a ride, split fare', icon: CabIcon },
  { kind: 'ticket', label: 'Ticket', hint: 'At or below face value', icon: TicketIcon },
  { kind: 'pass', label: 'Pass', hint: 'Bus, metro or gym pass', icon: PassIcon },
  { kind: 'vehicle', label: 'Vehicle', hint: 'Sell or rent a ride', icon: ScooterIcon },
];

const CONDITIONS: ReadonlyArray<{ value: ItemCondition; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'used', label: 'Used' },
  { value: 'needs_repair', label: 'Needs repair' },
];

const FIELD_INPUT = 'campus-input text-[13px] font-semibold text-ink';

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11.5px] font-bold text-ink">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint ? <span className="mt-0.5 block text-[11px] text-slate">{hint}</span> : null}
    </label>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="min-w-0">
      <span className="block text-[11.5px] font-bold text-ink" aria-hidden="true">
        {label}
      </span>
      <div className="mt-1 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ItemFields({ state, update }: KindFieldsProps) {
  return (
    <>
      <ChipGroup label="Condition">
        {CONDITIONS.map((option) => (
          <Chip
            key={option.value}
            selected={state.condition === option.value}
            onClick={() => update({ condition: state.condition === option.value ? null : option.value })}
          >
            {option.label}
          </Chip>
        ))}
      </ChipGroup>
      <FieldLabel label="Brand, optional">
        <input
          type="text"
          value={state.brand}
          maxLength={60}
          onChange={(event) => update({ brand: event.target.value })}
          placeholder="Usha, Casio, Hero…"
          autoComplete="off"
          className={FIELD_INPUT}
        />
      </FieldLabel>
    </>
  );
}

function WantedFields({ state, update }: KindFieldsProps) {
  return (
    <FieldLabel label="Need it by, optional">
      <input
        type="date"
        value={state.neededBy}
        onChange={(event) => update({ neededBy: event.target.value })}
        className={FIELD_INPUT}
      />
    </FieldLabel>
  );
}

function BundleFields({ state, update }: KindFieldsProps) {
  return (
    <>
      <BundleItemsField
        rows={state.parts}
        onRowsChange={(parts) => update({ parts })}
        availableUntil={state.availableUntil}
        onAvailableUntilChange={(availableUntil) => update({ availableUntil })}
        handOver={state.handOver}
        onHandOverChange={(handOver) => update({ handOver })}
        free={isFreeTerms(state.priceTerms)}
      />
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-[12px] bg-surface px-3 text-[12.5px] font-bold text-ink">
        <span>
          Sell things one by one
          <span className="block text-[11px] font-medium text-slate">Off means all together only</span>
        </span>
        <input
          type="checkbox"
          checked={state.splitOk}
          onChange={(event) => update({ splitOk: event.target.checked })}
          className="h-4 w-4 shrink-0 accent-royal"
        />
      </label>
    </>
  );
}

/** Kind -> its fields and copy. MFORM2 adds seat, cab split, ticket, pass and vehicle. */
export const KIND_FIELDS: Partial<Record<MarketKind, KindEntry>> = {
  item: {
    titleLabel: 'What are you selling?',
    titlePlaceholder: 'Usha table fan',
    priceLabel: 'Price',
    priceOptions: priceTermsFor('item'),
    landmarkRequired: true,
    landmarkLabel: 'Where to pick it up?',
    descriptionPlaceholder: 'Age, size, what is included',
    submitLabel: 'Post it',
    Fields: ItemFields,
  },
  wanted: {
    titleLabel: 'What do you need?',
    titlePlaceholder: wantedPlaceholder(0),
    priceLabel: 'Budget, optional',
    priceOptions: priceTermsFor('wanted'),
    landmarkRequired: false,
    landmarkLabel: 'Near which place? Optional',
    descriptionPlaceholder: 'Model, size or anything that helps',
    submitLabel: 'Ask campus',
    Fields: WantedFields,
  },
  bundle: {
    titleLabel: 'Name your clear-out',
    titlePlaceholder: 'Room starter kit, all together',
    priceLabel: 'Price for all, optional',
    priceOptions: priceTermsFor('bundle'),
    landmarkRequired: true,
    landmarkLabel: 'Where to pick it up?',
    descriptionPlaceholder: 'Why you are clearing out, any deal',
    submitLabel: 'Post the clear-out',
    Fields: BundleFields,
  },
};

function isFormKind(kind: MarketKind): kind is FormKind {
  return Boolean(KIND_FIELDS[kind]);
}

// ---------------------------------------------------------------- shell

type FormProps = {
  /** From ?kind. Null opens the kind picker. */
  initialKind: FormKind | null;
  audience: CampusAudience;
  /** From ?q on a wanted post: 'Any cycle available?'. */
  initialTitle: string;
};

function endpointFor(audience: CampusAudience): string {
  return audience === 'girls' ? '/api/girls-space/marketplace' : '/api/marketplace/listings';
}

function feedFor(audience: CampusAudience): string {
  return audience === 'girls' ? '/girls-space/marketplace' : '/marketplace';
}

export function NewListingForm({ initialKind, audience, initialTitle }: FormProps) {
  const router = useRouter();
  const campus = useCurrentCampus();
  const { config, loading: configLoading, error: configError } = useCampusConfig();
  const [step, setStep] = useState<'kind' | 'details'>(initialKind ? 'details' : 'kind');
  const [form, setForm] = useState<MarketFormState>(() => initialFormState(initialKind ?? 'item', audience, initialTitle));
  const [place, setPlace] = useState<LandmarkPick | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [reviving, setReviving] = useState(false);

  const girls = audience === 'girls';
  const entry = KIND_FIELDS[form.kind] as KindEntry;
  const Fields = entry.Fields;
  const free = isFreeTerms(form.priceTerms);
  const campusLabel = campus?.label ?? config?.campus.label ?? null;
  const kicker = girls ? (campusLabel ? `Girls’ space · ${campusLabel}` : 'Girls’ space') : campusLabel ?? undefined;
  const pickerOptions = KIND_PICKER.filter((option) => isFormKind(option.kind));

  const update = (patch: Partial<MarketFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError('');
  };

  const pickKind = (kind: MarketKind) => {
    if (!isFormKind(kind)) return;
    setForm((current) => switchKind(current, kind));
    setDuplicateId(null);
    setError('');
    setStep('details');
  };

  const pickPlace = (pick: LandmarkPick | null) => {
    setPlace(pick);
    update({ landmarkId: pick?.landmarkId ?? null });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const built = buildMarketPayload(form);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setSubmitting(true);
    setError('');
    setDuplicateId(null);
    try {
      const response = await fetch(endpointFor(audience), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.payload),
      });
      const data = (await response.json().catch(() => ({}))) as { id?: string; existingId?: string; error?: string };
      if (response.status === 409 && typeof data.existingId === 'string') {
        setDuplicateId(data.existingId);
        setSubmitting(false);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Could not post it. Try again.');
      router.replace(feedFor(audience));
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message || 'Could not post it. Try again.');
      setSubmitting(false);
    }
  };

  const bringBack = async () => {
    if (!duplicateId || reviving) return;
    setReviving(true);
    setError('');
    try {
      const response = await fetch(`${endpointFor(audience)}/${encodeURIComponent(duplicateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'still_available' }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not bring it back');
      router.replace(feedFor(audience));
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message || 'Could not bring it back');
      setReviving(false);
    }
  };

  return (
    <CampusGate girlsOnly={girls}>
      <div className="min-h-screen bg-white pb-3">
        {step === 'kind' ? (
          <PageHeader title="New post" kicker={kicker} backHref={feedFor(audience)} />
        ) : (
          <PageHeader title={MARKET_KIND_POST_LABELS[form.kind]} kicker={kicker} onBack={() => setStep('kind')} />
        )}

        {step === 'kind' ? (
          <section className="mx-auto max-w-xl px-3 pt-2">
            <SectionHeader title="Hey, what are you posting?" />
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {pickerOptions.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => pickKind(option.kind)}
                  aria-pressed={form.kind === option.kind}
                  className="campus-press flex min-h-[64px] min-w-0 items-center gap-2 rounded-[12px] bg-surface p-2.5 text-left"
                >
                  <IconTile icon={option.icon} tone={girls ? 'girls' : 'royal'} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-bold text-ink">{option.label}</span>
                    <span className="block text-[11px] leading-[1.3] text-slate">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <form onSubmit={submit} noValidate className="mx-auto max-w-xl space-y-3 px-3 pt-2">
            <FieldLabel label={entry.titleLabel}>
              <input
                type="text"
                value={form.title}
                maxLength={TITLE_MAX}
                onChange={(event) => update({ title: event.target.value })}
                placeholder={entry.titlePlaceholder}
                autoComplete="off"
                enterKeyHint="next"
                className={FIELD_INPUT}
              />
            </FieldLabel>

            <ChipGroup label="Category">
              {MARKET_CATEGORIES.map((category) => (
                <Chip key={category} selected={form.category === category} onClick={() => update({ category })}>
                  {MARKET_CATEGORY_LABELS[category]}
                </Chip>
              ))}
            </ChipGroup>

            <div className="space-y-2">
              <PriceInput
                label={entry.priceLabel}
                value={free ? null : form.price}
                onChange={(price) => update({ price })}
                disabled={free}
              />
              <PriceTermsChips
                label="Price terms"
                options={entry.priceOptions}
                value={form.priceTerms}
                onChange={(priceTerms) => update({ priceTerms, ...(isFreeTerms(priceTerms) ? { price: null } : {}) })}
                onPriceChange={(price) => update({ price })}
              />
            </div>

            {Fields ? <Fields state={form} update={update} /> : null}

            {config && config.campus.landmarks.length > 0 ? (
              <LandmarkPicker
                landmarks={config.campus.landmarks}
                origin={config.campus.origin}
                campusCode={config.college.code}
                value={place}
                onChange={pickPlace}
                label={entry.landmarkLabel}
              />
            ) : (
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold text-ink">{entry.landmarkLabel}</p>
                {configLoading ? (
                  <div className="mt-1 h-10 animate-pulse rounded-full bg-surface" aria-hidden="true" />
                ) : (
                  <p className="mt-1 rounded-[12px] bg-surface px-3 py-2.5 text-[11.5px] font-semibold text-slate">
                    {configError || 'No places for your campus yet.'}
                  </p>
                )}
              </div>
            )}

            <PhotoField
              value={form.images}
              onChange={(images) => update({ images })}
              max={maxPhotosFor(form.kind)}
              audience={audience}
            />

            <FieldLabel label="Description, optional">
              <textarea
                value={form.description}
                maxLength={form.kind === 'bundle' ? BUNDLE_DESCRIPTION_MAX : DESCRIPTION_MAX}
                onChange={(event) => update({ description: event.target.value })}
                placeholder={entry.descriptionPlaceholder}
                className={cn(FIELD_INPUT, 'min-h-24 resize-none py-2.5')}
              />
            </FieldLabel>

            <div className="min-w-0">
              <p className="text-[11.5px] font-bold text-ink">Who can reply</p>
              <GenderChips
                className="mt-1"
                value={girls ? 'girls' : form.genderPref}
                onChange={(genderPref) => update({ genderPref })}
                locked={girls}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              {form.useSavedNumber ? null : (
                <FieldLabel label="WhatsApp number" hint="Shared only after you say yes.">
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.whatsappNumber}
                    maxLength={16}
                    onChange={(event) => update({ whatsappNumber: event.target.value })}
                    placeholder="98765 43210"
                    className={FIELD_INPUT}
                  />
                </FieldLabel>
              )}
              <label className="flex min-h-10 items-center gap-2 text-[12.5px] font-bold text-ink">
                <input
                  type="checkbox"
                  checked={form.useSavedNumber}
                  onChange={(event) => update({ useSavedNumber: event.target.checked, whatsappNumber: '' })}
                  className="h-4 w-4 shrink-0 accent-royal"
                />
                Use my saved number
              </label>
            </div>

            <p className="text-[11px] leading-[1.45] text-slate">
              {girls ? 'Girls’ space posts are never promoted.' : 'May show in Swoop promos. You can opt out.'}
            </p>

            {duplicateId ? (
              <div role="alert" className="rounded-[12px] bg-royal-tint p-2.5">
                <p className="text-[12.5px] font-bold text-ink">You already posted this. Bring it back?</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void bringBack()}
                    disabled={reviving}
                    className={swButton({ variant: 'primary', size: 'sm' })}
                  >
                    {reviving ? 'Bringing it back…' : 'Bring it back'}
                  </button>
                  <Link href={`${feedFor(audience)}/${encodeURIComponent(duplicateId)}`} className={swButton({ variant: 'white', size: 'sm' })}>
                    See the post
                  </Link>
                </div>
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="rounded-[12px] bg-market-tint px-3 py-2.5 text-[11.5px] font-bold text-market">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className={cn(swButton({ variant: 'primary', size: 'lg' }), 'w-full')}
            >
              {submitting ? 'Posting…' : entry.submitLabel}
            </button>
          </form>
        )}
      </div>
    </CampusGate>
  );
}
