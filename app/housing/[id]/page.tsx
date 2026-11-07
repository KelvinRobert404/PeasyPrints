import { HousingDetail } from '@/components/campus/housing/HousingDetail';

export default async function HousingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HousingDetail id={id} />;
}
