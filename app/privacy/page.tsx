import Link from 'next/link';
import { PageHeader } from '@/components/swoop/primitives';

const h2 = 'font-heading text-[14.5px] leading-[1.15] text-ink';
const link = 'font-semibold text-royal underline underline-offset-2';

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <PageHeader title="Privacy policy" backHref="/" />
      <main className="px-3 pb-3 text-[13px] leading-[1.55] text-text-secondary">
        <p className="pt-1 text-[11.5px] text-slate">Effective 31 August 2026</p>
        <div className="mt-3 flex flex-col gap-4">
          <section><h2 className={h2}>What we collect</h2><p className="mt-1">We process account and campus identity details, shop information, order and payment references, uploaded print documents, support messages, and security logs needed to provide and protect the service. Card or bank credentials are handled by the payment provider; PeasyPrints stores provider references and transaction status.</p></section>
          <section><h2 className={h2}>How we use it</h2><p className="mt-1">We use data to authenticate users, route and print orders, settle shops, prevent abuse, support users, and meet accounting obligations. Optional product analytics remain disabled until you consent and can be changed from <Link href="/settings/privacy" className={link}>privacy settings</Link>.</p></section>
          <section><h2 className={h2}>Storage and retention</h2><p className="mt-1">Print files are private and scheduled for deletion seven days after an order is completed or cancelled. One-time print tickets and rate-limit records expire automatically. Verification images are removed when verification expires. Transaction records may be retained or anonymized for accounting, dispute, fraud-prevention, and legal requirements.</p></section>
          <section><h2 className={h2}>Sharing and security</h2><p className="mt-1">Data is shared only with service providers needed for hosting, identity, payments, analytics you consent to, and printing fulfillment. Access is role-based, sensitive files use short-lived links, and payment events are signature-verified. No internet service is risk-free; report suspected misuse through the support page.</p></section>
          <section><h2 className={h2}>Your choices</h2><p className="mt-1">You can review analytics consent and request account deletion in <Link href="/settings/privacy" className={link}>privacy settings</Link>. Active orders and records we must retain are handled before deletion is completed.</p></section>
        </div>
      </main>
    </div>
  );
}
