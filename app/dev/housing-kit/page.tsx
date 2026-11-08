import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { HousingListingCard, type HousingCardItem } from '@/components/campus/housing/HousingListingCard';
import { getCampus } from '@/lib/campus/catalog';
import { buildHousingListings, displayNameOf, type FixtureDoc } from '@/lib/campus/fixtures';
import { isFixtureMode } from '@/lib/firebase/fixtureMode';
import type { DocTime } from '@/types/campus';
import type { HousingListingDoc } from '@/types/housing';

export const metadata: Metadata = {
  title: 'Housing kit',
  robots: { index: false, follow: false },
};

/**
 * v2 fields the stored doc does not carry yet, read from each fixture's own
 * title, description or note. Kit only, so every card line shows up here.
 */
const KIT_EXTRAS: Readonly<Record<string, Partial<HousingCardItem>>> = {
  'hsg-pg-falcon': { rentTerms: 'fixed' },
  'hsg-house-hennur': { rentTerms: 'negotiable' },
  'hsg-agent-byrathi': { postedAs: 'agent', rentTerms: 'slightly_negotiable' },
  'hsg-triple-price-drop': { previousRentPp: 8500 },
};

const ROOMMATE_EXTRAS: Readonly<Record<string, { groupSize?: number; languages?: string[]; homeState?: string }>> = {
  'hsg-roommate-kerala': { groupSize: 2, languages: ['Malayalam', 'English'], homeState: 'Kerala' },
  'hsg-roommate-airport': { languages: ['Hindi', 'English'], homeState: 'Bihar' },
};

function iso(value: DocTime): string {
  return value.toDate().toISOString();
}

function isoOrNull(value: DocTime | null): string | null {
  return value ? iso(value) : null;
}

/** Stored doc to what the card reads: ISO times, no author id, place without coordinates. */
function toCardItem({ id, data }: FixtureDoc<HousingListingDoc>): HousingCardItem {
  const { authorId, posterDisplayName, place, moveIn, confirmedAt, createdAt, updatedAt, availabilityExpiresAt, roommate, ...rest } = data;
  const { lat, lng, ...publicPlace } = place;
  const roommateExtras = ROOMMATE_EXTRAS[id];
  return {
    ...rest,
    id,
    place: publicPlace,
    poster: { displayName: posterDisplayName || displayNameOf(authorId), verified: true },
    moveIn: isoOrNull(moveIn),
    confirmedAt: isoOrNull(confirmedAt),
    createdAt: iso(createdAt),
    updatedAt: iso(updatedAt),
    availabilityExpiresAt: iso(availabilityExpiresAt),
    roommate: roommate ? { ...roommate, ...roommateExtras } : null,
    isSaved: false,
    isOwner: false,
    ...KIT_EXTRAS[id],
  };
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="pt-3">
      <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">{title}</h2>
      <p className="mt-0.5 text-[11px] text-slate">{note}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function FixtureLabel({ id }: { id: string }) {
  return <p className="mb-1 truncate text-[10px] font-semibold text-slate">{id}</p>;
}

/** Dev only: every SEED housing fixture as a grid card and a row card. 404 outside fixture mode. */
export default function HousingKitPage() {
  if (!isFixtureMode()) notFound();

  const campus = getCampus('kju-main');
  const items = buildHousingListings(new Date()).map(toCardItem);

  return (
    <main className="mx-auto w-full max-w-5xl px-3 pb-3 pt-2">
      <p className="text-[10.5px] font-semibold text-slate">Fixture mode · {campus?.label ?? 'KJU Main'}</p>
      <h1 className="font-heading text-[16px] leading-[1.1] text-ink">Housing cards</h1>

      <Section title="Grid" note={`${items.length} fixtures. Feed tiles.`}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
          {items.map((item) => (
            <div key={item.id} className="min-w-0">
              <FixtureLabel id={item.id} />
              <HousingListingCard item={item} href={`/housing/${item.id}`} variant="grid" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Row" note="Agents digest lines.">
        <div className="grid grid-cols-1 gap-2">
          {items.map((item) => (
            <div key={item.id} className="min-w-0">
              <FixtureLabel id={item.id} />
              <HousingListingCard item={item} href={`/housing/${item.id}`} variant="row" />
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
