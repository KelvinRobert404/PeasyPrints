'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { CampusGate } from '@/components/campus/CampusGate';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { CloseIcon, DealIcon, ShieldCheckIcon } from '@/components/swoop/icons';
import { DealsArt } from '@/components/swoop/illustrations';
import { EmptyState, IconButton, IconTile, PageHeader, Tag, swButton } from '@/components/swoop/primitives';
import { useCampusSession } from '@/hooks/useCampusSession';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { counterClock, counterDate, firstName, validTillLabel, type StudentDeal, type StudentDealsPayload } from '@/lib/campus/studentDeals';
import { cn } from '@/lib/utils/cn';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; payload: StudentDealsPayload };

export default function StudentDealsPage() {
  return (
    <CampusGate>
      <DealsScreen />
    </CampusGate>
  );
}

function DealsScreen() {
  const campus = useCurrentCampus();
  const { session } = useCampusSession();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [open, setOpen] = useState<StudentDeal | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/campus/student-deals', { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as Partial<StudentDealsPayload> & { error?: string };
      if (!response.ok) {
        setState({ kind: 'error', message: data.error || 'Could not load deals' });
        return;
      }
      setState({ kind: 'ready', payload: { deals: data.deals ?? [], campus: data.campus ?? null } });
    } catch {
      setState({ kind: 'error', message: 'Could not load deals' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const payloadCampus = state.kind === 'ready' ? state.payload.campus : null;
  const label = campus?.label ?? payloadCampus?.label ?? 'Your campus';
  const code = campus?.code ?? payloadCampus?.code ?? 'campus';
  const deals = state.kind === 'ready' ? state.payload.deals : [];
  const anySample = deals.some((deal) => deal.sample);

  return (
    <div className="pb-3">
      <PageHeader title="Student deals" kicker={label} />
      <main className="mx-auto max-w-lg px-3 pt-2">
        <section className="relative flex min-h-[110px] items-center overflow-hidden rounded-[14px] bg-royal-tint px-3 py-3">
          <div className="min-w-0 flex-1 pr-[92px]">
            <Tag tone="white">Only verified students</Tag>
            <h2 className="font-heading mt-1.5 text-[14.5px] leading-[1.1] text-ink">Hey, deals near {code}</h2>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-text-secondary">Free for students. Show it at the counter.</p>
          </div>
          <DealsArt width={96} height={88} className="pointer-events-none absolute bottom-1 right-1" />
        </section>

        {anySample ? (
          <p role="note" className="mt-2 rounded-[12px] bg-surface px-3 py-2 text-[11px] font-semibold text-text-secondary">
            Sample deals for testing. Not real offers.
          </p>
        ) : null}

        <div className="pt-3">
          {state.kind === 'loading' ? (
            <div className="space-y-1.5" aria-busy="true" aria-label="Loading deals">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-[76px] animate-pulse rounded-[14px] bg-surface" />
              ))}
            </div>
          ) : state.kind === 'error' ? (
            <EmptyState
              icon={DealIcon}
              title="Deals did not load"
              body={state.message}
              action={
                <button type="button" onClick={() => { setState({ kind: 'loading' }); void load(); }} className={swButton({ variant: 'ink', size: 'sm' })}>
                  Try again
                </button>
              }
            />
          ) : deals.length === 0 ? (
            <EmptyState icon={DealIcon} title="No deals near you yet" body="New deals show up here." />
          ) : (
            <ul className="flex flex-col gap-1.5" aria-label="Deals, nearest first">
              {deals.map((deal) => (
                <li key={deal.id}>
                  <DealRow deal={deal} code={code} onShow={() => setOpen(deal)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {open ? (
        <CounterSheet
          deal={open}
          name={firstName(session.membership?.displayName)}
          campusLabel={label}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function DealRow({ deal, code, onShow }: { deal: StudentDeal; code: string; onShow: () => void }) {
  return (
    <button
      type="button"
      onClick={onShow}
      className="campus-press flex w-full items-start gap-2.5 rounded-[14px] border border-line bg-white px-2.5 py-2.5 text-left"
    >
      <IconTile icon={DealIcon} tone="royal" shape="square" size={40} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-bold text-ink">{deal.merchantName}</span>
          {deal.sample ? <Tag className="shrink-0 bg-surface text-text-secondary">Sample</Tag> : null}
        </span>
        <span className="line-clamp-2 text-[11.5px] font-semibold leading-[1.35] text-ink">{deal.offer}</span>
        <DistanceLine meters={deal.distanceM} campusLabel={code} />
        <span className="text-[11px] text-slate">
          {validTillLabel(deal.validUntil)}
          {deal.place ? ` · ${deal.place.label}` : ''}
        </span>
      </span>
      <span className={cn(swButton({ variant: 'surface', size: 'pill' }), 'pointer-events-none shrink-0 self-center')}>Show</span>
    </button>
  );
}

/** The live clock. Ticks every second so a screenshot reads as stale. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function CounterSheet({ deal, name, campusLabel, onClose }: { deal: StudentDeal; name: string; campusLabel: string; onClose: () => void }) {
  const titleId = useId();
  const now = useNow();

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-3 sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto w-full max-w-md rounded-[14px] bg-white p-4 shadow-[0_8px_30px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold text-slate">Show at counter</p>
            <h2 id={titleId} className="font-heading truncate text-[16px] leading-[1.1] text-ink">
              {deal.merchantName}
            </h2>
          </div>
          <IconButton label="Close" icon={CloseIcon} onClick={onClose} />
        </div>

        <div className="mt-3 flex flex-col items-center gap-1.5 rounded-[14px] bg-royal-tint px-3 py-4 text-center">
          <p className="font-heading text-[16px] leading-[1.1] text-ink">{name}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-royal">
            <ShieldCheckIcon size={14} aria-hidden="true" />
            Verified student, {campusLabel}
          </span>
          <p className="font-heading mt-1 text-[28px] leading-none text-ink tabular-nums" aria-live="off">
            {counterClock(now)}
          </p>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-go" aria-hidden="true" />
            Live, {counterDate(now)}
          </p>
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-[12.5px] font-bold text-ink">{deal.offer}</p>
          {deal.code ? (
            <p className="text-[11.5px] text-text-secondary">
              Code <span className="rounded-[6px] bg-surface px-1.5 py-0.5 font-bold text-ink">{deal.code}</span>
            </p>
          ) : null}
          {deal.howToClaim ? <p className="text-[11.5px] text-text-secondary">{deal.howToClaim}</p> : null}
          <p className="text-[11px] text-slate">{validTillLabel(deal.validUntil)}</p>
          {deal.sample ? (
            <p className="rounded-[12px] bg-surface px-3 py-2 text-[11px] font-bold text-text-secondary">Sample deal. Not a real offer.</p>
          ) : null}
        </div>

        <button type="button" onClick={onClose} className={cn(swButton({ variant: 'ink' }), 'mt-3 w-full')}>
          Done
        </button>
      </section>
    </div>
  );
}
