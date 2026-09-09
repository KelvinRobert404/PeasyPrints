'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ANALYTICS_CONSENT_KEY } from '@/components/privacy/AnalyticsConsent';

export default function PrivacySettingsPage() {
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const resetAnalytics = () => {
    localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    window.location.reload();
  };

  const requestDeletion = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/users/me/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not request deletion');
      setMessage('Your request is queued. We will remove or anonymize account data after retaining records required for payments, fraud prevention, and law.');
      setConfirmation('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not request deletion');
    } finally {
      setLoading(false);
    }
  };

  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
    <Link href="/profile" className="text-sm font-semibold text-blue-700">← Profile</Link>
    <h1 className="mt-5 text-3xl font-bold">Privacy settings</h1>
    <section className="mt-8 rounded-2xl border p-5">
      <h2 className="font-bold">Optional analytics</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">Clear your choice to show the consent prompt again. Analytics remain off unless you choose to allow them.</p>
      <button onClick={resetAnalytics} className="mt-4 min-h-11 rounded-xl border px-4 text-sm font-bold">Review analytics choice</button>
    </section>
    <section className="mt-5 rounded-2xl border border-red-200 p-5">
      <h2 className="font-bold text-red-800">Delete account</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">This starts a verified deletion request. Type <strong>DELETE MY ACCOUNT</strong>. Active orders must still be completed, and legally required transaction records may be anonymized and retained.</p>
      <label htmlFor="delete-confirmation" className="mt-4 block text-sm font-semibold">Confirmation</label>
      <input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3" autoComplete="off" />
      <button onClick={requestDeletion} disabled={loading || confirmation !== 'DELETE MY ACCOUNT'} className="mt-3 min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-40">{loading ? 'Requesting…' : 'Request deletion'}</button>
      {message ? <p role="status" className="mt-3 text-sm leading-6">{message}</p> : null}
    </section>
    <p className="mt-6 text-sm text-zinc-600"><Link href="/privacy" className="underline">Privacy policy</Link> · <Link href="/terms" className="underline">Terms</Link></p>
  </main>;
}
