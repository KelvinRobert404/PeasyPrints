'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  BookmarkIcon,
  ClockIcon,
  CloseIcon,
  HousingIcon,
  MarketIcon,
  PinIcon,
  RupeeIcon,
  SearchIcon,
  ShareIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserIcon,
  type IconProps,
} from '@/components/swoop/icons';
import { EmptyState, IconButton, IconTile, ListRow, PageHeader, SectionHeader, StatusLine, swButton, Tag } from '@/components/swoop/primitives';
import { ChatIcon, FlagIcon } from '@/components/marketplace/icons';
import { cn } from '@/lib/utils/cn';
import { CampusGate } from './CampusGate';
import type { CampusAudience, CampusContentStatus, ContactRequest, HousingPost, MarketplaceListing } from '@/types/campus';
import { MARKETPLACE_CATEGORY_LABELS } from '@/lib/campus/constants';

type Props = { id: string; type: 'marketplace' | 'housing'; audience?: CampusAudience };

const STATUS_LABELS: Record<CampusContentStatus, string> = {
  active: 'Available',
  needs_confirmation: 'Awaiting confirmation',
  sold: 'Sold',
  filled: 'Filled',
  closed: 'Closed',
  removed: 'Removed',
};

const SavedIcon = (p: IconProps) => <BookmarkIcon filled {...p} />;

