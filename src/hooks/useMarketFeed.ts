'use client';

// Market v2 feed: loads the campus (or Girls' space) listings, groups them
// into the market home sections, saves optimistically and posts one-tap asks.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { groupMarketFeed, isFeedVisible, type MarketFeed } from '@/lib/campus/marketFeed';
import type { MarketSectionId } from '@/lib/campus/market';
import type { SerializedMarketListing } from '@/lib/campus/marketSerialize';
import { askText } from '@/lib/search/campusSearch';
import type { CampusAudience } from '@/types/campus';

export type MarketFeedListing = SerializedMarketListing;

/** Campus the API says the viewer belongs to. */
export interface MarketCampusRef {
  id: string;
  code: string;
  label: string;
}

/** Every link the market screens build, per audience. */
export interface MarketPaths {
  /** '/marketplace' or '/girls-space/marketplace'. */
  base: string;
  /** Where the header back button goes. */
  back: string;
  /** New post form, keeping the audience. */
  create: string;
  /** The poster's own posts. */
  myPosts: string;
  detail(id: string): string;
  seeAll(section: MarketSectionId): string;
  /** New post form with a kind preset, e.g. newPost('bundle'). */
  newPost(kind: string, extra?: Record<string, string>): string;
}

export function marketPaths(audience: CampusAudience): MarketPaths {
  const girls = audience === 'girls';
  const base = girls ? '/girls-space/marketplace' : '/marketplace';
  const newPost = (kind: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ kind, ...extra });
    if (girls) params.set('audience', 'girls');
    return `/marketplace/new?${params.toString()}`;
  };
  return {
    base,
    back: girls ? '/girls-space' : '/',
    create: girls ? '/marketplace/new?audience=girls' : '/marketplace/new',
    myPosts: `/campus/activity?tab=posts&audience=${audience}`,
    detail: (id) => `${base}/${encodeURIComponent(id)}`,
    seeAll: (section) => `${base}/all/${section}`,
    newPost,
  };
}

export function marketListingsEndpoint(audience: CampusAudience): string {
  return audience === 'girls' ? '/api/girls-space/marketplace' : '/api/marketplace/listings';
}

/** Result of a one-tap ask. On failure the caller sends the student to the form. */
export type AskResult =
  | { ok: true; id: string | null }
  | { ok: false; existingId: string | null; error: string };

/** Title max in the create schema. */
const MAX_TITLE = 80;

type FeedStatus = 'loading' | 'ready' | 'error';

interface FeedResponse {
  campus?: MarketCampusRef | null;
  items?: MarketFeedListing[];
  error?: string;
}

async function fetchFeed(endpoint: string, signal?: AbortSignal): Promise<FeedResponse> {
  const response = await fetch(endpoint, { cache: 'no-store', signal });
  const data = (await response.json().catch(() => ({}))) as FeedResponse;
  if (!response.ok) throw new Error(data.error || 'Could not load the market');
  return data;
}

export function useMarketFeed(audience: CampusAudience, options: { ring?: number } = {}) {
  const endpoint = marketListingsEndpoint(audience);
  const [items, setItems] = useState<MarketFeedListing[]>([]);
  const [campus, setCampus] = useState<MarketCampusRef | null>(null);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [error, setError] = useState('');
  // Time the feed was loaded. Drives expiry and price-drop checks so renders agree.
  const [now, setNow] = useState(0);
  const pendingSaves = useRef(new Set<string>());
  const latest = useRef(0);

  const apply = useCallback((request: number, data: FeedResponse) => {
    if (request !== latest.current) return;
    setItems(Array.isArray(data.items) ? data.items : []);
    setCampus(data.campus ?? null);
    setNow(Date.now());
    setError('');
    setStatus('ready');
  }, []);

  const fail = useCallback((request: number, cause: unknown) => {
    if (request !== latest.current) return;
    if (cause instanceof DOMException && cause.name === 'AbortError') return;
    setError(cause instanceof Error && cause.message ? cause.message : 'Could not load the market');
    setStatus('error');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const request = ++latest.current;
    fetchFeed(endpoint, controller.signal).then(
      (data) => apply(request, data),
      (cause) => fail(request, cause),
    );
    return () => controller.abort();
  }, [endpoint, apply, fail]);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setStatus('loading');
    try {
      apply(request, await fetchFeed(endpoint));
    } catch (cause) {
      fail(request, cause);
    }
  }, [endpoint, apply, fail]);

  /** Flips the save at once; puts it back if the server says no. */
  const toggleSave = useCallback(async (listing: Pick<MarketFeedListing, 'id' | 'isSaved'>) => {
    if (pendingSaves.current.has(listing.id)) return;
    pendingSaves.current.add(listing.id);
    const next = !listing.isSaved;
    const setSaved = (saved: boolean) =>
      setItems((current) => current.map((item) => (item.id === listing.id ? { ...item, isSaved: saved } : item)));
    setSaved(next);
    try {
      const response = await fetch('/api/campus/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: next ? 'save' : 'unsave', contentType: 'marketplace', contentId: listing.id }),
      });
      if (!response.ok) throw new Error('save failed');
    } catch {
      setSaved(!next);
    } finally {
      pendingSaves.current.delete(listing.id);
    }
  }, []);

  /**
   * One-tap ask: posts a wanted 'Any {q} available?' with the saved number.
   * `budgetMax` comes from the search ('cycle under 12k' -> 12000).
   */
  const askWanted = useCallback(
    async (q: string, budgetMax: number | null = null): Promise<AskResult> => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'wanted',
            title: askText(q).slice(0, MAX_TITLE),
            budgetMax: typeof budgetMax === 'number' && budgetMax > 0 ? Math.round(budgetMax) : null,
            useSavedNumber: true,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as { id?: string; existingId?: string; error?: string };
        if (!response.ok) {
          return { ok: false, existingId: typeof data.existingId === 'string' ? data.existingId : null, error: data.error || 'Could not ask' };
        }
        void reload();
        return { ok: true, id: typeof data.id === 'string' ? data.id : null };
      } catch {
        return { ok: false, existingId: null, error: 'Could not ask' };
      }
    },
    [endpoint, reload],
  );

  const ring = options.ring;
  const feed: MarketFeed<MarketFeedListing> = useMemo(() => groupMarketFeed(items, now, { ring }), [items, now, ring]);

  /** Saved, still open listings whose price just dropped. */
  const savedDrops = useMemo(
    () => items.filter((item) => item.isSaved && item.priceDropped && !item.isOwner && isFeedVisible(item, now)),
    [items, now],
  );

  return { items, campus, status, error, now, feed, savedDrops, reload, toggleSave, askWanted };
}
