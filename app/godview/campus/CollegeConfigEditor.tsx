'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Segmented, swButton } from '@/components/swoop/primitives';
import { AlertIcon, LandmarkIcon, PinIcon, PlusIcon, TrashIcon } from '@/components/swoop/icons';
import { collegeConfigPutSchema, describeConfigIssue, type CollegeConfigPutInput } from '@/lib/campus/collegeConfigSchema';
import { cn } from '@/lib/utils/cn';
import type { LaunchState } from '@/types/college';
import { SectionTitle, Spinner, gvCard, gvIconBtn, gvInput, gvLabel, gvTextarea } from '../ui';

type LandmarkData = { id: string; label: string; area: string; lat: number; lng: number; aliases: string[] };
type CampusData = {
  id: string;
  name: string;
  label: string;
  origin: { lat: number; lng: number; approx: boolean };
  pickupPoints: Array<{ id: string; label: string }>;
  landmarks: LandmarkData[];
};
type ConfigData = {
  collegeId: string;
  colleges: Array<{ id: string; code: string; shortName: string; name: string }>;
  college: { id: string; code: string; name: string; shortName: string };
  launchState: LaunchState;
  emailDomains: string[];
  marketplaceEnabled: boolean;
  housingEnabled: boolean;
  campuses: CampusData[];
  serialNamespaces: Array<{ product: string; prefix: string; reserved: number; capacity: number }>;
  updatedAt: string | null;
  updatedBy: string | null;
};

type LandmarkDraft = { key: string; id: string; label: string; area: string; lat: string; lng: string; aliases: string };
type CampusDraft = {
  id: string;
  name: string;
  label: string;
  approx: boolean;
  lat: string;
  lng: string;
  pickups: string;
  /** Pickup label to its stored id, so renames of other rows keep ids stable. */
  pickupIds: Record<string, string>;
  landmarks: LandmarkDraft[];
  adding: LandmarkDraft;
};
type Draft = {
  launchState: LaunchState;
  domains: string;
  marketplaceEnabled: boolean;
  housingEnabled: boolean;
  campuses: CampusDraft[];
};

let keySeed = 0;
const nextKey = () => `row-${(keySeed += 1)}`;

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'spot';
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function emptyLandmark(): LandmarkDraft {
  return { key: nextKey(), id: '', label: '', area: '', lat: '', lng: '', aliases: '' };
}

function toDraft(data: ConfigData): Draft {
  return {
    launchState: data.launchState,
    domains: data.emailDomains.join('\n'),
    marketplaceEnabled: data.marketplaceEnabled,
    housingEnabled: data.housingEnabled,
    campuses: data.campuses.map((campus) => ({
      id: campus.id,
      name: campus.name,
      label: campus.label,
      approx: campus.origin.approx,
      lat: String(campus.origin.lat),
      lng: String(campus.origin.lng),
      pickups: campus.pickupPoints.map((point) => point.label).join('\n'),
      pickupIds: Object.fromEntries(campus.pickupPoints.map((point) => [point.label, point.id])),
      landmarks: campus.landmarks.map((landmark) => ({
        key: nextKey(),
        id: landmark.id,
        label: landmark.label,
        area: landmark.area,
        lat: String(landmark.lat),
        lng: String(landmark.lng),
        aliases: landmark.aliases.join(', '),
      })),
      adding: emptyLandmark(),
    })),
  };
}

/** Blank or non-numeric text becomes NaN, which the schema rejects with a clear message. */
function toNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function toPayload(draft: Draft): CollegeConfigPutInput {
  return {
    emailDomains: draft.domains.split(/[\s,;]+/).filter(Boolean),
    launchState: draft.launchState,
    marketplaceEnabled: draft.marketplaceEnabled,
    housingEnabled: draft.housingEnabled,
    campuses: draft.campuses.map((campus) => {
      const labels = [...new Set(campus.pickups.split('\n').map((line) => line.trim()).filter(Boolean))];
      const taken = new Set(labels.map((label) => campus.pickupIds[label]).filter((id): id is string => Boolean(id)));
      return {
        id: campus.id,
        origin: { lat: toNumber(campus.lat), lng: toNumber(campus.lng) },
        pickupPoints: labels.map((label) => ({ id: campus.pickupIds[label] ?? uniqueId(`${campus.id}-${slugify(label)}`, taken), label })),
        landmarks: campus.landmarks.map((landmark) => ({
          id: landmark.id,
          label: landmark.label,
          area: landmark.area,
          lat: toNumber(landmark.lat),
          lng: toNumber(landmark.lng),
          aliases: landmark.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
        })),
      };
    }),
  };
}

const LAUNCH_OPTIONS: { value: LaunchState; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'waitlist', label: 'Waitlist' },
];

