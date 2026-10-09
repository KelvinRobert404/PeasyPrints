'use client';

import { useState } from 'react';
import { ANALYTICS_CONSENT_KEY } from '@/components/privacy/AnalyticsConsent';
import { Card, IconTile, ListRow, PageHeader, SectionHeader, swButton } from '@/components/swoop/primitives';
import { DocIcon, TrashIcon } from '@/components/swoop/icons';
import { ChartIcon } from '@/components/auth/icons';
import { cn } from '@/lib/utils/cn';

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

  return (
    <div className="flex flex-1 flex-col bg-white">
      <PageHeader title="Privacy settings" kicker="Account" backHref="/profile" />

      <main className="flex flex-col px-3 pb-3">
        <section className="pt-3">
          <SectionHeader title="Optional analytics" />
          <Card className="mt-2 px-3">
            <ListRow
              onClick={resetAnalytics}
              leading={<IconTile icon={ChartIcon} />}
              title="Review analytics choice"
              subtitle="Show the consent prompt again"
              divider={false}
            />
          </Card>
          <p className="mt-1.5 px-0.5 text-[11.5px] leading-[1.45] text-slate">
            Analytics remain off unless you choose to allow them.
          </p>
        </section>

        <section className="pt-3.5">
          <SectionHeader title="Delete account" />
          <Card className="mt-2 p-3">
            <div className="flex gap-2.5">
              <IconTile icon={TrashIcon} tone="market" />
              <p className="text-[12px] leading-[1.5] text-text-secondary">
                This starts a verified deletion request. Type <strong className="font-bold text-ink">DELETE MY ACCOUNT</strong>. Active orders must still be
                completed, and legally required transaction records may be anonymized and retained.
              </p>
            </div>
            <label htmlFor="delete-confirmation" className="mt-3 block text-[11.5px] font-bold text-ink">
              Confirmation
            </label>
            <input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="campus-input mt-1.5"
              placeholder="DELETE MY ACCOUNT"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={requestDeletion}
              disabled={loading || confirmation !== 'DELETE MY ACCOUNT'}
              className={cn(swButton({ variant: 'danger', size: 'md' }), 'mt-2.5 w-full')}
            >
              {loading ? 'Requesting…' : 'Request deletion'}
            </button>
            {message ? (
              <p role="status" className="mt-2.5 text-[11.5px] leading-[1.45] text-ink">
                {message}
              </p>
            ) : null}
          </Card>
        </section>

        <section className="pt-3.5">
          <SectionHeader title="Legal" />
          <Card className="mt-2 px-3">
            <ListRow href="/privacy" leading={<IconTile icon={DocIcon} />} title="Privacy policy" />
            <ListRow href="/terms" leading={<IconTile icon={DocIcon} />} title="Terms of service" divider={false} />
          </Card>
        </section>
      </main>
    </div>
  );
}
