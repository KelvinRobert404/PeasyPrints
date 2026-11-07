'use client';

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { CampusGate } from '@/components/campus/CampusGate';
import { DistanceLine } from '@/components/campus/places/DistanceLine';
import { LandmarkPicker, type LandmarkPick } from '@/components/campus/places/LandmarkPicker';
import { BallIcon, CloseIcon, MinusIcon, PlusIcon } from '@/components/swoop/icons';
import { GamesArt } from '@/components/swoop/illustrations';
import { Chip, EmptyState, IconButton, IconTile, PageHeader, Tag, swButton } from '@/components/swoop/primitives';
import { useCurrentCampus } from '@/hooks/useCurrentCampus';
import { GAME_SPORT_LABELS, TRUST_LINE } from '@/lib/campus/constants';
import {
  MAX_CAPACITY,
  MAX_DAYS_AHEAD,
  MIN_CAPACITY,
  MIN_LEAD_MS,
  SPORTS,
  gameLine,
  slotLabel,
  soonestFirst,
  type GameView,
  type PickupSport,
} from '@/lib/campus/games';
import type { LatLng } from '@/lib/format/distance';
import { cn } from '@/lib/utils/cn';
import type { Landmark } from '@/types/college';

const API = '/api/campus/games';
const DEFAULT_CAPACITY = 10;

type Filter = PickupSport | 'all';
type CampusConfig = { origin: LatLng; landmarks: Landmark[]; code: string };

