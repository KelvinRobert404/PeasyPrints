import { MarketDetail } from '@/components/campus/MarketDetail';

export default async function GirlsMarketplaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MarketDetail id={id} audience="girls" />;
}
