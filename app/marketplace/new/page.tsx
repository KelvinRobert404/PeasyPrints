'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CampusGate } from '@/components/campus/CampusGate';
import { Chip, PageHeader, SectionHeader, Segmented, swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';
import { MARKETPLACE_CATEGORIES, MARKETPLACE_CATEGORY_LABELS } from '@/lib/campus/constants';
import type { CampusAudience, MarketplacePostType } from '@/types/campus';

const POST_TYPES = (['sell', 'wanted', 'free'] as const).map((value) => ({ value, label: value }));
const CONDITIONS = ['Like new', 'Good', 'Used', 'Needs repair'];

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
      <div className="min-h-screen bg-white pb-3">
        <PageHeader
          title="New marketplace post"
          kicker={audience === 'girls' ? 'Girls’ space' : 'KJU marketplace'}
          backHref={audience === 'girls' ? '/girls-space/marketplace' : '/marketplace'}
        />
        <form onSubmit={submit} className="mx-auto max-w-xl px-3">
          <section className="pt-2">
            <SectionHeader title="What are you posting?" />
            <Segmented label="Post type" options={POST_TYPES} value={postType} onChange={setPostType} className="mt-2" />
          </section>

          <section className="space-y-3 pt-3.5">
            <SectionHeader title="The essentials" />
            <Field label="Title"><input required minLength={4} maxLength={90} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should campus know?" className="campus-input" /></Field>
            <ChipGroup label="Category">
              {MARKETPLACE_CATEGORIES.map((item) => <Chip key={item} selected={category === item} onClick={() => setCategory(item)}>{MARKETPLACE_CATEGORY_LABELS[item]}</Chip>)}
            </ChipGroup>
            <Field label="Description"><textarea required minLength={8} maxLength={1200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Condition, edition, size, what’s included…" className="campus-input min-h-28 resize-none py-3" /></Field>
            {postType !== 'free' ? <Field label={postType === 'wanted' ? 'Your budget' : 'Price'}><input inputMode="numeric" min="0" type="number" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="₹ 0" className="campus-input" /></Field> : null}
            {postType === 'sell' ? (
              <>
                <ChipGroup label="Condition">
                  {CONDITIONS.map((item) => <Chip key={item} selected={condition === item} onClick={() => setCondition(item)}>{item}</Chip>)}
                </ChipGroup>
                <label className="flex h-11 items-center justify-between rounded-[12px] bg-surface px-3.5 text-[12.5px] font-bold text-ink">
                  Negotiable
                  <input type="checkbox" checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} className="h-4 w-4 accent-royal" />
                </label>
              </>
            ) : null}
          </section>

          <section className="space-y-3 pt-3.5">
            <SectionHeader title="Pickup and contact" />
            <Field label="Safe campus pickup"><select value={pickupPointId} onChange={(event) => setPickupPointId(event.target.value)} className="campus-input"><option value="">Choose a campus spot</option>{pickupPoints.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Approximate off-campus area (optional)"><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Kothanur" className="campus-input" /></Field>
            <Field label="WhatsApp number"><input required inputMode="tel" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="91… (shared only after approval)" className="campus-input" /></Field>
          </section>

          <section className="space-y-1.5 pt-3.5">
            <SectionHeader title="Photos" kicker="Up to 5" />
            <Field label="Add photos">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))}
                className="block w-full rounded-[12px] bg-surface p-2.5 text-[11.5px] font-semibold text-text-secondary file:mr-3 file:h-8 file:rounded-full file:border-0 file:bg-white file:px-3 file:text-[12px] file:font-bold file:text-ink"
              />
            </Field>
            {files.length ? <p className="text-[11px] font-semibold text-slate">{files.length} photo{files.length === 1 ? '' : 's'} ready</p> : null}
          </section>

          <p className="pt-3 text-[11px] leading-[1.45] text-slate">Campus posts may be featured in PeasyPrints public promotional material. You can turn promotion off later. Girls’ Space posts are never publicly promoted.</p>
          {error ? <div role="alert" className="mt-2.5 rounded-[12px] bg-market-tint px-3 py-2.5 text-[11.5px] font-bold text-market">{error}</div> : null}
          <button type="submit" disabled={submitting} className={cn(swButton({ variant: 'primary', size: 'lg' }), 'mt-3 w-full')}>{submitting ? 'Publishing…' : 'Publish to campus'}</button>
        </form>
      </div>
    </CampusGate>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-text-secondary">{label}</span>{children}</label>;
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-1.5 block text-[11px] font-bold text-text-secondary" aria-hidden="true">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
