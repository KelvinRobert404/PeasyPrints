import Link from 'next/link';
import { PageHeader } from '@/components/swoop/primitives';

const h2 = 'font-heading text-[14.5px] leading-[1.15] text-ink';
const link = 'font-semibold text-royal underline underline-offset-2';

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <PageHeader title="Terms of service" backHref="/" />
      <main className="px-3 pb-3 text-[13px] leading-[1.55] text-text-secondary">
        <p className="pt-1 text-[11.5px] text-slate">Effective 31 August 2026</p>
        <div className="mt-3 flex flex-col gap-4">
          <section><h2 className={h2}>Using PeasyPrints</h2><p className="mt-1">You must provide accurate information, protect your account, and use the service lawfully. Do not upload content you do not have permission to reproduce, malware, illegal material, or content that infringes another person’s rights.</p></section>
          <section><h2 className={h2}>Orders and payments</h2><p className="mt-1">Prices are calculated from the selected shop’s current pricing and confirmed before payment. An order is accepted only after payment is verified and the order record is created. Refunds, cancellations, print defects, and fulfilment issues are handled according to the shop’s displayed policy and applicable law.</p></section>
          <section><h2 className={h2}>Shops and campus listings</h2><p className="mt-1">Shops are responsible for accurate pricing, fulfilment, and payout details. Marketplace and housing users are responsible for their listings and communications. PeasyPrints may restrict content or accounts to protect users or comply with law.</p></section>
          <section><h2 className={h2}>Availability and liability</h2><p className="mt-1">We work to keep the service reliable, but maintenance, providers, or network failures can interrupt it. Nothing here excludes rights or liabilities that cannot legally be excluded.</p></section>
          <section><h2 className={h2}>Privacy and changes</h2><p className="mt-1">Our <Link href="/privacy" className={link}>privacy policy</Link> explains data use. Material terms changes will be presented through the service with an updated effective date.</p></section>
        </div>
      </main>
    </div>
  );
}
