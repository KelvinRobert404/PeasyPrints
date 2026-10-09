import { SwoopLogo } from '@/components/swoop/Logo';
import { Card, IconTile, ListRow, ServiceTile } from '@/components/swoop/primitives';
import { DocIcon, HelpIcon, HousingIcon, MarketIcon, PrintIcon, ShieldCheckIcon } from '@/components/swoop/icons';

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col bg-white px-3 pb-3 pt-4">
      <SwoopLogo size={22} className="self-start" />
      <h1 className="font-heading mt-3 text-[16px] leading-[1.1] text-ink">Campus, sorted.</h1>
      <p className="mt-1 max-w-[340px] text-[12.5px] leading-[1.5] text-text-secondary">
        Print, marketplace, housing and canteen for your campus. One account, one wallet, pickup nearby.
      </p>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <ServiceTile
          href="/upload"
          tone="royal"
          title="Print"
          subtitle="Upload PDFs, ready in minutes."
          art={<PrintIcon size={24} className="text-white/90" />}
        />
        <ServiceTile
          href="/marketplace"
          title="Market"
          subtitle="Pre-loved finds on campus."
          art={<MarketIcon size={24} className="text-market" />}
        />
      </div>

      <Card className="mt-2 px-3">
        <ListRow href="/housing" leading={<IconTile icon={HousingIcon} />} title="Housing" subtitle="Find a place to stay near campus" divider={false} />
      </Card>

      <section className="pt-3.5">
        <h2 className="font-heading text-[14.5px] leading-[1.1] text-ink">More</h2>
        <Card className="mt-2 px-3">
          <ListRow href="/contact" leading={<IconTile icon={HelpIcon} />} title="Help & support" />
          <ListRow href="/privacy" leading={<IconTile icon={ShieldCheckIcon} />} title="Privacy policy" />
          <ListRow href="/terms" leading={<IconTile icon={DocIcon} />} title="Terms of service" divider={false} />
        </Card>
      </section>
    </main>
  );
}
