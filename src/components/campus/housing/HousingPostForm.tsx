'use client';

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CampusGate } from '@/components/campus/CampusGate';
import { PhotoField } from '@/components/campus/fields/PhotoField';
import type { LandmarkPick } from '@/components/campus/places/LandmarkPicker';
import { CloseIcon, LockIcon, NotesIcon } from '@/components/swoop/icons';
import { IconButton, PageHeader, swButton } from '@/components/swoop/primitives';
import { useCampusConfig } from '@/hooks/useCampusConfig';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { STAY_TYPE_LABELS } from '@/lib/campus/constants';
import { HOUSING_KIND_LABELS, normalizePhone, type HousingKind } from '@/lib/campus/housing/model';
import { parseWhatsAppPost, type ParseFlag, type ParsedWhatsAppPost } from '@/lib/campus/housing/parseWhatsAppPost';
import { MAX_BEDS, MAX_SHARING, OTHER_PLACE, housingCreateSchema } from '@/lib/campus/housing/schema';
import { haversineMeters, roundForPrivacy } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience } from '@/types/campus';
import type { Landmark } from '@/types/college';
import {
  BedsFields,
  FormSection,
  HouseRulesField,
  KindField,
  MoveInField,
  PlaceField,
  PostingAsField,
  RentFields,
  RoomExtrasFields,
  RoommateFields,
  StayTypeField,
  TextField,
  WhoCanStayField,
  fieldId,
  moveInModeFor,
  moveInValue,
  postedAsFor,
  roleFor,
  type FieldErrors,
  type FieldKey,
  type HousingFormState,
} from './FormFields';

export type HousingPostFormProps = {
  audience: CampusAudience;
  initialKind: HousingKind;
  /** Prefill for the place, e.g. 'Kothanur'. */
  initialArea: string | null;
  initialTitle: string | null;
};

const MAX_PHOTOS = 8;
const MAX_DESCRIPTION = 1000;
const MAX_TITLE = 80;
const PHONE = /^(?:\+?91|0)?[6-9]\d{9}$/;

/** Order of fields on the page, for scrolling to the first error. */
const FIELD_ORDER: readonly FieldKey[] = [
  'kind',
  'postedAs',
  'brokerage',
  'stayType',
  'title',
  'description',
  'rentPp',
  'deposit',
  'rentTerms',
  'moveIn',
  'bedsLeft',
  'sharing',
  'whoCanStay',
  'houseRules',
  'place',
  'roommate',
  'furnishing',
  'amenities',
  'images',
  'whatsappNumber',
];

const FLAG_NOTES: Record<ParseFlag, string> = {
  phone_removed: 'Phone moved to the WhatsApp field.',
  door_number: 'Remove the door number. Share it in chat.',
  brokerage_unclear: 'Say if the agent charges brokerage.',
};