export function ContentDetail({ id, type, audience = 'campus' }: Props) {
  const [item, setItem] = useState<MarketplaceListing | HousingPost | null>(null);
  const [contact, setContact] = useState<ContactRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const endpoint = audience === 'girls'
    ? `/api/girls-space/${type}/${id}`
    : type === 'marketplace' ? `/api/marketplace/listings/${id}` : `/api/housing/posts/${id}`;
  const base = audience === 'girls' ? `/girls-space/${type}` : `/${type}`;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [response, requests] = await Promise.all([fetch(endpoint, { cache: 'no-store' }), fetch(`/api/contact-requests?role=buyer&audience=${audience}`, { cache: 'no-store' })]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Post not found');
      setItem(data.item);
      if (requests.ok) {
        const requestData = await requests.json();
        setContact((requestData.items || []).find((entry: ContactRequest) => entry.contentType === type && entry.contentId === id) || null);
      }
    } catch (cause: any) { setError(cause.message || 'Post not found'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id]);
  useEffect(() => {
    if (!reportOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setReportOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [reportOpen]);

  const requestContact = async () => {
    setBusy(true); setError('');
    const response = await fetch('/api/contact-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: type, contentId: id }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Could not request contact'); else await load();
    setBusy(false);
  };

  const action = async (actionName: string) => {
    setBusy(true);
    const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName }) });
    if (response.ok) await load(); else setError((await response.json()).error || 'Could not update post');
    setBusy(false);
  };

  const save = async () => {
    if (!item) return;
    setItem({ ...item, isSaved: !item.isSaved });
    await fetch('/api/campus/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: item.isSaved ? 'unsave' : 'save', contentType: type, contentId: id }) });
  };

  const report = async () => {
    if (reportReason.trim().length < 3) return;
    setBusy(true);
    const response = await fetch('/api/campus/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'report', contentType: type, contentId: id, reason: reportReason }) });
    if (!response.ok) setError((await response.json()).error || 'Could not send report');
    else { setReportOpen(false); setReportReason(''); setNotice('Report sent to the campus team.'); }
    setBusy(false);
  };

  const share = async () => {
    if (!item) return;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setNotice('Link copied.'); }
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') setError('Could not share this post');
    }
  };

  const posterName = item ? (type === 'marketplace' ? (item as MarketplaceListing).seller.displayName : (item as HousingPost).poster.displayName) : '';
  const closed = item ? item.status === 'sold' || item.status === 'closed' || item.status === 'filled' : false;
  const contactWaiting = contact?.status === 'pending' || contact?.status === 'declined';

  return (
    <CampusGate girlsOnly={audience === 'girls'}>
      <div className="min-h-screen bg-white pb-3">
        <PageHeader
          title={type === 'marketplace' ? 'Campus find' : 'Housing post'}
          kicker={audience === 'girls' ? 'Girls’ space' : `${item?.collegeCode || 'KJU'} verified`}
          backHref={base}
          actions={item ? (
            <>
              <IconButton label="Share post" icon={ShareIcon} onClick={() => void share()} />
              <IconButton
                label={item.isSaved ? 'Remove from saved' : 'Save post'}
                icon={item.isSaved ? SavedIcon : BookmarkIcon}
                onClick={() => void save()}
                className={item.isSaved ? 'text-royal' : undefined}
              />
            </>
          ) : undefined}
        />

        {loading && !item ? (
          <div className="mx-auto max-w-xl space-y-2 px-3 pt-1" aria-hidden="true">
            <div className="aspect-[4/3] animate-pulse rounded-[14px] bg-surface" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface" />
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-surface" />
            <div className="h-24 animate-pulse rounded-[14px] bg-surface" />
          </div>
        ) : null}

        {error && !item ? (
          <div className="mx-auto max-w-md px-3 pt-3">
            <EmptyState
              icon={SearchIcon}
              title="This post stepped off campus"
              body={error}
              action={<Link href={base} className={cn(swButton({ variant: 'primary', size: 'sm' }), 'mt-1')}>Browse active posts</Link>}
            />
          </div>
        ) : null}

        {item ? (
          <main className="mx-auto max-w-xl px-3 pt-1">
            <Gallery images={item.images} title={item.title} fallback={type === 'housing' ? HousingIcon : MarketIcon} />

            <section className="pt-3">
              <div className="flex items-center gap-1.5">
                <Tag>{item.postType}</Tag>
                <span className="ml-auto font-mono text-[10px] font-semibold text-slate">{item.serial}</span>
              </div>
              <h2 className="font-heading mt-1.5 text-[16px] leading-[1.1] text-ink">{item.title}</h2>
              <p className={cn('font-heading mt-1 text-[15px] tabular-nums', closed ? 'text-slate line-through' : 'text-ink')}>
                {type === 'marketplace' ? marketPrice(item as MarketplaceListing) : housingPrice(item as HousingPost)}
              </p>
              <div className="mt-1.5">
                <StatusLine open={item.status === 'active'} label={STATUS_LABELS[item.status] ?? item.status} />
              </div>
              <p className="mt-2.5 whitespace-pre-wrap text-[12.5px] leading-[1.5] text-text-secondary">{item.description}</p>
            </section>

            <section className="pt-3.5">
              <SectionHeader title="Campus context" />
              <div className="mt-1">
                {type === 'marketplace' ? <MarketplaceMeta item={item as MarketplaceListing} /> : <HousingMeta item={item as HousingPost} />}
                <ListRow
                  leading={<span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[12px] font-extrabold text-white" aria-hidden="true">{posterName[0]}</span>}
                  title={posterName}
                  subtitle={`Verified ${item.collegeCode} student`}
                  trailing={<ShieldCheckIcon size={16} className="shrink-0 text-royal" />}
                  divider={false}
                />
              </div>
            </section>

            {item.isOwner ? (
              <section className="mt-3 rounded-[14px] bg-surface p-3">
                <p className="font-heading text-[14.5px] leading-[1.1] text-ink">Your post</p>
                <p className="mt-0.5 text-[11.5px] text-text-secondary">Confirm every week to keep the post visible.</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => action('confirm')} className={swButton({ variant: 'primary' })}>Still available</button>
                  <button type="button" disabled={busy} onClick={() => action(type === 'marketplace' ? 'sold' : 'filled')} className={swButton({ variant: 'white' })}>
                    {type === 'marketplace' ? 'Mark sold' : 'Mark filled'}
                  </button>
                </div>
              </section>
            ) : (
              <section className="mt-3">
                {contact?.status === 'approved' && contact.whatsappUrl ? (
                  <a href={contact.whatsappUrl} target="_blank" rel="noreferrer" className={cn(swButton({ variant: 'primary', size: 'lg' }), 'w-full')}>
                    <ChatIcon size={18} />
                    Continue on WhatsApp
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={busy || contact?.status === 'pending'}
                    onClick={requestContact}
                    className={cn(swButton({ variant: contactWaiting ? 'surface' : 'primary', size: 'lg' }), 'w-full', contactWaiting && 'text-text-secondary disabled:opacity-100')}
                  >
                    {contact?.status === 'pending' ? 'Contact request pending' : contact?.status === 'declined' ? 'Contact request declined' : busy ? 'Sending request…' : 'Request WhatsApp access'}
                  </button>
                )}
                <p className="mt-1.5 text-center text-[10.5px] font-semibold text-slate">The poster decides whether to share contact access.</p>
              </section>
            )}

            {error ? <div className="mt-2.5 rounded-[12px] bg-market-tint px-3 py-2.5 text-[11.5px] font-bold text-market" role="alert">{error}</div> : null}
            {notice ? <div className="mt-2.5 rounded-[12px] bg-go-tint px-3 py-2.5 text-[11.5px] font-bold text-go-text" role="status">{notice}</div> : null}

            <button type="button" onClick={() => setReportOpen(true)} className="campus-press mx-auto mt-3 flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-market">
              <FlagIcon size={14} />
              Report this post
            </button>
          </main>
        ) : null}

        {reportOpen ? (
          <div
            className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
            onMouseDown={(event) => { if (event.currentTarget === event.target) setReportOpen(false); }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="report-title" className="mx-auto w-full max-w-md rounded-[14px] bg-white p-4 shadow-[0_8px_30px_rgba(16,24,40,0.18)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10.5px] font-semibold text-market">Safety report</p>
                  <h2 id="report-title" className="font-heading text-[16px] leading-[1.1] text-ink">What should we review?</h2>
                </div>
                <IconButton label="Close report" icon={CloseIcon} onClick={() => setReportOpen(false)} />
              </div>
              <label className="mt-3 block text-[11.5px] font-bold text-ink">
                Reason
                <textarea
                  autoFocus
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  maxLength={400}
                  className="campus-input mt-1.5 min-h-28 resize-none"
                  placeholder="Describe the issue without including private information."
                />
              </label>
              <button
                type="button"
                disabled={busy || reportReason.trim().length < 3}
                onClick={() => report()}
                className={cn(swButton({ variant: 'danger' }), 'mt-3 w-full')}
              >
                {busy ? 'Sending…' : 'Send confidential report'}
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </CampusGate>
  );
}

function Gallery({ images, title, fallback: Fallback }: { images: string[]; title: string; fallback: ComponentType<IconProps> }) {
  if (!images.length) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-[14px] bg-surface">
        <Fallback size={44} className="text-text-muted" />
      </div>
    );
  }
  if (images.length === 1) {
    return <img src={images[0]} alt={title} className="aspect-[4/3] w-full rounded-[14px] bg-surface object-cover" />;
  }
  return (
    <div role="group" aria-label={`${images.length} photos`} tabIndex={0} className="-mx-3 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-3 no-scrollbar">
      {images.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={src}
          alt={index === 0 ? title : `${title}, photo ${index + 1}`}
          className="aspect-[4/3] w-[88%] shrink-0 snap-center rounded-[14px] bg-surface object-cover"
        />
      ))}
    </div>
  );
}

