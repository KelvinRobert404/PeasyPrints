import { ContentDetail } from '@/components/campus/ContentDetail';

export default async function GirlsHousingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContentDetail id={id} type="housing" audience="girls" />;
}

