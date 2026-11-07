import { MarketDetail } from '@/components/campus/MarketDetail';

export default async function MarketplaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MarketDetail id={id} />;
}