function initialState(props: HousingPostFormProps): HousingFormState {
  return {
    kind: props.initialKind,
    role: 'student',
    brokerageCharged: null,
    brokerageAmount: null,
    stayType: null,
    title: props.initialTitle ?? '',
    description: '',
    rentPp: null,
    deposit: null,
    rentTerms: 'fixed',
    moveInMode: null,
    moveInDate: '',
    bedsLeft: 1,
    sharing: null,
    whoCanStay: props.audience === 'girls' ? 'girls' : null,
    houseRules: [],
    furnishing: null,
    amenities: [],
    images: [],
    place: null,
    groupSize: 1,
    homeState: '',
    languages: [],
    whatsappNumber: '',
  };
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function pickFor(landmark: Landmark, origin: { lat: number; lng: number }): LandmarkPick {
  return {
    landmarkId: landmark.id,
    label: landmark.label,
    area: landmark.area,
    roughDistanceM: roundForPrivacy(haversineMeters(origin, landmark)),
  };
}

/** ?area=Kothanur: a landmark named that, else an 'Other' place with the area typed in. */
function placeFromArea(area: string, landmarks: readonly Landmark[], origin: { lat: number; lng: number }): LandmarkPick {
  const wanted = normalizeName(area);
  const named = landmarks.find((item) => normalizeName(item.label) === wanted || item.aliases.some((alias) => normalizeName(alias) === wanted));
  if (named) return pickFor(named, origin);
  return { landmarkId: null, label: area, area, roughDistanceM: null };
}

/** A title from what the paste found, e.g. 'Room in PG near Livesta hostel'. */
function suggestedTitle(parsed: ParsedWhatsAppPost, place: LandmarkPick | null): string {
  const { draft } = parsed;
  if (!draft.kind && !draft.stayType && !place) return '';
  const parts = [HOUSING_KIND_LABELS[draft.kind ?? 'room']];
  if (draft.stayType) parts.push(`in ${STAY_TYPE_LABELS[draft.stayType]}`);
  if (place?.label) parts.push(`near ${place.label}`);
  return parts.join(' ').slice(0, MAX_TITLE);
}

/** The JSON body for POST. Missing required values stay undefined so the schema names them. */
function buildPayload(state: HousingFormState, audience: CampusAudience) {
  const place = state.place
    ? state.place.landmarkId === null
      ? { landmarkId: OTHER_PLACE, area: state.place.area, roughDistanceM: state.place.roughDistanceM }
      : { landmarkId: state.place.landmarkId }
    : undefined;
  const digits = state.whatsappNumber.replace(/[\s\-().]/g, '');
  return {
    kind: state.kind,
    postedAs: postedAsFor(state.role, state.kind),
    brokerage:
      state.role === 'agent'
        ? state.brokerageCharged === null
          ? undefined
          : { charged: state.brokerageCharged, amount: state.brokerageCharged ? state.brokerageAmount : null }
        : null,
    stayType: state.stayType ?? undefined,
    title: state.title.trim(),
    description: state.description.trim(),
    whoCanStay: audience === 'girls' ? 'girls' : state.whoCanStay ?? undefined,
    houseRules: state.houseRules,
    moveIn: moveInValue(state) ?? undefined,
    bedsLeft: state.bedsLeft,
    sharing: state.sharing,
    rentPp: state.rentPp ?? undefined,
    deposit: state.deposit,
    rentTerms: state.rentTerms,
    furnishing: state.furnishing,
    amenities: state.amenities,
    images: state.images,
    place,
    roommate:
      state.kind === 'roommate'
        ? {
            groupSize: state.groupSize,
            languages: state.languages,
            homeState: state.homeState.trim() || null,
          }
        : null,
    whatsappNumber: digits,
  };
}

/** Checks the form like the server does. Empty object means ready to post. */
function validate(state: HousingFormState, audience: CampusAudience, landmarkIds: readonly string[] | undefined): FieldErrors {
  const errors: FieldErrors = {};
  const payload = buildPayload(state, audience);

  if (state.role === 'agent') {
    if (state.brokerageCharged === null) errors.brokerage = 'Say if the agent charges brokerage';
    else if (state.brokerageCharged && !(state.brokerageAmount && state.brokerageAmount > 0)) errors.brokerage = 'Add the brokerage amount';
  }
  if (!payload.moveIn) errors.moveIn = state.moveInMode === 'date' ? 'Pick the move-in date' : 'Pick a move-in date';
  if (!payload.whoCanStay) errors.whoCanStay = 'Pick who can stay';
  if (state.houseRules.length === 0) errors.houseRules = 'Pick at least one house rule';
  if (state.rentPp === null) errors.rentPp = 'Add the rent per person';
  if (!payload.whatsappNumber) errors.whatsappNumber = 'Add your WhatsApp number';
  else if (!PHONE.test(payload.whatsappNumber)) errors.whatsappNumber = 'Enter a 10 digit mobile number';

  const result = housingCreateSchema({ audience, landmarkIds }).safeParse(payload);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key !== 'string') continue;
      const field = (key === 'whatsappNumber' ? key : FIELD_ORDER.find((entry) => entry === key)) as FieldKey | undefined;
      if (field && !errors[field]) errors[field] = issue.message;
    }
  }
  return errors;
}

function firstErrorField(errors: FieldErrors): FieldKey | undefined {
  return FIELD_ORDER.find((key) => errors[key]);
}

