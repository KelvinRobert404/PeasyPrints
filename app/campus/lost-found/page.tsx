'use client';

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { CampusGate } from '@/components/campus/CampusGate';
import { PhotoField } from '@/components/campus/fields/PhotoField';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { LandmarkPicker, type LandmarkPick } from '@/components/campus/places/LandmarkPicker';
import { CheckIcon, CloseIcon, IdCardIcon, LockIcon, LostFoundIcon, PinIcon, PlusIcon } from '@/components/swoop/icons';
import { LostFoundArt } from '@/components/swoop/illustrations';
import { EmptyState, IconButton, IconTile, PageHeader, Segmented, Tag, swButton } from '@/components/swoop/primitives';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { LOST_FOUND_CATEGORY_LABELS, TRUST_LINE } from '@/lib/campus/constants';
import {
  CONTACT_KINDS,
  CONTACT_KIND_LABELS,
  LOST_FOUND_CATEGORIES,
  MAX_PHOTOS,
  claimQuestion,
  contactHref,
  isSensitiveCategory,
  type LostFoundContact,
  type LostFoundContactKind,
  type LostFoundView,
} from '@/lib/campus/lostFound';
import type { LatLng } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';
import type { Landmark } from '@/types/college';
import type { LostFoundCategory, LostFoundKind } from '@/types/utilities';

const API = '/api/campus/lost-found';

const KIND_OPTIONS: { value: LostFoundKind; label: string }[] = [
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
];

const CHIP =
  'campus-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/40';

const CONTACT_PLACEHOLDERS: Record<LostFoundContactKind, string> = {
  whatsapp: '10-digit number',
  phone: '10-digit number',
  email: 'you@college.edu',
  instagram: '@handle',
};

type CampusConfig = { origin: LatLng; landmarks: Landmark[]; code: string };

