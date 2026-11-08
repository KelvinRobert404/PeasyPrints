'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { swButton } from '@/components/swoop/primitives';
import { ChatIcon } from '@/components/marketplace/icons';
import { HandoffAnchor, useHandoff, whatsappNumberFromUrl } from '@/components/demo/DemoHandoffSheet';
import { cn } from '@/lib/utils/cn';
import type { CampusAudience, ContactRequest } from '@/types/campus';

/** Demo only: the poster's name from the post itself, since the request does not carry it. */
async function posterName(contentType: ContactRequest['contentType'], contentId: string, audience: CampusAudience): Promise<string> {
  const id = encodeURIComponent(contentId);
  const girls = audience === 'girls';
  const endpoint =
    contentType === 'housing'
      ? girls ? `/api/girls-space/housing/${id}` : `/api/housing/posts/${id}`
      : girls ? `/api/girls-space/marketplace/${id}` : `/api/marketplace/listings/${id}`;
  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    const data = (await response.json().catch(() => ({}))) as {
      item?: { seller?: { displayName?: string }; poster?: { displayName?: string } };
    };
    return data.item?.seller?.displayName || data.item?.poster?.displayName || 'the poster';
  } catch {
    return 'the poster';
  }
}

type Props = {
  contentType: ContactRequest['contentType'];
  contentId: string;
  audience?: CampusAudience;
  /** Shown on a disabled button instead, e.g. 'Reserved for someone'. Skips loading. */
  disabledLabel?: string;
  /** Skip the first load when the parent already has the buyer's request. */
  initialContact?: ContactRequest | null;
  onContactChange?: (contact: ContactRequest | null) => void;
  className?: string;
};

/**
 * 'Request WhatsApp access' for a listing. Uses /api/contact-requests; once the
 * poster approves, it turns into 'Continue on WhatsApp'.
 */
export function ContactButton({
  contentType,
  contentId,
  audience = 'campus',
  disabledLabel,
  initialContact,
  onContactChange,
  className,
}: Props) {
  const [contact, setContact] = useState<ContactRequest | null>(initialContact ?? null);
  const [loading, setLoading] = useState(initialContact === undefined && !disabledLabel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handoff = useHandoff();

  const update = (next: ContactRequest | null) => {
    setContact(next);
    onContactChange?.(next);
  };

  const load = async () => {
    try {
      const response = await fetch(`/api/contact-requests?role=buyer&audience=${audience}`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { items?: ContactRequest[] };
      update((data.items ?? []).find((entry) => entry.contentType === contentType && entry.contentId === contentId) ?? null);
    } catch {
      // Keep the request button; the POST reports real problems.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (disabledLabel || initialContact !== undefined) return;
    void load();
  }, [contentType, contentId, audience, disabledLabel]);

  const request = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contact-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, contentId }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not send the request');
      await load();
    } catch (cause) {
      setError((cause as Error).message || 'Could not send the request');
    } finally {
      setBusy(false);
    }
  };

  const full = cn(swButton({ variant: 'primary', size: 'lg' }), 'w-full');

  let body: ReactNode;
  if (disabledLabel) {
    body = (
      <button type="button" disabled className={cn(swButton({ variant: 'surface', size: 'lg' }), 'w-full text-text-secondary disabled:opacity-100')}>
        {disabledLabel}
      </button>
    );
  } else if (contact?.status === 'approved' && contact.whatsappUrl) {
    body = (
      <HandoffAnchor
        href={contact.whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className={full}
        onHandoff={() => {
          const number = whatsappNumberFromUrl(contact.whatsappUrl ?? '');
          void posterName(contentType, contentId, audience).then((name) => handoff.open('whatsapp', name, number));
        }}
      >
        <ChatIcon size={18} aria-hidden="true" />
        Continue on WhatsApp
      </HandoffAnchor>
    );
  } else {
    const pending = contact?.status === 'pending';
    const declined = contact?.status === 'declined';
    const waiting = pending || declined;
    const label = loading
      ? 'Checking…'
      : pending
        ? 'Request sent, waiting'
        : declined
          ? 'Request declined'
          : busy
            ? 'Sending request…'
            : 'Request WhatsApp access';
    body = (
      <button
        type="button"
        disabled={loading || busy || pending}
        onClick={() => void request()}
        className={cn(
          swButton({ variant: waiting || loading ? 'surface' : 'primary', size: 'lg' }),
          'w-full',
          (waiting || loading) && 'text-text-secondary disabled:opacity-100',
        )}
      >
        {!waiting && !loading ? <ChatIcon size={18} aria-hidden="true" /> : null}
        {label}
      </button>
    );
  }

  return (
    <div className={cn('min-w-0', className)}>
      {body}
      {error ? (
        <p role="alert" className="mt-1.5 rounded-[12px] bg-market-tint px-3 py-2 text-[11.5px] font-bold text-market">
          {error}
        </p>
      ) : null}
      <p className="mt-1.5 text-center text-[10.5px] font-semibold text-slate">
        {disabledLabel ? 'You can ask once it frees up.' : 'The poster decides to share their number.'}
      </p>
    </div>
  );
}
