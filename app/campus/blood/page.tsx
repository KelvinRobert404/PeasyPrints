'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CampusGate } from '@/components/campus/CampusGate';
import { HandoffAnchor, useHandoff } from '@/components/demo/DemoHandoffSheet';
import { BloodDropIcon, CheckIcon, LockIcon, MinusIcon, PlusIcon } from '@/components/swoop/icons';
import { BloodArt } from '@/components/swoop/illustrations';
import { Card, EmptyState, PageHeader, Tag, swButton } from '@/components/swoop/primitives';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import {
  BLOOD_GROUPS,
  HOSPITAL_MAX,
  UNITS_MAX,
  UNITS_MIN,
  URGENCY_LABELS,
  whatsappHref,
  type BloodMeView,
  type BloodRequestView,
} from '@/lib/campus/blood';
import { TRUST_LINE } from '@/lib/campus/constants';
import { cn } from '@/lib/utils/cn';
import type { BloodGroup } from '@/types/utilities';

const API = '/api/campus/blood';
const WHATSAPP_KEY = 'swoop.blood.whatsapp';

type BloodState = { me: BloodMeView; counts: Record<BloodGroup, number>; requests: BloodRequestView[] };

async function post<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

/** 'Sat 7 Nov, 6:30 pm' in the viewer's clock. */
function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** A datetime-local value for `hours` from now, in local time. */
function localInput(hours: number): string {
  const date = new Date(Date.now() + hours * 3600000);
  date.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function readSavedNumber(): string {
  try {
    return window.localStorage.getItem(WHATSAPP_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveNumber(value: string) {
  try {
    window.localStorage.setItem(WHATSAPP_KEY, value);
  } catch {
    // Storage is a convenience only.
  }
}

export default function BloodPage() {
  return (
    <CampusGate>
      <BloodScreen />
    </CampusGate>
  );
}

function BloodScreen() {
  const campus = useCurrentCampus();
  const [state, setState] = useState<BloodState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(API, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as Partial<BloodState> & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load requests');
      setState({ me: data.me ?? { optedIn: false, bloodGroup: null, available: false }, counts: data.counts ?? ({} as BloodState['counts']), requests: data.requests ?? [] });
    } catch (cause) {
      setError((cause as Error).message || 'Could not load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const code = campus?.code ?? 'campus';

  const replace = (item: BloodRequestView) =>
    setState((current) => {
      if (!current) return current;
      const rest = current.requests.filter((entry) => entry.id !== item.id);
      if (item.status !== 'open') return { ...current, requests: rest };
      const exists = current.requests.some((entry) => entry.id === item.id);
      return { ...current, requests: exists ? current.requests.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...rest] };
    });

  return (
    <div className="pb-3">
      <PageHeader title="Blood donors" kicker={campus?.label ?? 'Your campus'} />
      <main className="space-y-3 px-3 pt-2">
        <section className="flex items-center gap-3 overflow-hidden rounded-[14px] bg-surface px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Tag tone="white">{TRUST_LINE}</Tag>
            <h2 className="font-heading mt-1 text-[15px] leading-[1.1] text-ink">Hey, help a student nearby</h2>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-slate">Only {code} requests. Never after 10 pm.</p>
            <button type="button" onClick={() => setAsking((open) => !open)} className={cn(swButton({ size: 'sm' }), 'mt-2')}>
              <PlusIcon size={13} aria-hidden="true" />
              Need blood?
            </button>
          </div>
          <BloodArt width={92} height={84} className="shrink-0" />
        </section>

        {notice ? (
          <p role="status" className="rounded-[12px] bg-go-tint px-3 py-2 text-[11.5px] font-bold text-go-text">
            {notice}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-1.5" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-[12px] bg-surface" />
            ))}
          </div>
        ) : error || !state ? (
          <EmptyState
            icon={BloodDropIcon}
            title="Could not load requests"
            body={error}
            action={
              <button type="button" onClick={() => void load()} className={swButton({ variant: 'white', size: 'sm' })}>
                Try again
              </button>
            }
          />
        ) : (
          <>
            {asking ? (
              <RequestForm
                onCancel={() => setAsking(false)}
                onCreated={(item, notified) => {
                  replace(item);
                  setAsking(false);
                  setNotice(notified > 0 ? `Posted. ${notified} matching donors alerted.` : 'Posted. It shows below.');
                }}
              />
            ) : null}

            <DonorCard
              me={state.me}
              counts={state.counts}
              code={code}
              onChange={(me, message) => {
                setState((current) => (current ? { ...current, me } : current));
                setNotice(message);
                void load();
              }}
            />

            <section aria-labelledby="blood-open">
              <h2 id="blood-open" className="font-heading text-[14.5px] leading-[1.1] text-ink">
                Open requests
              </h2>
              {state.requests.length === 0 ? (
                <EmptyState icon={BloodDropIcon} title="No open requests" body={`Nobody at ${code} needs blood now.`} className="mt-2" />
              ) : (
                <ul className="mt-2 space-y-2">
                  {state.requests.map((item) => (
                    <li key={item.id}>
                      <RequestCard item={item} onChange={replace} onNotice={setNotice} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/* Group picker -------------------------------------------------------------- */

function GroupPicker({ value, onChange, label }: { value: BloodGroup | null; onChange: (group: BloodGroup) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-4 gap-1.5">
      {BLOOD_GROUPS.map((group) => {
        const active = group === value;
        return (
          <button
            key={group}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(group)}
            className={cn(
              'campus-press h-9 rounded-[10px] text-[13px] font-bold transition-colors',
              active ? 'bg-market text-white' : 'bg-surface text-ink',
            )}
          >
            {group}
          </button>
        );
      })}
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

/* Opt in and out ------------------------------------------------------------ */

function DonorCard({
  me,
  counts,
  code,
  onChange,
}: {
  me: BloodMeView;
  counts: Record<BloodGroup, number>;
  code: string;
  onChange: (me: BloodMeView, message: string) => void;
}) {
  const [group, setGroup] = useState<BloodGroup | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOff, setConfirmOff] = useState(false);
  const total = BLOOD_GROUPS.reduce((sum, item) => sum + (counts[item] ?? 0), 0);

  const act = async (body: Record<string, unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await post<{ me: BloodMeView }>(body, 'Could not save');
      setConfirmOff(false);
      setConsent(false);
      onChange(data.me, message);
    } catch (cause) {
      setError((cause as Error).message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-3">
      {me.optedIn && me.bloodGroup ? (
        <>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-market-tint text-[14px] font-bold text-market">{me.bloodGroup}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-ink">You get donor alerts</p>
              <p className="text-[11px] text-slate">Only for requests you can give to.</p>
            </div>
            <CheckIcon size={16} className="shrink-0 text-go-text" aria-hidden="true" />
          </div>
          {confirmOff ? (
            <div className="mt-2 rounded-[12px] bg-surface p-2.5">
              <p className="text-[11.5px] font-semibold text-ink">We delete your blood group. Sure?</p>
              <div className="mt-2 flex gap-1.5">
                <button type="button" disabled={busy} onClick={() => void act({ action: 'opt_out' }, 'Alerts off. Your group is deleted.')} className={swButton({ variant: 'danger', size: 'sm' })}>
                  {busy ? 'Deleting…' : 'Yes, delete it'}
                </button>
                <button type="button" onClick={() => setConfirmOff(false)} className={swButton({ variant: 'white', size: 'sm' })}>
                  Keep alerts
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmOff(true)} className={cn(swButton({ variant: 'surface', size: 'sm' }), 'mt-2')}>
              Stop alerts
            </button>
          )}
        </>
      ) : (
        <>
          <p className="font-heading text-[14.5px] leading-[1.1] text-ink">Get alerts as a donor</p>
          <p className="mt-0.5 text-[11.5px] text-slate">Pick your group. Nobody sees your name.</p>
          <div className="mt-2">
            <GroupPicker value={group} onChange={setGroup} label="Your blood group" />
          </div>
          <label className="mt-2 flex items-start gap-2 text-[11.5px] leading-[1.4] text-ink">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--royal)]" />
            <span>
              <span className="block">I agree Swoop keeps my group for alerts.</span>
              <span className="block text-slate">Stop anytime and we delete it.</span>
            </span>
          </label>
          <button
            type="button"
            disabled={!group || !consent || busy}
            onClick={() => void act({ action: 'opt_in', group, consent: true }, 'Alerts on. Thank you.')}
            className={cn(swButton({ size: 'sm' }), 'mt-2 w-full')}
          >
            {busy ? 'Saving…' : 'Turn on alerts'}
          </button>
        </>
      )}
      <ErrorLine message={error} />

      <div className="mt-3 border-t border-line pt-2.5">
        <p className="flex items-center justify-between gap-2 text-[11.5px] font-bold text-ink">
          <span>Donors at {code}</span>
          <span className="font-semibold text-slate">{total} in all</span>
        </p>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {BLOOD_GROUPS.map((item) => (
            <div key={item} className="rounded-[10px] bg-surface px-2 py-1.5 text-center">
              <p className="text-[12.5px] font-bold text-ink">{item}</p>
              <p className="text-[10.5px] text-slate">{counts[item] ?? 0}</p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-slate">
          <LockIcon size={12} className="shrink-0" aria-hidden="true" />
          Counts only. Names and numbers stay private.
        </p>
      </div>
    </Card>
  );
}

/* Ask for blood ------------------------------------------------------------- */

function RequestForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (item: BloodRequestView, notified: number) => void }) {
  const [group, setGroup] = useState<BloodGroup | null>(null);
  const [units, setUnits] = useState(1);
  const [hospital, setHospital] = useState('');
  const [neededBy, setNeededBy] = useState(() => localInput(6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !group) return;
    const at = new Date(neededBy);
    if (!Number.isFinite(at.getTime())) {
      setError('Pick when it is needed');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await post<{ item: BloodRequestView; notified: number }>(
        { action: 'request', group, units, hospital: hospital.trim(), neededBy: at.toISOString() },
        'Could not post',
      );
      onCreated(data.item, data.notified ?? 0);
    } catch (cause) {
      setError((cause as Error).message || 'Could not post');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-3">
      <form onSubmit={(event) => void submit(event)}>
        <p className="font-heading text-[14.5px] leading-[1.1] text-ink">Need blood?</p>
        <p className="mt-0.5 text-[11.5px] text-slate">We alert matching donors at your college.</p>
        <div className="mt-2">
          <p className="mb-1 text-[11.5px] font-bold text-ink">Blood group</p>
          <GroupPicker value={group} onChange={setGroup} label="Blood group needed" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11.5px] font-bold text-ink">Units</p>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Fewer units" disabled={units <= UNITS_MIN} onClick={() => setUnits((value) => Math.max(UNITS_MIN, value - 1))} className={swButton({ variant: 'surface', size: 'icon' })}>
              <MinusIcon size={14} aria-hidden="true" />
            </button>
            <span className="w-6 text-center text-[14px] font-bold text-ink" aria-live="polite">
              {units}
            </span>
            <button type="button" aria-label="More units" disabled={units >= UNITS_MAX} onClick={() => setUnits((value) => Math.min(UNITS_MAX, value + 1))} className={swButton({ variant: 'surface', size: 'icon' })}>
              <PlusIcon size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        <label className="mt-2 block text-[11.5px] font-bold text-ink">
          Hospital
          <input type="text" value={hospital} maxLength={HOSPITAL_MAX} onChange={(event) => setHospital(event.target.value)} placeholder="Hospital name" className="campus-input mt-1" />
        </label>
        <label className="mt-2 block text-[11.5px] font-bold text-ink">
          Needed by
          <input type="datetime-local" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} className="campus-input mt-1" />
        </label>
        <ErrorLine message={error} />
        <div className="mt-3 flex gap-1.5">
          <button type="submit" disabled={!group || hospital.trim().length < 3 || busy} className={cn(swButton({ size: 'sm' }), 'flex-1')}>
            {busy ? 'Posting…' : 'Post request'}
          </button>
          <button type="button" onClick={onCancel} className={swButton({ variant: 'white', size: 'sm' })}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

/* One request --------------------------------------------------------------- */

function RequestCard({ item, onChange, onNotice }: { item: BloodRequestView; onChange: (item: BloodRequestView) => void; onNotice: (message: string) => void }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const handoff = useHandoff();

  const act = async (body: Record<string, unknown>, key: string, message?: string) => {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      const data = await post<{ item: BloodRequestView }>({ ...body, id: item.id }, 'Could not update');
      onChange(data.item);
      if (message) onNotice(message);
      return true;
    } catch (cause) {
      setError((cause as Error).message || 'Could not update');
      return false;
    } finally {
      setBusy('');
    }
  };

  const openShare = (key: string) => {
    setSharing(key);
    setNumber((current) => current || readSavedNumber());
  };

  const units = item.units === 1 ? '1 unit' : `${item.units} units`;

  return (
    <Card className="p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-market-tint text-[15px] font-bold text-market">{item.bloodGroup}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-ink">
            {units} at {item.hospital}
          </p>
          <p className="truncate text-[11px] text-slate">
            {URGENCY_LABELS[item.urgency]} · by {when(item.neededBy)}
          </p>
          <p className="truncate text-[11px] text-slate">{item.isOwner ? 'Your request' : `Posted by ${item.posterFirstName}`}</p>
        </div>
        {item.isOwner ? <Tag tone="go">Yours</Tag> : item.canDonate ? <Tag tone="royal">You match</Tag> : null}
      </div>

      {item.isOwner ? (
        <div className="mt-2.5">
          <p className="text-[11.5px] font-bold text-ink">{item.helperCount === 0 ? 'No offers yet' : item.helperCount === 1 ? '1 person can help' : `${item.helperCount} people can help`}</p>
          {item.helpers.length > 0 ? (
            <ul className="mt-1.5 divide-y divide-line rounded-[12px] bg-surface px-2.5">
              {item.helpers.map((helper) => (
                <li key={helper.key} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-semibold text-ink">{helper.firstName}</span>
                    {helper.shared ? (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-go-text">
                        <CheckIcon size={12} aria-hidden="true" />
                        WhatsApp shared
                      </span>
                    ) : (
                      <button type="button" onClick={() => openShare(helper.key)} className={swButton({ variant: 'white', size: 'sm' })}>
                        Share WhatsApp
                      </button>
                    )}
                  </div>
                  {sharing === helper.key && !helper.shared ? (
                    <form
                      className="mt-2 flex gap-1.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void act({ action: 'share_whatsapp', helperKey: helper.key, whatsapp: number }, `share-${helper.key}`, `Shared with ${helper.firstName}.`).then((ok) => {
                          if (ok) {
                            saveNumber(number);
                            setSharing(null);
                          }
                        });
                      }}
                    >
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={number}
                        maxLength={16}
                        onChange={(event) => setNumber(event.target.value)}
                        placeholder="Your WhatsApp number"
                        aria-label="Your WhatsApp number"
                        className="campus-input min-w-0 flex-1"
                      />
                      <button type="submit" disabled={!number.trim() || Boolean(busy)} className={swButton({ size: 'sm' })}>
                        {busy === `share-${helper.key}` ? 'Sharing…' : 'Share'}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex gap-1.5">
            <button type="button" disabled={Boolean(busy)} onClick={() => void act({ action: 'close', fulfilled: true }, 'done', 'Glad you got blood. Request closed.')} className={cn(swButton({ size: 'sm' }), 'flex-1')}>
              Got blood
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void act({ action: 'close', fulfilled: false }, 'close', 'Request closed.')} className={swButton({ variant: 'surface', size: 'sm' })}>
              Close
            </button>
          </div>
        </div>
      ) : item.sharedWhatsapp ? (
        <HandoffAnchor
          href={whatsappHref(item.sharedWhatsapp, `Hey ${item.posterFirstName}, I can help with ${item.bloodGroup} blood.`)}
          target="_blank"
          rel="noreferrer"
          className={cn(swButton({ size: 'sm' }), 'mt-2.5 w-full')}
          onHandoff={() => {
            if (item.sharedWhatsapp) handoff.open('whatsapp', item.posterFirstName, item.sharedWhatsapp);
          }}
        >
          Message {item.posterFirstName} on WhatsApp
        </HandoffAnchor>
      ) : item.iCanHelp ? (
        <p role="status" className="mt-2.5 rounded-[12px] bg-go-tint px-3 py-2 text-[11.5px] font-bold text-go-text">
          Thanks. {item.posterFirstName} may share their WhatsApp.
        </p>
      ) : (
        <button type="button" disabled={Boolean(busy)} onClick={() => void act({ action: 'can_help' }, 'help', 'Thanks. They will see your first name.')} className={cn(swButton({ size: 'sm' }), 'mt-2.5 w-full')}>
          {busy === 'help' ? 'Sending…' : 'I can help'}
        </button>
      )}
      <ErrorLine message={error} />
      {handoff.sheet}
    </Card>
  );
}