function MetaRow({ icon, title, label }: { icon: ComponentType<IconProps>; title: string; label: string }) {
  return <ListRow leading={<IconTile icon={icon} />} title={title} subtitle={label} />;
}

function marketPrice(item: MarketplaceListing) { return item.postType === 'free' ? 'Free' : item.price == null ? 'Ask for price' : `₹${item.price.toLocaleString('en-IN')}`; }
function housingPrice(item: HousingPost) { return item.rent == null ? 'Budget flexible' : `₹${item.rent.toLocaleString('en-IN')} / month`; }
function MarketplaceMeta({ item }: { item: MarketplaceListing }) {
  return (
    <>
      <MetaRow icon={MarketIcon} title={MARKETPLACE_CATEGORY_LABELS[item.category]} label="Category" />
      <MetaRow icon={PinIcon} title={item.pickupLabel || item.area || item.collegeCode} label="Pickup" />
      {item.condition ? <MetaRow icon={SparklesIcon} title={item.condition} label="Condition" /> : null}
      {item.negotiable ? <MetaRow icon={RupeeIcon} title="Negotiable" label="Price" /> : null}
    </>
  );
}
function HousingMeta({ item }: { item: HousingPost }) {
  return (
    <>
      <MetaRow icon={PinIcon} title={item.area} label="Area" />
      <MetaRow icon={ClockIcon} title={item.commuteLabel || `Near ${item.collegeCode}`} label="Commute" />
      {item.furnishing ? <MetaRow icon={HousingIcon} title={item.furnishing} label="Furnishing" /> : null}
      {item.occupancy ? <MetaRow icon={UserIcon} title={item.occupancy} label="Occupancy" /> : null}
    </>
  );
}