async function readError(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

/** 'YYYY-MM-DDTHH:mm' in the device's time, for a datetime-local input. */
function localInput(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The next half hour at least an hour away. */
function defaultStart(now: number): string {
  const step = 30 * 60 * 1000;
  return localInput(Math.ceil((now + 60 * 60 * 1000) / step) * step);
}

export default function GamesPage() {
  return (
    <CampusGate>
      <GamesScreen />
    </CampusGate>
  );
}

function GamesScreen() {
  const campus = useCurrentCampus();
  const [games, setGames] = useState<GameView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [hosting, setHosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readError(response, 'Could not load games'));
      const data = (await response.json()) as { games?: GameView[] };
      setGames(soonestFirst(data.games ?? []));
    } catch (cause) {
      setError((cause as Error).message || 'Could not load games');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Swaps in the server's copy; cancelled games leave the list. */
  const replace = (game: GameView) => {
    setGames((current) => {
      const rest = current.filter((entry) => entry.id !== game.id);
      return game.status === 'cancelled' || game.over ? rest : soonestFirst([...rest, game]);
    });
  };

  const act = async (game: GameView, action: 'join' | 'leave' | 'cancel') => {
    if (busyId) return;
    setBusyId(game.id);
    setRowError(null);
    setNotice('');
    try {
      const response = await fetch(`${API}/${encodeURIComponent(game.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const message = await readError(response, 'Could not update');
        setRowError({ id: game.id, message });
        // Someone else may have taken the last slot; show the latest count.
        if (response.status === 409) void load();
        return;
      }
      const data = (await response.json()) as { game: GameView };
      replace(data.game);
      setConfirmId(null);
      setNotice(action === 'join' ? 'You are in. We will remind you.' : action === 'leave' ? 'You left. Slot freed.' : 'Game cancelled. Players told.');
    } catch {
      setRowError({ id: game.id, message: 'Could not update' });
    } finally {
      setBusyId(null);
    }
  };

  const shown = filter === 'all' ? games : games.filter((game) => game.group === filter);
  const code = campus?.code ?? 'campus';

  return (
    <div className="pb-3">
      <PageHeader
        title="Pickup games"
        kicker={campus?.label ?? 'Your campus'}
        actions={<IconButton label="Start a game" icon={PlusIcon} onClick={() => setHosting(true)} />}
      />
      <main className="space-y-3 px-3 pt-2">
        <section className="flex items-center gap-3 overflow-hidden rounded-[14px] bg-surface px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Tag tone="white">{TRUST_LINE}</Tag>
            <h2 className="font-heading mt-1 text-[15px] leading-[1.1] text-ink">Hey, up for a game?</h2>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-slate">Grab a slot or start your own.</p>
            <button type="button" onClick={() => setHosting(true)} className={cn(swButton({ size: 'sm' }), 'mt-2')}>
              <PlusIcon size={13} aria-hidden="true" />
              Start a game
            </button>
          </div>
          <GamesArt width={92} height={84} className="shrink-0" />
        </section>

        <div role="group" aria-label="Sport" className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </Chip>
          {SPORTS.map((sport) => (
            <Chip key={sport} selected={filter === sport} onClick={() => setFilter(sport)}>
              {GAME_SPORT_LABELS[sport]}
            </Chip>
          ))}
        </div>

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
            icon={BallIcon}
            title="Could not load games"
            body={error}
            action={
              <button type="button" onClick={() => void load()} className={swButton({ variant: 'white', size: 'sm' })}>
                Try again
              </button>
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={BallIcon}
            title={filter === 'all' ? 'No games yet' : `No ${GAME_SPORT_LABELS[filter].toLowerCase()} games yet`}
            body="Start one and find players."
            action={
              <button type="button" onClick={() => setHosting(true)} className={swButton({ variant: 'white', size: 'sm' })}>
                Start a game
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((game) => (
              <li key={game.id}>
                <GameRow
                  game={game}
                  campusCode={code}
                  busy={busyId === game.id}
                  confirming={confirmId === game.id}
                  error={rowError?.id === game.id ? rowError.message : ''}
                  onJoin={() => void act(game, 'join')}
                  onLeave={() => void act(game, 'leave')}
                  onCancel={() => (confirmId === game.id ? void act(game, 'cancel') : setConfirmId(game.id))}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {hosting ? (
        <HostSheet
          campusCode={code}
          onClose={() => setHosting(false)}
          onCreated={(game) => {
            replace(game);
            setFilter('all');
            setHosting(false);
            setNotice('Game is up. We will remind you.');
          }}
        />
      ) : null}
    </div>
  );
}

function GameRow({
  game,
  campusCode,
  busy,
  confirming,
  error,
  onJoin,
  onLeave,
  onCancel,
}: {
  game: GameView;
  campusCode: string;
  busy: boolean;
  confirming: boolean;
  error: string;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  // Relabel on the device so 'Today' matches the viewer's clock.
  const line = gameLine({ ...game, label: slotLabel(game.startsAt, new Date()) });
  const small = swButton({ size: 'pill' });

  let trailing: ReactNode;
  if (game.started) trailing = <Tag tone="ink">Started</Tag>;
  else if (game.isHost)
    trailing = (
      <button type="button" disabled={busy} onClick={onCancel} className={cn(small, confirming ? 'bg-market text-white' : 'bg-market-tint text-market')}>
        {busy ? 'Cancelling…' : confirming ? 'Sure? Cancel' : 'Cancel'}
      </button>
    );
  else if (game.joined)
    trailing = (
      <button type="button" disabled={busy} onClick={onLeave} className={swButton({ variant: 'surface', size: 'pill' })}>
        {busy ? 'Leaving…' : 'Leave'}
      </button>
    );
  else if (game.full) trailing = <Tag tone="ink">Full</Tag>;
  else
    trailing = (
      <button type="button" disabled={busy || !game.canJoin} onClick={onJoin} className={swButton({ variant: 'ink', size: 'pill' })}>
        {busy ? 'Joining…' : 'Join'}
      </button>
    );

  return (
    <div className="py-2">
      <div className="flex items-center gap-2.5">
        <IconTile icon={BallIcon} tone={game.joined || game.isHost ? 'go' : 'royal'} shape="square" size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <p className="break-words text-[12.5px] font-bold leading-[1.3] text-ink">{line}</p>
          <p className="truncate text-[11px] text-slate">
            {game.place?.label ?? 'Place to be shared'} · {game.isHost ? 'Your game' : `By ${game.host.displayName}`}
            {game.joined && !game.isHost ? ' · You are in' : ''}
          </p>
          <DistanceLine meters={game.place?.roughDistanceM} campusLabel={campusCode} icon={false} className="text-[11px]" />
        </div>
        <span className="shrink-0">{trailing}</span>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 rounded-[10px] bg-market-tint px-2.5 py-1.5 text-[11px] font-bold text-market">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* Host sheet -------------------------------------------------------------- */

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

/** Start a game: sport, a campus landmark, a time and how many players. */
function HostSheet({ campusCode, onClose, onCreated }: { campusCode: string; onClose: () => void; onCreated: (game: GameView) => void }) {
  const [sport, setSport] = useState<PickupSport | null>(null);
  const [place, setPlace] = useState<LandmarkPick | null>(null);
  const [startsAt, setStartsAt] = useState(() => defaultStart(Date.now()));
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [config, setConfig] = useState<CampusConfig | null>(null);
  const [configFailed, setConfigFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bounds] = useState(() => {
    const now = Date.now();
    return { min: localInput(now + MIN_LEAD_MS), max: localInput(now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) };
  });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch('/api/campus/config', { cache: 'no-store' });
        if (!response.ok) throw new Error('config');
        const data = (await response.json()) as { college: { code: string }; campus: { origin: LatLng; landmarks: Landmark[] } };
        if (live) setConfig({ origin: data.campus.origin, landmarks: data.campus.landmarks, code: data.college.code });
      } catch {
        if (live) setConfigFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const start = startsAt ? new Date(startsAt) : null;
  const startValid = Boolean(start && Number.isFinite(start.getTime()));
  const offList = Boolean(place && !place.landmarkId);
  const ready = Boolean(sport && place?.landmarkId && startValid);

  const submit = async () => {
    if (!ready || busy || !sport || !place?.landmarkId || !start) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, landmarkId: place.landmarkId, startsAt: start.toISOString(), capacity }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not start the game'));
      const data = (await response.json()) as { game: GameView };
      onCreated(data.game);
    } catch (cause) {
      setError((cause as Error).message || 'Could not start the game');
    } finally {
      setBusy(false);
    }
  };

  const stepper = 'campus-press grid h-8 w-8 place-items-center rounded-full bg-surface text-ink disabled:opacity-45';

  return (
    <Sheet title="Start a game" kicker="Only verified students can join" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <p className="text-[11.5px] font-bold text-ink">Which sport?</p>
          <div role="group" aria-label="Sport" className="mt-1 flex flex-wrap gap-1.5">
            {SPORTS.map((value) => (
              <Chip key={value} selected={sport === value} onClick={() => setSport(value)}>
                {GAME_SPORT_LABELS[value]}
              </Chip>
            ))}
          </div>
        </div>

        {config ? (
          <div>
            <LandmarkPicker
              landmarks={config.landmarks}
              origin={config.origin}
              campusCode={config.code || campusCode}
              value={place}
              onChange={setPlace}
              label="Where do you play?"
            />
            {offList ? <p className="mt-1 text-[10.5px] font-semibold text-market">Pick a place from the list.</p> : null}
          </div>
        ) : configFailed ? (
          <p className="rounded-[12px] bg-market-tint px-3 py-2 text-[11.5px] font-bold text-market">Could not load places. Try again.</p>
        ) : (
          <div className="h-10 animate-pulse rounded-[12px] bg-surface" aria-busy="true" />
        )}

        <label className="block text-[11.5px] font-bold text-ink">
          When?
          <input
            type="datetime-local"
            value={startsAt}
            min={bounds.min}
            max={bounds.max}
            onChange={(event) => setStartsAt(event.target.value)}
            className="campus-input mt-1"
          />
          {startValid && start ? <span className="mt-1 block text-[10.5px] font-semibold text-slate">{slotLabel(start, new Date())}</span> : null}
        </label>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold text-ink">How many players?</p>
            <p className="text-[10.5px] font-semibold text-slate">You take the first slot.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Fewer players"
              disabled={capacity <= MIN_CAPACITY}
              onClick={() => setCapacity((value) => Math.max(MIN_CAPACITY, value - 1))}
              className={stepper}
            >
              <MinusIcon size={13} />
            </button>
            <span className="w-6 text-center text-[14px] font-bold tabular-nums text-ink" aria-live="polite">
              {capacity}
            </span>
            <button
              type="button"
              aria-label="More players"
              disabled={capacity >= MAX_CAPACITY}
              onClick={() => setCapacity((value) => Math.min(MAX_CAPACITY, value + 1))}
              className={stepper}
            >
              <PlusIcon size={13} />
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-[12px] bg-market-tint px-3 py-2 text-[11.5px] font-bold text-market">
            {error}
          </p>
        ) : null}

        <button type="button" disabled={!ready || busy} onClick={() => void submit()} className={cn(swButton(), 'w-full')}>
          {busy ? 'Starting…' : 'Start game'}
        </button>
      </div>
    </Sheet>
  );
}