export function CollegeConfigEditor({ initialCollegeId = 'kju' }: { initialCollegeId?: string }) {
  const [collegeId, setCollegeId] = useState(initialCollegeId);
  const [data, setData] = useState<ConfigData | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (id: string) => {
    const current = (requestId.current += 1);
    setLoading(true);
    try {
      const response = await fetch(`/api/godview/campus/config?collegeId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (current !== requestId.current) return;
      if (!response.ok) {
        toast.error(body.error || 'Could not load college config');
        return;
      }
      setData(body as ConfigData);
      setDraft(toDraft(body as ConfigData));
      setDirty(false);
    } catch {
      if (current === requestId.current) toast.error('Could not load college config');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(collegeId); }, [collegeId, load]);

  function update(next: (value: Draft) => Draft) {
    setDraft((value) => (value ? next(value) : value));
    setDirty(true);
  }

  function updateCampus(campusId: string, next: (campus: CampusDraft) => CampusDraft) {
    update((value) => ({ ...value, campuses: value.campuses.map((campus) => (campus.id === campusId ? next(campus) : campus)) }));
  }

  function switchCollege(id: string) {
    if (id === collegeId) return;
    if (dirty && !window.confirm('Drop unsaved changes?')) return;
    setCollegeId(id);
  }

  function addLandmark(campus: CampusDraft) {
    const row = campus.adding;
    if (row.label.trim().length < 2) return toast.error('Give the landmark a name');
    if (!Number.isFinite(toNumber(row.lat)) || !Number.isFinite(toNumber(row.lng))) return toast.error('Add the landmark lat and lng');
    const taken = new Set(campus.landmarks.map((landmark) => landmark.id));
    const id = uniqueId(`${campus.id}-${slugify(row.label)}`, taken);
    updateCampus(campus.id, (value) => ({
      ...value,
      landmarks: [...value.landmarks, { ...row, id, label: row.label.trim(), area: row.area.trim() || row.label.trim() }],
      adding: emptyLandmark(),
    }));
  }

  function removeLandmark(campusId: string, key: string) {
    updateCampus(campusId, (value) => ({ ...value, landmarks: value.landmarks.filter((landmark) => landmark.key !== key) }));
  }

  async function save() {
    if (!draft || !data) return;
    const parsed = collegeConfigPutSchema.safeParse(toPayload(draft));
    if (!parsed.success) return toast.error(describeConfigIssue(parsed.error));
    setSaving(true);
    try {
      const response = await fetch(`/api/godview/campus/config?collegeId=${encodeURIComponent(data.collegeId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return toast.error(body.error || 'Could not save');
      setData(body as ConfigData);
      setDraft(toDraft(body as ConfigData));
      setDirty(false);
      toast.success(`${data.college.shortName} config saved`);
    } catch {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn(gvCard, 'p-4')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle>College config</SectionTitle>
        <label className="flex items-center gap-2 text-[12px] font-bold text-text-secondary">
          College
          <select
            value={collegeId}
            onChange={(event) => switchCollege(event.target.value)}
            className={cn(gvInput, 'w-44 cursor-pointer')}
            aria-label="College to edit"
          >
            {(data?.colleges ?? [{ id: collegeId, code: collegeId.toUpperCase(), shortName: collegeId.toUpperCase(), name: collegeId }]).map((college) => (
              <option key={college.id} value={college.id}>{college.shortName}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && !draft ? (
        <div className="grid h-28 place-items-center"><Spinner /></div>
      ) : draft && data ? (
        <div className={cn('mt-3 space-y-4', loading && 'pointer-events-none opacity-60')} aria-busy={loading}>
          <p className="text-[11px] text-slate">
            {data.college.name}
            {data.updatedAt && data.updatedBy ? ` · Saved ${new Date(data.updatedAt).toLocaleDateString()} by ${data.updatedBy}` : ''}
          </p>

          {data.serialNamespaces.map((namespace) => {
            const share = namespace.capacity ? namespace.reserved / namespace.capacity : 0;
            return share >= 0.8 ? (
              <div key={namespace.prefix} role="alert" className="flex items-start gap-2 rounded-[14px] bg-market-tint p-3 text-[12px] font-bold text-market">
                <AlertIcon size={16} className="mt-px shrink-0" />
                <span>{namespace.prefix} serials are {Math.round(share * 100)}% used. Plan a wider format.</span>
              </div>
            ) : null;
          })}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className={gvLabel}>Launch state</p>
              <Segmented
                label="Launch state"
                options={LAUNCH_OPTIONS}
                value={draft.launchState}
                onChange={(launchState) => update((value) => ({ ...value, launchState }))}
                className="w-56"
              />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-bold text-ink">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.marketplaceEnabled}
                    onChange={(event) => update((value) => ({ ...value, marketplaceEnabled: event.target.checked }))}
                    className="h-4 w-4 accent-royal"
                  />
                  Marketplace on
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.housingEnabled}
                    onChange={(event) => update((value) => ({ ...value, housingEnabled: event.target.checked }))}
                    className="h-4 w-4 accent-royal"
                  />
                  Housing on
                </label>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate tabular-nums">
                {data.serialNamespaces.map((namespace) => (
                  <li key={namespace.prefix} className="rounded-[8px] bg-surface px-2 py-1">
                    {namespace.prefix} · {namespace.reserved} of {namespace.capacity.toLocaleString()} used
                  </li>
                ))}
              </ul>
            </div>
            <label className={cn(gvLabel, 'mb-0')}>
              Student email domains
              <textarea
                value={draft.domains}
                onChange={(event) => update((value) => ({ ...value, domains: event.target.value }))}
                placeholder="kristujayanti.com"
                spellCheck={false}
                className={cn(gvTextarea, 'mt-1 min-h-24 font-mono')}
              />
              <span className="mt-1 block font-medium text-slate">kristujayanti.com, one per line; subdomains count</span>
            </label>
          </div>

          {draft.campuses.map((campus) => (
            <fieldset key={campus.id} className="rounded-[12px] border border-line p-3">
              <legend className="px-1 text-[12.5px] font-bold text-ink">
                {campus.label} <span className="font-semibold text-slate">· {campus.name}</span>
              </legend>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div>
                  <p className={gvLabel}>
                    <PinIcon size={12} className="mr-1 inline align-[-2px]" />
                    Campus origin{campus.approx ? ' (estimate)' : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      inputMode="decimal"
                      value={campus.lat}
                      onChange={(event) => updateCampus(campus.id, (value) => ({ ...value, lat: event.target.value }))}
                      aria-label={`${campus.label} latitude`}
                      placeholder="Lat"
                      className={cn(gvInput, 'tabular-nums')}
                    />
                    <input
                      inputMode="decimal"
                      value={campus.lng}
                      onChange={(event) => updateCampus(campus.id, (value) => ({ ...value, lng: event.target.value }))}
                      aria-label={`${campus.label} longitude`}
                      placeholder="Lng"
                      className={cn(gvInput, 'tabular-nums')}
                    />
                  </div>
                </div>
                <label className={cn(gvLabel, 'mb-0')}>
                  Safe pickup points, one per line
                  <textarea
                    value={campus.pickups}
                    onChange={(event) => updateCampus(campus.id, (value) => ({ ...value, pickups: event.target.value }))}
                    placeholder="Main gate"
                    className={cn(gvTextarea, 'mt-1 min-h-20')}
                  />
                </label>
              </div>

              <div className="mt-3">
                <p className={gvLabel}>
                  <LandmarkIcon size={12} className="mr-1 inline align-[-2px]" />
                  Landmarks ({campus.landmarks.length})
                </p>
                <div className="space-y-1.5">
                  {campus.landmarks.map((landmark) => (
                    <LandmarkRow
                      key={landmark.key}
                      row={landmark}
                      onChange={(row) => updateCampus(campus.id, (value) => ({ ...value, landmarks: value.landmarks.map((item) => (item.key === row.key ? row : item)) }))}
                      action={(
                        <button
                          type="button"
                          onClick={() => removeLandmark(campus.id, landmark.key)}
                          aria-label={`Remove ${landmark.label || 'landmark'}`}
                          className={cn(gvIconBtn, 'hover:bg-market-tint hover:text-market')}
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                    />
                  ))}
                  <LandmarkRow
                    row={campus.adding}
                    placeholder
                    onChange={(row) => setDraft((value) => (value ? { ...value, campuses: value.campuses.map((item) => (item.id === campus.id ? { ...item, adding: row } : item)) } : value))}
                    action={(
                      <button type="button" onClick={() => addLandmark(campus)} aria-label="Add landmark" className={cn(gvIconBtn, 'text-royal hover:bg-royal-tint hover:text-royal')}>
                        <PlusIcon size={15} />
                      </button>
                    )}
                  />
                </div>
              </div>
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving || loading || !dirty} onClick={() => void save()} className={swButton({ variant: 'primary', size: 'sm' })}>
              {saving ? 'Saving' : `Save ${data.college.shortName}`}
            </button>
            {dirty && <span className="text-[11px] font-semibold text-slate">Unsaved changes</span>}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-slate">Config did not load. Try refresh.</p>
      )}
    </section>
  );
}

function LandmarkRow({
  row,
  onChange,
  action,
  placeholder = false,
}: {
  row: LandmarkDraft;
  onChange: (row: LandmarkDraft) => void;
  action: ReactNode;
  placeholder?: boolean;
}) {
  const field = (key: 'label' | 'area' | 'lat' | 'lng' | 'aliases', label: string, extra?: string) => (
    <input
      value={row[key]}
      onChange={(event) => onChange({ ...row, [key]: event.target.value })}
      aria-label={placeholder ? `New landmark ${label.toLowerCase()}` : `${row.label || 'Landmark'} ${label.toLowerCase()}`}
      placeholder={label}
      inputMode={key === 'lat' || key === 'lng' ? 'decimal' : undefined}
      className={cn(gvInput, 'h-8 min-w-0', placeholder && 'bg-white ring-1 ring-line', extra)}
    />
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_88px_88px_minmax(0,1.3fr)_auto]">
      {field('label', 'Name')}
      {field('area', 'Area')}
      <span className="row-span-2 self-center sm:row-span-1 sm:hidden">{action}</span>
      {field('lat', 'Lat', 'tabular-nums')}
      {field('lng', 'Lng', 'tabular-nums')}
      <span className="col-span-2 sm:col-span-1">{field('aliases', 'Aliases, comma separated')}</span>
      <span className="hidden self-center sm:block">{action}</span>
    </div>
  );
}