/** Housing post form v2: paste a WhatsApp post, landmark picker, schema check before POST. */
export function HousingPostForm(props: HousingPostFormProps) {
  const { audience, initialArea } = props;
  const girls = audience === 'girls';
  const router = useRouter();
  const campus = useCurrentCampus();
  const { config, loading: configLoading, error: configError, refresh } = useCampusConfig();

  const [state, setState] = useState<HousingFormState>(() => initialState(props));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [filled, setFilled] = useState<ReadonlySet<FieldKey>>(() => new Set());
  const [notes, setNotes] = useState<string[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  // The landmark picker keeps its own 'Other' inputs; a new key remounts it when the place is set from outside.
  const [placeKey, setPlaceKey] = useState(0);
  const [areaApplied, setAreaApplied] = useState(!initialArea);

  const landmarks = config?.campus.landmarks;
  const origin = config?.campus.origin;
  const landmarkIds = useMemo(() => landmarks?.map((item) => item.id), [landmarks]);

  // ?area= prefill once the campus landmarks are in.
  if (!areaApplied && landmarks && origin && initialArea) {
    setAreaApplied(true);
    setState((current) => (current.place ? current : { ...current, place: placeFromArea(initialArea, landmarks, origin) }));
  }

  const campusLabel = campus?.label ?? config?.campus.label ?? '';
  const campusCode = campus?.code ?? config?.college.code ?? 'campus';
  const kicker = [girls ? 'Girls’ space' : 'Housing', campusLabel].filter(Boolean).join(' · ');
  const feedHref = girls ? '/girls-space/housing' : '/housing';

  const patch = (changes: Partial<HousingFormState>, keys: FieldKey[] = []) => {
    setState((current) => ({ ...current, ...changes }));
    if (keys.length === 0) return;
    setErrors((current) => {
      if (!keys.some((key) => current[key])) return current;
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
    setFilled((current) => {
      if (!keys.some((key) => current.has(key))) return current;
      const next = new Set(current);
      for (const key of keys) next.delete(key);
      return next;
    });
  };

  const applyPaste = (text: string) => {
    const parsed = parseWhatsAppPost(text, landmarks ?? []);
    const { draft } = parsed;
    const changes: Partial<HousingFormState> = {};
    const keys = new Set<FieldKey>(parsed.filled);

    if (draft.kind) changes.kind = draft.kind;
    if (draft.postedAs) changes.role = roleFor(draft.postedAs);
    if (draft.brokerage) {
      changes.brokerageCharged = draft.brokerage.charged;
      changes.brokerageAmount = draft.brokerage.amount;
    }
    if (draft.stayType) changes.stayType = draft.stayType;
    if (draft.whoCanStay) {
      if (girls) keys.delete('whoCanStay');
      else changes.whoCanStay = draft.whoCanStay;
    }
    if (draft.houseRules) changes.houseRules = draft.houseRules;
    if (draft.moveIn) Object.assign(changes, moveInModeFor(draft.moveIn));
    if (draft.bedsLeft !== undefined) changes.bedsLeft = Math.min(MAX_BEDS, Math.max(1, draft.bedsLeft));
    if (draft.sharing !== undefined) changes.sharing = Math.min(MAX_SHARING, Math.max(1, draft.sharing));
    if (draft.rentPp !== undefined) changes.rentPp = draft.rentPp;
    if (draft.deposit !== undefined) changes.deposit = draft.deposit;
    if (draft.rentTerms) changes.rentTerms = draft.rentTerms;
    if (draft.furnishing) changes.furnishing = draft.furnishing;

    let place: LandmarkPick | null = null;
    if (draft.place) {
      const landmark = draft.place.landmarkId === OTHER_PLACE ? null : landmarks?.find((item) => item.id === draft.place?.landmarkId);
      place = landmark && origin ? pickFor(landmark, origin) : { landmarkId: null, label: draft.place.area, area: draft.place.area, roughDistanceM: null };
      changes.place = place;
    }

    // The phone goes to the WhatsApp field, never into the description.
    if (parsed.phone) {
      changes.whatsappNumber = normalizePhone(parsed.phone);
      keys.add('whatsappNumber');
    }
    const description = parsed.cleanedDescription.trim().slice(0, MAX_DESCRIPTION);
    if (description) {
      changes.description = description;
      keys.add('description');
    }
    if (!state.title.trim()) {
      const title = suggestedTitle(parsed, place);
      if (title.length >= 4) {
        changes.title = title;
        keys.add('title');
      }
    }

    setState((current) => ({ ...current, ...changes }));
    if (changes.place) setPlaceKey((current) => current + 1);
    setErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
    setFilled(keys);
    const count = keys.size;
    setNotes([
      count > 0 ? `Filled ${count} ${count === 1 ? 'field' : 'fields'}. Check them below.` : 'Could not read much. Fill it in below.',
      ...parsed.flags.map((flag) => FLAG_NOTES[flag]),
    ]);
    setPasteOpen(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    const found = validate(state, audience, landmarkIds);
    const first = firstErrorField(found);
    if (first) {
      setErrors(found);
      setFormError('Fix the marked fields first.');
      document.getElementById(fieldId(first))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const endpoint = girls ? '/api/girls-space/housing' : '/api/housing/posts';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(state, audience)),
      });
      const result = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not post. Try again.');
      router.replace(feedHref);
      router.refresh();
    } catch (cause) {
      setFormError((cause as Error).message || 'Could not post. Try again.');
      setSubmitting(false);
    }
  };

  const roommate = state.kind === 'roommate';

  return (
    <CampusGate girlsOnly={girls}>
      <div className="mx-auto max-w-lg pb-3">
        <PageHeader backHref={feedHref} kicker={kicker} title={roommate ? 'Find a roommate' : 'Post a room'} />

        <form onSubmit={submit} noValidate className="px-3">
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="campus-press mt-2 flex w-full min-w-0 items-center gap-2.5 rounded-[12px] bg-royal-tint px-3 py-2.5 text-left text-ink"
          >
            <NotesIcon size={18} className="shrink-0 text-royal" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold">Paste a WhatsApp post</span>
              <span className="block text-[11px] font-semibold text-slate">We fill the form for you.</span>
            </span>
          </button>

          {notes.length > 0 ? (
            <ul role="status" className="mt-2 space-y-0.5 rounded-[12px] bg-surface px-3 py-2">
              {notes.map((note) => (
                <li key={note} className="text-[11.5px] font-semibold text-ink">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}

          <FormSection title="The basics">
            <KindField value={state.kind} filled={filled.has('kind')} onChange={(kind) => patch({ kind }, ['kind', 'roommate'])} />
            <PostingAsField
              role={state.role}
              onRoleChange={(role) => patch({ role }, ['postedAs', 'brokerage'])}
              brokerageCharged={state.brokerageCharged}
              brokerageAmount={state.brokerageAmount}
              onBrokerageChange={(brokerageCharged, brokerageAmount) => patch({ brokerageCharged, brokerageAmount }, ['brokerage'])}
              errors={errors}
              filled={filled}
            />
            <StayTypeField value={state.stayType} error={errors.stayType} filled={filled.has('stayType')} onChange={(stayType) => patch({ stayType }, ['stayType'])} />
            <TextField
              id="title"
              label="Title"
              value={state.title}
              maxLength={MAX_TITLE}
              placeholder={roommate ? (campusLabel ? `Looking for a roommate near ${campusLabel}` : 'Looking for a roommate') : 'Room in PG near Livesta'}
              error={errors.title}
              filled={filled.has('title')}
              onChange={(title) => patch({ title }, ['title'])}
            />
          </FormSection>

          <FormSection title="Rent">
            <RentFields
              rentPp={state.rentPp}
              deposit={state.deposit}
              rentTerms={state.rentTerms}
              onRentChange={(rentPp) => patch({ rentPp }, ['rentPp'])}
              onDepositChange={(deposit) => patch({ deposit }, ['deposit'])}
              onTermsChange={(rentTerms) => patch({ rentTerms }, ['rentTerms'])}
              errors={errors}
              filled={filled}
            />
          </FormSection>

          <FormSection title="Who and when">
            <MoveInField
              mode={state.moveInMode}
              date={state.moveInDate}
              error={errors.moveIn}
              filled={filled.has('moveIn')}
              onChange={(moveInMode, moveInDate) => patch({ moveInMode, moveInDate }, ['moveIn'])}
            />
            <BedsFields
              bedsLeft={state.bedsLeft}
              sharing={state.sharing}
              onBedsChange={(bedsLeft) => patch({ bedsLeft }, ['bedsLeft'])}
              onSharingChange={(sharing) => patch({ sharing }, ['sharing'])}
              errors={errors}
              filled={filled}
            />
            <WhoCanStayField
              value={state.whoCanStay}
              locked={girls}
              error={errors.whoCanStay}
              filled={filled.has('whoCanStay')}
              onChange={(whoCanStay) => patch({ whoCanStay }, ['whoCanStay'])}
            />
            <HouseRulesField value={state.houseRules} error={errors.houseRules} filled={filled.has('houseRules')} onChange={(houseRules) => patch({ houseRules }, ['houseRules'])} />
            {roommate ? (
              <RoommateFields
                groupSize={state.groupSize}
                homeState={state.homeState}
                languages={state.languages}
                error={errors.roommate}
                onGroupSizeChange={(groupSize) => patch({ groupSize }, ['roommate'])}
                onHomeStateChange={(homeState) => patch({ homeState }, ['roommate'])}
                onLanguagesChange={(languages) => patch({ languages }, ['roommate'])}
              />
            ) : null}
          </FormSection>

          <FormSection title="Where">
            {landmarks && origin ? (
              <PlaceField
                key={placeKey}
                landmarks={landmarks}
                origin={origin}
                campusCode={campusCode}
                value={state.place}
                error={errors.place}
                filled={filled.has('place')}
                onChange={(place) => patch({ place }, ['place'])}
              />
            ) : configLoading ? (
              <div className="h-24 animate-pulse rounded-[12px] bg-surface" aria-busy="true" aria-label="Loading places" />
            ) : (
              <div id={fieldId('place')} className="flex items-center justify-between gap-2 rounded-[12px] bg-market-tint px-3 py-2.5">
                <p className="text-[12px] font-semibold text-market">{configError || 'Could not load your campus'}</p>
                <button type="button" onClick={() => void refresh()} className={swButton({ variant: 'white', size: 'sm' })}>
                  Try again
                </button>
              </div>
            )}
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate">
              <LockIcon size={14} className="shrink-0 text-ink" aria-hidden="true" />
              Only the landmark and distance show.
            </p>
          </FormSection>

          {!roommate ? (
            <FormSection title="The room">
              <RoomExtrasFields
                furnishing={state.furnishing}
                amenities={state.amenities}
                onFurnishingChange={(furnishing) => patch({ furnishing }, ['furnishing'])}
                onAmenitiesChange={(amenities) => patch({ amenities }, ['amenities'])}
                filled={filled}
              />
            </FormSection>
          ) : null}

          <FormSection title="Photos and details">
            <div id={fieldId('images')}>
              <PhotoField
                audience={audience}
                max={MAX_PHOTOS}
                label="Photos"
                hint="Your own photos only."
                value={state.images}
                onChange={(images) => patch({ images }, ['images'])}
              />
              {errors.images ? <p className="mt-1 text-[11.5px] font-bold text-market">{errors.images}</p> : null}
            </div>
            <TextField
              id="description"
              label="Description"
              optional
              multiline
              value={state.description}
              maxLength={MAX_DESCRIPTION}
              placeholder="What makes it a good fit?"
              hint="No phone numbers here."
              error={errors.description}
              filled={filled.has('description')}
              onChange={(description) => patch({ description }, ['description'])}
            />
            <TextField
              id="whatsappNumber"
              label="WhatsApp number"
              type="tel"
              inputMode="tel"
              value={state.whatsappNumber}
              maxLength={16}
              placeholder="98450 12345"
              hint="Shared only when you accept a request."
              error={errors.whatsappNumber}
              filled={filled.has('whatsappNumber')}
              onChange={(whatsappNumber) => patch({ whatsappNumber }, ['whatsappNumber'])}
            />
          </FormSection>

          <div className="space-y-2 pt-3.5">
            {formError ? (
              <div role="alert" className="rounded-[12px] bg-market-tint px-3 py-2.5 text-[12px] font-semibold text-market">
                {formError}
              </div>
            ) : null}
            <button type="submit" disabled={submitting} className={cn(swButton({ size: 'lg' }), 'w-full')}>
              {submitting ? 'Posting…' : 'Post it'}
            </button>
            <p className="text-center text-[11px] font-semibold text-slate">Only verified students</p>
          </div>
        </form>
      </div>

      {pasteOpen ? <PasteSheet onClose={() => setPasteOpen(false)} onFill={applyPaste} /> : null}
    </CampusGate>
  );
}

/** 'Paste a WhatsApp post' sheet. */
function PasteSheet({ onClose, onFill }: { onClose: () => void; onFill: (text: string) => void }) {
  const titleId = useId();
  const [text, setText] = useState('');

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto w-full max-w-md rounded-[14px] bg-white p-4 shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold text-slate">Hey, save some typing</p>
            <h2 id={titleId} className="font-heading text-[16px] leading-[1.1] text-ink">
              Paste a WhatsApp post
            </h2>
          </div>
          <IconButton label="Close" icon={CloseIcon} onClick={onClose} />
        </div>
        <label className="mt-3 block text-[11.5px] font-bold text-ink">
          The post
          <textarea
            autoFocus
            value={text}
            maxLength={4000}
            onChange={(event) => setText(event.target.value)}
            className="campus-input mt-1.5 min-h-40 resize-none py-2.5"
            placeholder="Paste the full message here."
          />
        </label>
        <p className="mt-1 text-[11px] font-semibold text-slate">We fill what we can. Check before posting.</p>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onFill(text)}
          className={cn(swButton({ size: 'lg' }), 'mt-3 w-full')}
        >
          Fill the form
        </button>
      </section>
    </div>
  );
}
