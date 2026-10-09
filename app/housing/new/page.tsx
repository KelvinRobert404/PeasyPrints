'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CampusGate } from '@/components/campus/CampusGate';
import { HOUSING_TYPE_LABELS } from '@/components/campus/HousingCard';
import { CameraIcon, LockIcon } from '@/components/swoop/icons';
import { Chip, PageHeader, Segmented, swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience, HousingPostType } from '@/types/campus';

const AMENITIES = ['Wi-Fi', 'Attached bath', 'Kitchen', 'Power backup', 'Parking', 'Security'];
const POST_TYPES = (['room', 'roommate', 'replacement', 'sublet'] as const).map((value) => ({ value, label: HOUSING_TYPE_LABELS[value] }));

export default function NewHousingPostPage() {
  const router = useRouter();
  const [audience, setAudience] = useState<CampusAudience>('campus');
  const [postType, setPostType] = useState<HousingPostType>('room');
  const [form, setForm] = useState({ title: '', description: '', rent: '', deposit: '', availableFrom: '', area: '', commuteLabel: '', occupancy: '', furnishing: '', whatsappNumber: '', budget: '', moveInDate: '', sleepSchedule: '', foodPreference: '', cleanliness: '', smokingPreference: '' });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setAudience(new URLSearchParams(window.location.search).get('audience') === 'girls' ? 'girls' : 'campus'), []);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const images: string[] = [];
      for (const file of files.slice(0, 10)) {
        const data = new FormData(); data.append('file', file); data.append('audience', audience);
        const response = await fetch('/api/campus/media', { method: 'POST', body: data }); const uploaded = await response.json();
        if (!response.ok) throw new Error(uploaded.error || 'Image upload failed'); images.push(uploaded.url);
      }
      const roommate = postType === 'roommate';
      const endpoint = audience === 'girls' ? '/api/girls-space/housing' : '/api/housing/posts';
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audience, postType, title: form.title, description: form.description, rent: form.rent ? Number(form.rent) : null, deposit: form.deposit ? Number(form.deposit) : null, availableFrom: form.availableFrom || null, area: form.area, commuteLabel: form.commuteLabel || null, occupancy: form.occupancy || null, furnishing: form.furnishing || null, amenities, images, whatsappNumber: form.whatsappNumber, promotionEligible: audience === 'campus', compatibility: roommate ? { budget: form.budget ? Number(form.budget) : null, moveInDate: form.moveInDate || null, sleepSchedule: form.sleepSchedule || null, foodPreference: form.foodPreference || null, cleanliness: form.cleanliness || null, smokingPreference: form.smokingPreference || null } : null }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not publish housing post');
      router.replace(`${audience === 'girls' ? '/girls-space/housing' : '/housing'}/${result.id}`);
    } catch (cause: any) { setError(cause.message || 'Could not publish housing post'); setSubmitting(false); }
  };

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="pb-3">
        <PageHeader
          backHref={audience === 'girls' ? '/girls-space/housing' : '/housing'}
          kicker={audience === 'girls' ? 'Girls’ space · Housing' : 'Housing · KJU'}
          title="New housing post"
        />
        <form onSubmit={submit} className="px-3">
          <Section label="What do you need?">
            <Segmented label="Post type" options={POST_TYPES} value={postType} onChange={setPostType} />
          </Section>
          <Section label="The essentials">
            <Input label="Title" required value={form.title} onChange={(value) => update('title', value)} placeholder="Room near KJU for two" />
            <TextArea label="Description" value={form.description} onChange={(value) => update('description', value)} placeholder="Tell students what makes this a good fit…" />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Monthly rent (₹)" type="number" value={form.rent} onChange={(value) => update('rent', value)} placeholder="₹" />
              <Input label="Deposit (₹)" type="number" value={form.deposit} onChange={(value) => update('deposit', value)} placeholder="₹" />
            </div>
            <Input label="Available from" type="date" value={form.availableFrom} onChange={(value) => update('availableFrom', value)} />
          </Section>
          <Section label="Location without oversharing">
            <Input label="Area or locality" required value={form.area} onChange={(value) => update('area', value)} placeholder="Kothanur" />
            <Input label="Commute to KJU" value={form.commuteLabel} onChange={(value) => update('commuteLabel', value)} placeholder="10 min walk" />
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate">
              <LockIcon size={14} className="shrink-0 text-ink" />
              Exact addresses are never included in the public post.
            </p>
          </Section>
          {postType !== 'roommate' ? (
            <Section label="Room details">
              <div className="grid grid-cols-2 gap-2">
                <Input label="Occupancy" value={form.occupancy} onChange={(value) => update('occupancy', value)} placeholder="Single / shared" />
                <Input label="Furnishing" value={form.furnishing} onChange={(value) => update('furnishing', value)} placeholder="Furnished" />
              </div>
              <div role="group" aria-label="Amenities" className="flex flex-wrap gap-1.5">
                {AMENITIES.map((item) => (
                  <Chip
                    key={item}
                    selected={amenities.includes(item)}
                    onClick={() => setAmenities((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}
                  >
                    {item}
                  </Chip>
                ))}
              </div>
            </Section>
          ) : null}
          {postType === 'roommate' ? (
            <Section label="Compatibility card">
              <div className="grid grid-cols-2 gap-2">
                <Input label="Budget (₹)" type="number" value={form.budget} onChange={(value) => update('budget', value)} />
                <Input label="Move-in" type="date" value={form.moveInDate} onChange={(value) => update('moveInDate', value)} />
                <Input label="Sleep schedule" value={form.sleepSchedule} onChange={(value) => update('sleepSchedule', value)} placeholder="Early bird" />
                <Input label="Food" value={form.foodPreference} onChange={(value) => update('foodPreference', value)} placeholder="Vegetarian" />
                <Input label="Cleanliness" value={form.cleanliness} onChange={(value) => update('cleanliness', value)} placeholder="Very tidy" />
                <Input label="Smoking" value={form.smokingPreference} onChange={(value) => update('smokingPreference', value)} placeholder="No smoking" />
              </div>
            </Section>
          ) : null}
          <Section label="Photos and contact">
            <PhotoPicker files={files} onChange={setFiles} />
            <Input label="WhatsApp number" required value={form.whatsappNumber} onChange={(value) => update('whatsappNumber', value)} placeholder="Shared only after your approval" />
          </Section>
          <div className="space-y-2 pt-3.5">
            {error ? <div role="alert" className="rounded-[12px] bg-market-tint px-3 py-2.5 text-[12px] font-semibold text-market">{error}</div> : null}
            <button type="submit" disabled={submitting} className={cn(swButton({ size: 'lg' }), 'w-full')}>
              {submitting ? 'Publishing…' : 'Publish housing post'}
            </button>
          </div>
        </form>
      </div>
    </CampusGate>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 pt-3.5">
      <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">{label}</h2>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[11px] font-bold text-text-secondary">{children}</span>;
}

function Input({ label, value, onChange, placeholder, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="campus-input" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <textarea required minLength={12} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="campus-input min-h-24 resize-none py-2.5" />
    </label>
  );
}

/** Photo tiles: an "Add photos" picker tile followed by previews of the chosen files. */
function PhotoPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return (
    <div className="grid grid-cols-4 gap-1.5">
      <label className="campus-press flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] bg-surface text-ink focus-within:ring-2 focus-within:ring-royal/40">
        <CameraIcon size={22} />
        <span className="text-[10.5px] font-bold">{files.length ? 'Change' : 'Add photos'}</span>
        <span className="text-[9.5px] font-semibold text-slate">Up to 10</span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => onChange(Array.from(event.target.files || []).slice(0, 10))}
          className="sr-only"
        />
      </label>
      {previews.map((url, index) => (
        <span key={url} className="aspect-square overflow-hidden rounded-[12px] bg-surface">
          <img src={url} alt={`Selected photo ${index + 1}`} className="h-full w-full object-cover" />
        </span>
      ))}
    </div>
  );
}
