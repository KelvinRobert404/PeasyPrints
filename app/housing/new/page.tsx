import type { Metadata } from 'next';
import { HousingPostForm } from '@/components/campus/housing/HousingPostForm';
import { HOUSING_KINDS, type HousingKind } from '@/lib/campus/housing/model';
import type { CampusAudience } from '@/types/campus';

export const metadata: Metadata = {
  title: 'New housing post',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function parseAudience(value: string | string[] | undefined): CampusAudience {
  return first(value) === 'girls' ? 'girls' : 'campus';
}

function parseKind(value: string | string[] | undefined): HousingKind {
  const kind = first(value);
  return (HOUSING_KINDS as readonly string[]).includes(kind) ? (kind as HousingKind) : 'room';
}

/** Short free text from the URL, or null. */
function parseText(value: string | string[] | undefined, max: number): string | null {
  const text = first(value).replace(/\s+/g, ' ').slice(0, max).trim();
  return text.length >= 2 ? text : null;
}

/**
 * /housing/new. Reads ?audience, ?type, ?area and ?title on the server.
 * ?type=roommate&area=Kothanur opens a roommate post placed at Kothanur.
 */
export default async function NewHousingPostPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return (
    <HousingPostForm
      audience={parseAudience(params.audience)}
      initialKind={parseKind(params.type)}
      initialArea={parseText(params.area, 60)}
      initialTitle={parseText(params.title, 80)}
    />
  );
}
