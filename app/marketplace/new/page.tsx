import type { Metadata } from 'next';
import { NewListingForm } from '@/components/campus/market-form/registry';
import { parseAudienceParam, parseKindParam, prefillTitle } from '@/components/campus/market-form/payload';

export const metadata: Metadata = {
  title: 'New post',
  robots: { index: false, follow: false },
};

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * /marketplace/new. Reads ?kind, ?audience and ?q on the server and hands
 * them to the form. ?kind=wanted&q=cycle opens with 'Any cycle available?'.
 */
export default async function NewMarketListingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const kind = parseKindParam(params.kind);
  const audience = parseAudienceParam(params.audience);
  const title = prefillTitle(kind, params.q);
  return <NewListingForm initialKind={kind} audience={audience} initialTitle={title} />;
}
