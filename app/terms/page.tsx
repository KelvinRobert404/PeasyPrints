import Link from 'next/link';

export default function TermsPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-zinc-800">
    <Link href="/" className="text-sm font-semibold text-blue-700">← PeasyPrints</Link>
    <h1 className="mt-5 text-3xl font-bold text-zinc-950">Terms of service</h1>
    <p className="mt-2 text-sm text-zinc-500">Effective 31 August 2026</p>
    <div className="mt-8 space-y-7 text-sm leading-7">
      <section><h2 className="text-lg font-bold text-zinc-950">Using PeasyPrints</h2><p>You must provide accurate information, protect your account, and use the service lawfully. Do not upload content you do not have permission to reproduce, malware, illegal material, or content that infringes another person’s rights.</p></section>
      <section><h2 className="text-lg font-bold text-zinc-950">Orders and payments</h2><p>Prices are calculated from the selected shop’s current pricing and confirmed before payment. An order is accepted only after payment is verified and the order record is created. Refunds, cancellations, print defects, and fulfilment issues are handled according to the shop’s displayed policy and applicable law.</p></section>
      <section><h2 className="text-lg font-bold text-zinc-950">Shops and campus listings</h2><p>Shops are responsible for accurate pricing, fulfilment, and payout details. Marketplace and housing users are responsible for their listings and communications. PeasyPrints may restrict content or accounts to protect users or comply with law.</p></section>
      <section><h2 className="text-lg font-bold text-zinc-950">Availability and liability</h2><p>We work to keep the service reliable, but maintenance, providers, or network failures can interrupt it. Nothing here excludes rights or liabilities that cannot legally be excluded.</p></section>
      <section><h2 className="text-lg font-bold text-zinc-950">Privacy and changes</h2><p>Our <Link href="/privacy" className="underline">privacy policy</Link> explains data use. Material terms changes will be presented through the service with an updated effective date.</p></section>
    </div>
  </main>;
}
