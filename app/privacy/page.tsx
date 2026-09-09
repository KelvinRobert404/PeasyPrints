import Link from 'next/link';

export default function PrivacyPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-zinc-800">
    <Link href="/" className="text-sm font-semibold text-blue-700">← PeasyPrints</Link>
    <h1 className="mt-5 text-3xl font-bold text-zinc-950">Privacy policy</h1>
    <p className="mt-2 text-sm text-zinc-500">Effective 31 August 2026</p>
    <div className="mt-8 space-y-7 text-sm leading-7">
      <section><h2 className="text-lg font-bold text-zinc-950">What we collect</h2><p>We process account and campus identity details, shop information, order and payment references, uploaded print documents, support messages, and security logs needed to provide and protect the service. Card or bank credentials are handled by the payment provider; PeasyPrints stores provider references and transaction status.</p></section>
      <section><h2 className="text-lg font-bold text-zinc-950">How we use it</h2><p>We use data to authenticate users, route and print orders, settle shops, prevent abuse, support users, and meet accounting obligations. Optional product analytics remain disabled until you consent and can be changed from <Link href="/settings/privacy" className="underline">privacy settings</Link>.</p></section>
      <section><h2 className="text-lg font-bold text-zinc-950">Storage and retention</h2><p>Print files are private and scheduled for deletion seven days after an order is completed or cancelled. One-time print tickets and rate-limit records expire automatically. Verification images are removed when verification expires. Transaction records may be retained or anonymized for accounting, dispute, fraud-prevention, and legal requirements.</p></section>
      <section><h2 className="text-lg font-bold text-zinc-950">Sharing and security</h2><p>Data is shared only with service providers needed for hosting, identity, payments, analytics you consent to, and printing fulfillment. Access is role-based, sensitive files use short-lived links, and payment events are signature-verified. No internet service is risk-free; report suspected misuse through the support page.</p></section>
      <section><h2 className="text-lg font-bold text-zinc-950">Your choices</h2><p>You can review analytics consent and request account deletion in <Link href="/settings/privacy" className="underline">privacy settings</Link>. Active orders and records we must retain are handled before deletion is completed.</p></section>
    </div>
  </main>;
}
