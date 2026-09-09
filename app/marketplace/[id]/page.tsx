import { ContentDetail } from '@/components/campus/ContentDetail';

export default async function MarketplaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContentDetail id={id} type="marketplace" />;
}
