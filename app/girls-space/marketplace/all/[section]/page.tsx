import { notFound } from 'next/navigation';
import { MarketSeeAll } from '@/components/campus/market/MarketSeeAll';
import { MARKET_SECTIONS, type MarketSectionId } from '@/lib/campus/market';

const SECTION_IDS: ReadonlySet<string> = new Set(MARKET_SECTIONS.map((section) => section.id));

export default async function GirlsMarketSeeAllPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTION_IDS.has(section)) notFound();
  return <MarketSeeAll section={section as MarketSectionId} audience="girls" />;
}
