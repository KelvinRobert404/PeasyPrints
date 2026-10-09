import { HousingIcon, MarketIcon } from '@/components/swoop/icons';
import { PageHeader, ServiceTile, Tag } from '@/components/swoop/primitives';
import { CampusGate } from '@/components/campus/CampusGate';

export default function GirlsSpacePage() {
  return (
    <CampusGate girlsOnly>
      <div className="min-h-screen bg-white pb-3">
        <PageHeader title="Girls’ space" kicker="Private · KJU verified" backHref="/" />
        <main className="mx-auto max-w-2xl px-3 pt-1">
          <section className="flex flex-col gap-1 rounded-[14px] bg-girls-tint px-3 pb-3 pt-[11px]">
            <Tag tone="white" className="self-start text-girls">Only approved members</Tag>
            <h2 className="font-heading max-w-[220px] text-[17px] leading-none text-ink">A smaller circle. A safer exchange.</h2>
            <p className="max-w-[260px] text-[11px] leading-[1.3] text-text-secondary">Marketplace and housing stay separate. Your private access connects them.</p>
          </section>
          <div className="grid grid-cols-2 gap-1.5 pt-3">
            <ServiceTile title="Marketplace" subtitle="Resale and requests" href="/girls-space/marketplace" art={<MarketIcon size={24} className="text-girls" />} />
            <ServiceTile title="Housing" subtitle="Rooms and roommates" href="/girls-space/housing" art={<HousingIcon size={24} className="text-girls" />} />
          </div>
        </main>
      </div>
    </CampusGate>
  );
}
