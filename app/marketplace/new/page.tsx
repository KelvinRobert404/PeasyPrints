'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CampusGate } from '@/components/campus/CampusGate';
import { CampusHeader } from '@/components/campus/CampusHeader';
import { MARKETPLACE_CATEGORIES, MARKETPLACE_CATEGORY_LABELS } from '@/lib/campus/constants';
import type { CampusAudience, MarketplacePostType } from '@/types/campus';

export default function NewMarketplaceListingPage() {
  const router = useRouter();
  const [audience, setAudience] = useState<CampusAudience>('campus');
  const [postType, setPostType] = useState<MarketplacePostType>('sell');
  const [category, setCategory] = useState<(typeof MARKETPLACE_CATEGORIES)[number]>('books_notes');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('Good');
  const [negotiable, setNegotiable] = useState(false);
  const [pickupPoints, setPickupPoints] = useState<Array<{ id: string; label: string }>>([]);
  const [pickupPointId, setPickupPointId] = useState('');
  const [area, setArea] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const nextAudience = new URLSearchParams(window.location.search).get('audience') === 'girls' ? 'girls' : 'campus';
    setAudience(nextAudience);
    fetch('/api/campus/config').then((response) => response.json()).then((data) => setPickupPoints(data.pickupPoints || [])).catch(() => undefined);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const images: string[] = [];
      for (const file of files.slice(0, 5)) {
        const form = new FormData(); form.append('file', file); form.append('audience', audience);
        const upload = await fetch('/api/campus/media', { method: 'POST', body: form });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded.error || 'Image upload failed');
        images.push(uploaded.url);
      }
      const pickup = pickupPoints.find((item) => item.id === pickupPointId);
      const endpoint = audience === 'girls' ? '/api/girls-space/marketplace' : '/api/marketplace/listings';
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, postType, category, title, description, price: price ? Number(price) : null, condition: condition || null, negotiable, images, pickupPointId: pickup?.id || null, pickupLabel: pickup?.label || null, area: area || null, whatsappNumber, promotionEligible: audience === 'campus' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not publish listing');
      router.replace(`${audience === 'girls' ? '/girls-space/marketplace' : '/marketplace'}/${data.id}`);
    } catch (cause: any) { setError(cause.message || 'Could not publish listing'); setSubmitting(false); }
  };

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="min-h-screen bg-[#f4f5f7] pb-10">
        <CampusHeader title="New marketplace post" eyebrow={audience === 'girls' ? 'Girls’ Space' : 'KJU Marketplace'} accent={audience === 'girls' ? '#c23b73' : '#ff5c35'} />
        <form onSubmit={submit} className="mx-auto max-w-xl space-y-4 px-4 pt-4">
          <section className="rounded-[28px] bg-white p-4">
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-zinc-400">What are you posting?</p>
            <div className="grid grid-cols-3 gap-2">{(['sell', 'wanted', 'free'] as const).map((type) => <button type="button" key={type} onClick={() => setPostType(type)} className={`campus-press rounded-2xl px-3 py-3 text-xs font-extrabold capitalize ${postType === type ? 'bg-black text-white' : 'bg-[#f4f5f7] text-zinc-600'}`}>{type}</button>)}</div>
          </section>
          <section className="space-y-4 rounded-[28px] bg-white p-4">
            <Field label="Title"><input required minLength={4} maxLength={90} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should campus know?" className="campus-input" /></Field>
            <Field label="Category"><select value={category} onChange={(event) => setCategory(event.target.value as (typeof MARKETPLACE_CATEGORIES)[number])} className="campus-input">{MARKETPLACE_CATEGORIES.map((item) => <option key={item} value={item}>{MARKETPLACE_CATEGORY_LABELS[item]}</option>)}</select></Field>
            <Field label="Description"><textarea required minLength={8} maxLength={1200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Condition, edition, size, what’s included…" className="campus-input min-h-28 resize-none py-3" /></Field>
            {postType !== 'free' ? <Field label={postType === 'wanted' ? 'Your budget' : 'Price'}><input inputMode="numeric" min="0" type="number" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="₹ 0" className="campus-input" /></Field> : null}
            {postType === 'sell' ? <div className="grid grid-cols-2 gap-3"><Field label="Condition"><select value={condition} onChange={(event) => setCondition(event.target.value)} className="campus-input"><option>Like new</option><option>Good</option><option>Used</option><option>Needs repair</option></select></Field><label className="flex items-end"><span className="flex h-12 w-full items-center justify-between rounded-2xl bg-[#f4f5f7] px-4 text-xs font-extrabold">Negotiable<input type="checkbox" checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} className="h-4 w-4 accent-black" /></span></label></div> : null}
          </section>
          <section className="space-y-4 rounded-[28px] bg-white p-4">
            <Field label="Safe campus pickup"><select value={pickupPointId} onChange={(event) => setPickupPointId(event.target.value)} className="campus-input"><option value="">Choose a campus spot</option>{pickupPoints.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Approximate off-campus area (optional)"><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Kothanur" className="campus-input" /></Field>
            <Field label="WhatsApp number"><input required inputMode="tel" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="91… (shared only after approval)" className="campus-input" /></Field>
          </section>
          <section className="rounded-[28px] bg-white p-4"><Field label="Photos (up to 5)"><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} className="block w-full rounded-2xl bg-[#f4f5f7] p-3 text-xs font-bold" /></Field>{files.length ? <p className="mt-2 text-xs font-bold text-zinc-500">{files.length} photo{files.length === 1 ? '' : 's'} ready</p> : null}</section>
          <p className="px-2 text-[11px] font-semibold leading-5 text-zinc-500">Campus posts may be featured in PeasyPrints public promotional material. You can turn promotion off later. Girls’ Space posts are never publicly promoted.</p>
          {error ? <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
          <button disabled={submitting} className="campus-press h-14 w-full rounded-2xl bg-black text-sm font-extrabold text-white disabled:opacity-50">{submitting ? 'Publishing…' : 'Publish to campus'}</button>
        </form>
      </div>
    </CampusGate>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-zinc-400">{label}</span>{children}</label>;
}