async function readError(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

/** '5 min ago', '3 h ago', '2 days ago'. */
function ago(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function contactText(contact: LostFoundContact): string {
  return contact.kind === 'instagram' ? `@${contact.value}` : contact.value;
}

export default function LostFoundPage() {
  return (
    <CampusGate>
      <LostFoundScreen />
    </CampusGate>
  );
}

function LostFoundScreen() {
  const campus = useCurrentCampus();
  const [items, setItems] = useState<LostFoundView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<LostFoundKind>('found');
  const [reporting, setReporting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readError(response, 'Could not load posts'));
      const data = (await response.json()) as { items?: LostFoundView[] };
      setItems(data.items ?? []);
    } catch (cause) {
      setError((cause as Error).message || 'Could not load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Swaps in the server's copy; closed posts leave the list. */
  const replace = (item: LostFoundView) => {
    setItems((current) =>
      item.status === 'open'
        ? current.some((entry) => entry.id === item.id)
          ? current.map((entry) => (entry.id === item.id ? item : entry))
          : [item, ...current]
        : current.filter((entry) => entry.id !== item.id),
    );
  };

  const shown = items.filter((item) => item.kind === tab);
  const active = items.find((item) => item.id === activeId) ?? null;
  const code = campus?.code ?? 'campus';

  return (
    <div className="pb-3">
      <PageHeader
        title="Lost and found"
        kicker={campus?.label ?? 'Your campus'}
        actions={<IconButton label="Report an item" icon={PlusIcon} onClick={() => setReporting(true)} />}
      />
      <main className="space-y-3 px-3 pt-2">
        <section className="flex items-center gap-3 overflow-hidden rounded-[14px] bg-surface px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Tag tone="white">{TRUST_LINE}</Tag>
            <h2 className="font-heading mt-1 text-[15px] leading-[1.1] text-ink">Hey, lost something?</h2>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-slate">ID details stay hidden from everyone.</p>
            <button type="button" onClick={() => setReporting(true)} className={cn(swButton({ size: 'sm' }), 'mt-2')}>
              <PlusIcon size={13} aria-hidden="true" />
              Report an item
            </button>
          </div>
          <LostFoundArt width={92} height={84} className="shrink-0" />
        </section>

        <Segmented label="Lost or found" value={tab} onChange={setTab} options={KIND_OPTIONS} />

        {notice ? (
          <p role="status" className="rounded-[12px] bg-go-tint px-3 py-2 text-[11.5px] font-bold text-go-text">
            {notice}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-1.5" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-[12px] bg-surface" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={LostFoundIcon}
            title="Could not load posts"
            body={error}
            action={
              <button type="button" onClick={() => void load()} className={swButton({ variant: 'white', size: 'sm' })}>
                Try again
              </button>
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={LostFoundIcon}
            title={tab === 'found' ? 'Nothing found yet' : 'Nothing lost right now'}
            body={tab === 'found' ? 'Found something? Post it here.' : 'Lost something? Post it here.'}
          />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} campusCode={code} onOpen={() => setActiveId(item.id)} />
              </li>
            ))}
          </ul>
        )}
      </main>

      {reporting ? (
        <ReportItemSheet
          defaultKind={tab}
          campusCode={code}
          onClose={() => setReporting(false)}
          onCreated={(item) => {
            replace(item);
            setTab(item.kind);
            setReporting(false);
            setNotice('Posted. We will tell you about asks.');
          }}
        />
      ) : null}

      {active ? (
        <ItemSheet
          item={active}
          campusCode={code}
          onClose={() => setActiveId(null)}
          onChange={(item) => {
            replace(item);
            if (item.status !== 'open') {
              setActiveId(null);
              setNotice(item.status === 'returned' ? 'Marked returned. Nice work.' : 'Post closed.');
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ItemRow({ item, campusCode, onOpen }: { item: LostFoundView; campusCode: string; onOpen: () => void }) {
  const icon = isSensitiveCategory(item.category) ? IdCardIcon : LostFoundIcon;
  let trailing: ReactNode;
  if (item.isOwner) trailing = <Tag tone="go">Your post</Tag>;
  else if (item.myClaim?.status === 'approved') trailing = <Tag tone="go">Approved</Tag>;
  else if (item.myClaim) trailing = <Tag tone="royal">Asked</Tag>;
  else trailing = <span className="whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">{item.kind === 'found' ? 'Ask' : 'I found it'}</span>;

  return (
    <button type="button" onClick={onOpen} className="campus-press flex w-full items-center gap-2.5 py-2 text-left">
      <IconTile icon={icon} tone={item.kind === 'found' ? 'royal' : 'surface'} shape="square" size={40} />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[12.5px] font-bold text-ink">{item.title}</span>
        <span className="truncate text-[11px] text-slate">
          {LOST_FOUND_CATEGORY_LABELS[item.category]} · {ago(item.happenedAt ?? item.createdAt)}
          {item.redacted ? ' · Details hidden' : ''}
        </span>
        <DistanceLine meters={item.place?.roughDistanceM} campusLabel={campusCode} icon={false} className="text-[11px]" />
      </span>
      <span className="shrink-0">{trailing}</span>
    </button>
  );
}

/* Sheets ------------------------------------------------------------------ */

function Sheet({ title, kicker, onClose, children }: { title: string; kicker?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-2 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto max-h-[88vh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-[14px] bg-white p-3.5 shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {kicker ? <p className="truncate text-[10.5px] font-semibold text-slate">{kicker}</p> : null}
            <h2 id={titleId} className="font-heading text-[16px] leading-[1.1] text-ink">
              {title}
            </h2>
          </div>
          <IconButton label="Close" icon={CloseIcon} onClick={onClose} />
        </div>
        <div className="mt-3">{children}</div>
      </section>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 rounded-[12px] bg-market-tint px-3 py-2 text-[11.5px] font-bold text-market">
      {message}
    </p>
  );
}

/** One post: claim it, see the revealed contact, or (poster) manage asks. */
function ItemSheet({
  item,
  campusCode,
  onClose,
  onChange,
}: {
  item: LostFoundView;
  campusCode: string;
  onClose: () => void;
  onChange: (item: LostFoundView) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const patch = async (body: Record<string, unknown>, key: string) => {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      const response = await fetch(`${API}/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not update'));
      const data = (await response.json()) as { item: LostFoundView };
      onChange(data.item);
      if (body.action === 'claim') setAnswer('');
    } catch (cause) {
      setError((cause as Error).message || 'Could not update');
    } finally {
      setBusy('');
    }
  };

  const sheetTitle = item.isOwner ? 'Your post' : item.kind === 'found' ? 'Is it yours? Ask' : 'Found it? Tell them';

  return (
    <Sheet title={sheetTitle} kicker={`${item.kind === 'found' ? 'Found' : 'Lost'} · ${ago(item.happenedAt ?? item.createdAt)}`} onClose={onClose}>
      <div className="flex items-start gap-2.5">
        <IconTile icon={isSensitiveCategory(item.category) ? IdCardIcon : LostFoundIcon} tone="royal" shape="square" size={40} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13px] font-bold text-ink">{item.title}</p>
          <p className="text-[11px] text-slate">Posted by {item.poster.displayName}</p>
        </div>
      </div>

      {item.description ? <p className="mt-2 break-words text-[12px] leading-[1.45] text-ink">{item.description}</p> : null}

      <div className="mt-2 space-y-1">
        {item.place ? (
          <p className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-ink">
            <PinIcon size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{item.place.label}</span>
          </p>
        ) : null}
        <DistanceLine meters={item.place?.roughDistanceM} campusLabel={campusCode} />
        {item.keptAt ? <p className="text-[11.5px] font-semibold text-slate">Kept at: {item.keptAt}</p> : null}
      </div>

      {item.redacted ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-[12px] bg-surface px-3 py-2 text-[11px] font-semibold text-slate">
          <LockIcon size={13} className="shrink-0" aria-hidden="true" />
          {item.photoCount > 0 ? 'Photos and ID details stay with the poster.' : 'ID details stay with the poster.'}
        </p>
      ) : null}

      {item.isOwner ? (
        <OwnerPanel item={item} busy={busy} onPatch={patch} />
      ) : item.myClaim?.status === 'approved' ? (
        <div className="mt-3 rounded-[12px] bg-go-tint p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-go-text">
            <CheckIcon size={13} aria-hidden="true" />
            The poster approved you
          </p>
          {item.contact ? (
            <a
              href={contactHref(item.contact)}
              target={item.contact.kind === 'phone' || item.contact.kind === 'email' ? undefined : '_blank'}
              rel="noreferrer"
              className={cn(swButton({ size: 'sm' }), 'mt-2 w-full')}
            >
              {CONTACT_KIND_LABELS[item.contact.kind]}: {contactText(item.contact)}
            </a>
          ) : (
            <p className="mt-1 text-[11.5px] text-go-text">{item.keptAt ? `Collect it at ${item.keptAt}.` : 'Look out for their message.'}</p>
          )}
        </div>
      ) : item.myClaim ? (
        <p role="status" className="mt-3 rounded-[12px] bg-royal-tint px-3 py-2 text-[11.5px] font-bold text-royal">
          Sent. The poster will check your answer.
        </p>
      ) : (
        <div className="mt-3">
          <label className="block text-[11.5px] font-bold text-ink">
            {item.claimQuestion}
            <input
              type="text"
              value={answer}
              maxLength={200}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={item.kind === 'found' ? 'Your answer' : 'Where and when'}
              className="campus-input mt-1"
            />
          </label>
          <p className="mt-1 text-[10.5px] font-semibold text-slate">Only the poster sees your answer.</p>
          <button
            type="button"
            disabled={!answer.trim() || Boolean(busy)}
            onClick={() => void patch({ action: 'claim', answer: answer.trim() }, 'claim')}
            className={cn(swButton(), 'mt-2 w-full')}
          >
            {busy === 'claim' ? 'Sending…' : 'Send ask'}
          </button>
        </div>
      )}

      <ErrorLine message={error} />
    </Sheet>
  );
}

function OwnerPanel({
  item,
  busy,
  onPatch,
}: {
  item: LostFoundView;
  busy: string;
  onPatch: (body: Record<string, unknown>, key: string) => Promise<void>;
}) {
  const claims = item.claims ?? [];
  return (
    <div className="mt-3 space-y-3">
      {item.images.length ? (
        <div>
          <p className="text-[11.5px] font-bold text-ink">Your photos, only you see them</p>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {item.images.map((url, index) => (
              <img key={url} src={url} alt={`Photo ${index + 1}`} className="aspect-square w-full rounded-[10px] bg-surface object-cover" />
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[12px] bg-surface p-2.5 text-[11.5px]">
        <p className="font-bold text-ink">{item.claimQuestion}</p>
        <p className="mt-0.5 text-slate">{item.claimAnswer ? `Your answer: ${item.claimAnswer}` : 'No private answer set.'}</p>
        {item.contact ? (
          <p className="mt-0.5 text-slate">
            Approved students see {CONTACT_KIND_LABELS[item.contact.kind]}: {contactText(item.contact)}
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-[11.5px] font-bold text-ink">Asks ({claims.length})</p>
        {claims.length === 0 ? (
          <p className="mt-1 text-[11.5px] text-slate">No asks yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {claims.map((claim) => (
              <li key={claim.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1 text-[12px] font-bold text-ink">
                    <span className="truncate">{claim.claimantName}</span>
                    {claim.matches === true ? <Tag tone="go">Answer matches</Tag> : null}
                    {claim.matches === false ? <Tag className="bg-market-tint text-market">Answer differs</Tag> : null}
                  </p>
                  <p className="break-words text-[11.5px] text-slate">{claim.answer}</p>
                </div>
                {claim.status === 'approved' ? (
                  <Tag tone="go">Approved</Tag>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void onPatch({ action: 'approve_claim', claimId: claim.id }, `approve-${claim.id}`)}
                    className={swButton({ size: 'sm' })}
                  >
                    {busy === `approve-${claim.id}` ? 'Approving…' : 'Approve'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[10.5px] font-semibold text-slate">Approving shares your contact with them only.</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void onPatch({ action: 'returned' }, 'returned')}
          className={swButton({ variant: 'ink', size: 'sm' })}
        >
          {busy === 'returned' ? 'Saving…' : 'Mark returned'}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void onPatch({ action: 'close' }, 'close')}
          className={swButton({ variant: 'surface', size: 'sm' })}
        >
          {busy === 'close' ? 'Closing…' : 'Close post'}
        </button>
      </div>
    </div>
  );
}

/** Report a lost or found item. Place comes from campus landmarks, never asked as a campus. */
function ReportItemSheet({
  defaultKind,
  campusCode,
  onClose,
  onCreated,
}: {
  defaultKind: LostFoundKind;
  campusCode: string;
  onClose: () => void;
  onCreated: (item: LostFoundView) => void;
}) {
  const [kind, setKind] = useState<LostFoundKind>(defaultKind);
  const [category, setCategory] = useState<LostFoundCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState<LandmarkPick | null>(null);
  const [keptAt, setKeptAt] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [contactKind, setContactKind] = useState<LostFoundContactKind>('whatsapp');
  const [contactValue, setContactValue] = useState('');
  const [config, setConfig] = useState<CampusConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch('/api/campus/config', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { college: { code: string }; campus: { origin: LatLng; landmarks: Landmark[] } };
        if (live) setConfig({ origin: data.campus.origin, landmarks: data.campus.landmarks, code: data.college.code });
      } catch {
        // The landmark list is optional; the post still works without a place.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const defaultQuestion = claimQuestion({ kind, category: category ?? 'other' });
  const ready = Boolean(category && title.trim().length >= 3 && contactValue.trim() && (!question.trim() || answer.trim()));

  const submit = async () => {
    if (!ready || busy || !category) return;
    setBusy(true);
    setError('');
    const ownQuestion = question.trim() || (answer.trim() ? defaultQuestion : '');
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          category,
          title: title.trim(),
          description: description.trim(),
          place: place ? { landmarkId: place.landmarkId, area: place.area, roughDistanceM: place.roughDistanceM } : null,
          keptAt: kind === 'found' ? keptAt.trim() || null : null,
          images,
          claimQuestion: ownQuestion || null,
          claimAnswer: ownQuestion ? answer.trim() || null : null,
          contact: { kind: contactKind, value: contactValue.trim() },
        }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not post'));
      const data = (await response.json()) as { item: LostFoundView };
      onCreated(data.item);
    } catch (cause) {
      setError((cause as Error).message || 'Could not post');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Report an item" kicker="Only verified students see posts" onClose={onClose}>
      <div className="space-y-3">
        <Segmented label="Lost or found" value={kind} onChange={setKind} options={KIND_OPTIONS} />

        <div>
          <p className="text-[11.5px] font-bold text-ink">What is it?</p>
          <div role="group" aria-label="Item type" className="mt-1 flex flex-wrap gap-1.5">
            {LOST_FOUND_CATEGORIES.map((value) => {
              const selected = category === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(value)}
                  className={cn(CHIP, selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink')}
                >
                  {LOST_FOUND_CATEGORY_LABELS[value]}
                </button>
              );
            })}
          </div>
          {category && isSensitiveCategory(category) ? (
            <p className="mt-1 text-[10.5px] font-semibold text-slate">Others see only the type and place.</p>
          ) : null}
        </div>

        <label className="block text-[11.5px] font-bold text-ink">
          Short title
          <input
            type="text"
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={kind === 'found' ? 'Found a black wallet' : 'Lost my blue bottle'}
            className="campus-input mt-1"
          />
        </label>

        <label className="block text-[11.5px] font-bold text-ink">
          Details
          <textarea
            value={description}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Colour, marks, when. Skip names and numbers."
            className="campus-input mt-1 min-h-20 resize-none"
          />
        </label>

        {config ? (
          <LandmarkPicker
            landmarks={config.landmarks}
            origin={config.origin}
            campusCode={config.code || campusCode}
            value={place}
            onChange={setPlace}
            label={kind === 'found' ? 'Where did you find it?' : 'Where did you lose it?'}
          />
        ) : null}

        {kind === 'found' ? (
          <label className="block text-[11.5px] font-bold text-ink">
            Where is it now?
            <input
              type="text"
              value={keptAt}
              maxLength={60}
              onChange={(event) => setKeptAt(event.target.value)}
              placeholder="Security desk, or with me"
              className="campus-input mt-1"
            />
          </label>
        ) : null}

        <PhotoField value={images} onChange={setImages} max={MAX_PHOTOS} hint="Only you see these photos." />

        <div className="rounded-[12px] bg-surface p-2.5">
          <p className="text-[11.5px] font-bold text-ink">A question to check the owner</p>
          <input
            type="text"
            value={question}
            maxLength={120}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={defaultQuestion}
            aria-label="Question for the owner"
            className="campus-input mt-1 bg-white"
          />
          <input
            type="text"
            value={answer}
            maxLength={120}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="The answer, kept private"
            aria-label="Private answer"
            className="campus-input mt-1.5 bg-white"
          />
          <p className="mt-1 text-[10.5px] font-semibold text-slate">We match answers, any letter case.</p>
        </div>

        <div>
          <p className="text-[11.5px] font-bold text-ink">How should they reach you?</p>
          <div role="group" aria-label="Contact type" className="mt-1 flex flex-wrap gap-1.5">
            {CONTACT_KINDS.map((value) => {
              const selected = contactKind === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setContactKind(value)}
                  className={cn(CHIP, selected ? 'bg-ink font-bold text-white' : 'bg-surface font-semibold text-ink')}
                >
                  {CONTACT_KIND_LABELS[value]}
                </button>
              );
            })}
          </div>
          <input
            type={contactKind === 'email' ? 'email' : contactKind === 'instagram' ? 'text' : 'tel'}
            value={contactValue}
            maxLength={140}
            onChange={(event) => setContactValue(event.target.value)}
            placeholder={CONTACT_PLACEHOLDERS[contactKind]}
            aria-label={`Your ${CONTACT_KIND_LABELS[contactKind]}`}
            className="campus-input mt-1.5"
          />
          <p className="mt-1 text-[10.5px] font-semibold text-slate">Shown only to the student you approve.</p>
        </div>

        <ErrorLine message={error} />

        <button type="button" disabled={!ready || busy} onClick={() => void submit()} className={cn(swButton(), 'w-full')}>
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </Sheet>
  );
}
