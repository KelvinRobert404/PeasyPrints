import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { ContactButton } from '@/components/campus/detail/ContactButton';
import { Gallery } from '@/components/campus/detail/Gallery';
import { ReportSheet } from '@/components/campus/detail/ReportSheet';
import { SaveShare } from '@/components/campus/detail/SaveShare';
import { GenderChips } from '@/components/campus/fields/GenderChips';
import { PhotoField } from '@/components/campus/fields/PhotoField';
import { PriceInput } from '@/components/campus/fields/PriceInput';
import { PriceTermsChips } from '@/components/campus/fields/PriceTermsChips';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { LandmarkPicker } from '@/components/campus/places/LandmarkPicker';
import { RingChips } from '@/components/campus/places/RingChips';
import { HousingIcon, MarketIcon } from '@/components/swoop/icons';
import { HousingArt } from '@/components/swoop/illustrations';
import { getCampus } from '@/lib/campus/catalog';
import { isFixtureMode } from '@/lib/firebase/fixtureMode';
import { haversineMeters, roundForPrivacy } from '@/lib/format/distance';
import type { ContactRequest } from '@/types/campus';

export const metadata: Metadata = {
  title: 'Shared parts',
  robots: { index: false, follow: false },
};

const SAMPLE_LISTING_ID = 'dev-parts-sample';

const PENDING_CONTACT: ContactRequest = {
  id: 'dev-parts-contact',
  contentType: 'marketplace',
  contentId: SAMPLE_LISTING_ID,
  serial: 'MK-0001',
  buyerId: 'verified-kju-main',
  sellerId: 'verified-kju-airport',
  buyerDisplayName: 'Asha',
  status: 'pending',
  createdAt: '2026-11-07T09:00:00.000Z',
  expiresAt: '2026-11-08T09:00:00.000Z',
};

function Part({ name, note, children }: { name: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-line bg-white p-3">
      <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">{name}</h2>
      {note ? <p className="mt-0.5 text-[11px] text-slate">{note}</p> : null}
      <div className="mt-2.5 space-y-3">{children}</div>
    </section>
  );
}

/** Dev only: every shared campus part with sample props. 404 outside fixture mode. */
export default function DevPartsPage() {
  if (!isFixtureMode()) notFound();

  const campus = getCampus('kju-main');
  if (!campus) notFound();
  const campusCode = 'KJU';
  const falcon = campus.landmarks.find((landmark) => landmark.id === 'kju-main-falcon-hospital') ?? campus.landmarks[0];
  const picked = falcon
    ? { landmarkId: falcon.id, label: falcon.label, area: falcon.area, roughDistanceM: roundForPrivacy(haversineMeters(campus.origin, falcon)) }
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-3 pb-3 pt-2">
      <p className="text-[10.5px] font-semibold text-slate">Fixture mode · {campus.label}</p>
      <h1 className="font-heading text-[16px] leading-[1.1] text-ink">Shared campus parts</h1>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <Part name="Price" note="Type 1.5k or 1L. The preview updates live.">
          <PriceInput label="Price" defaultValue={1500} />
          <PriceInput label="Rent per person" suffix="pp" defaultValue={8500} />
          <PriceInput label="Deposit" suffix="dep" defaultValue={120000} />
        </Part>

        <Part name="Price terms" note="Market has five. Rent has three.">
          <PriceTermsChips label="Price terms" />
          <PriceTermsChips mode="rent" label="Rent terms" />
          <PriceTermsChips label="Price terms, locked" defaultValue="free" disabled />
        </Part>

        <Part name="Who it is for">
          <GenderChips label="Who can reply" />
          <GenderChips label="Girls' space" locked />
        </Part>

        <Part name="Distance rings" note="Starts at 1 km.">
          <RingChips />
        </Part>

        <Part name="Landmark" note="Posters only. Search by name or nickname.">
          <LandmarkPicker landmarks={campus.landmarks} origin={campus.origin} campusCode={campusCode} />
          <LandmarkPicker
            label="Already picked"
            landmarks={campus.landmarks}
            origin={campus.origin}
            campusCode={campusCode}
            defaultValue={picked}
          />
        </Part>

        <Part name="Distance line">
          <DistanceLine meters={650} campusLabel={campusCode} />
          <DistanceLine meters={1850} campusLabel={campusCode} />
        </Part>

        <Part name="Photos" note="Uploads go to the fake bucket in fixture mode.">
          <PhotoField max={5} />
        </Part>

        <Part name="Gallery" note="No photo: icon or Swoop art, never stock.">
          <div className="grid grid-cols-2 gap-2">
            <Gallery images={[]} title="Study table" fallback={MarketIcon} />
            <Gallery images={[]} title="Room near Falcon" fallback={HousingIcon} art={<HousingArt width={96} height={88} />} />
          </div>
        </Part>

        <Part name="Contact" note="Live, waiting and reserved.">
          <ContactButton contentType="marketplace" contentId={SAMPLE_LISTING_ID} />
          <ContactButton contentType="marketplace" contentId={SAMPLE_LISTING_ID} initialContact={PENDING_CONTACT} />
          <ContactButton contentType="marketplace" contentId={SAMPLE_LISTING_ID} disabledLabel="Reserved for someone" />
        </Part>

        <Part name="Save, share and report">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold text-ink">Study table</span>
            <SaveShare contentType="marketplace" contentId={SAMPLE_LISTING_ID} title="Study table" />
          </div>
          <ReportSheet contentType="marketplace" contentId={SAMPLE_LISTING_ID} />
        </Part>
      </div>
    </main>
  );
}
