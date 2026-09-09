'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CampusGate } from '@/components/campus/CampusGate';
import { CampusHeader } from '@/components/campus/CampusHeader';
import type { CampusAudience, HousingPostType } from '@/types/campus';

const AMENITIES = ['Wi-Fi', 'Attached bath', 'Kitchen', 'Power backup', 'Parking', 'Security'];

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
    <CampusGate girlsOnly={audience === 'girls'}><div className="min-h-screen bg-[#eef2ef] pb-10"><CampusHeader title="New housing post" eyebrow={audience === 'girls' ? 'Girls’ Space' : 'KJU Housing'} accent="#2e6f57" />
      <form onSubmit={submit} className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        <Section label="What do you need?"><div className="grid grid-cols-2 gap-2">{(['room', 'roommate', 'replacement', 'sublet'] as const).map((type) => <button type="button" key={type} onClick={() => setPostType(type)} className={`campus-press rounded-2xl px-3 py-3 text-xs font-extrabold capitalize ${postType === type ? 'bg-[#193c31] text-white' : 'bg-[#eef2ef] text-zinc-600'}`}>{type}</button>)}</div></Section>
        <Section label="The essentials"><Input label="Title" required value={form.title} onChange={(value) => update('title', value)} placeholder="Room near KJU for two" /><TextArea label="Description" value={form.description} onChange={(value) => update('description', value)} placeholder="Tell students what makes this a good fit…" /><div className="grid grid-cols-2 gap-3"><Input label="Monthly rent" type="number" value={form.rent} onChange={(value) => update('rent', value)} placeholder="₹" /><Input label="Deposit" type="number" value={form.deposit} onChange={(value) => update('deposit', value)} placeholder="₹" /></div><Input label="Available from" type="date" value={form.availableFrom} onChange={(value) => update('availableFrom', value)} /></Section>
        <Section label="Location without oversharing"><Input label="Area / locality" required value={form.area} onChange={(value) => update('area', value)} placeholder="Kothanur" /><Input label="Commute to KJU" value={form.commuteLabel} onChange={(value) => update('commuteLabel', value)} placeholder="10 min walk" /><p className="text-[11px] font-semibold leading-5 text-zinc-500">Exact addresses are never included in the public post.</p></Section>
        {postType !== 'roommate' ? <Section label="Room details"><div className="grid grid-cols-2 gap-3"><Input label="Occupancy" value={form.occupancy} onChange={(value) => update('occupancy', value)} placeholder="Single / shared" /><Input label="Furnishing" value={form.furnishing} onChange={(value) => update('furnishing', value)} placeholder="Furnished" /></div><div className="flex flex-wrap gap-2">{AMENITIES.map((item) => <button type="button" key={item} onClick={() => setAmenities((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])} className={`campus-press rounded-full px-3 py-2 text-[11px] font-extrabold ${amenities.includes(item) ? 'bg-[#d8ff6a] text-[#193c31]' : 'bg-[#eef2ef] text-zinc-600'}`}>{item}</button>)}</div></Section> : null}
        {postType === 'roommate' ? <Section label="Compatibility card"><div className="grid grid-cols-2 gap-3"><Input label="Budget" type="number" value={form.budget} onChange={(value) => update('budget', value)} /><Input label="Move-in" type="date" value={form.moveInDate} onChange={(value) => update('moveInDate', value)} /><Input label="Sleep schedule" value={form.sleepSchedule} onChange={(value) => update('sleepSchedule', value)} placeholder="Early bird" /><Input label="Food" value={form.foodPreference} onChange={(value) => update('foodPreference', value)} placeholder="Vegetarian" /><Input label="Cleanliness" value={form.cleanliness} onChange={(value) => update('cleanliness', value)} placeholder="Very tidy" /><Input label="Smoking" value={form.smokingPreference} onChange={(value) => update('smokingPreference', value)} placeholder="No smoking" /></div></Section> : null}
        <Section label="Photos + contact"><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 10))} className="mb-4 block w-full rounded-2xl bg-[#eef2ef] p-3 text-xs font-bold" /><Input label="WhatsApp number" required value={form.whatsappNumber} onChange={(value) => update('whatsappNumber', value)} placeholder="Shared only after your approval" /></Section>
        {error ? <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}<button disabled={submitting} className="campus-press h-14 w-full rounded-2xl bg-[#193c31] text-sm font-extrabold text-white disabled:opacity-50">{submitting ? 'Publishing…' : 'Publish housing post'}</button>
      </form></div></CampusGate>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) { return <section className="space-y-4 rounded-[28px] bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#2e6f57]">{label}</p>{children}</section>; }
function Input({ label, value, onChange, placeholder, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) { return <label className="block"><span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-zinc-400">{label}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="campus-input" /></label>; }
function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block"><span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-zinc-400">{label}</span><textarea required minLength={12} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="campus-input min-h-28 resize-none py-3" /></label>; }
