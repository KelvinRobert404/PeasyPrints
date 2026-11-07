'use client';

// Housing v2 feed: loads the campus (or Girls' space) housing posts, saves
// optimistically, and splits the list by search, filters and distance ring.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listCampuses } from '@/lib/campus/catalog';
import type { HousingKind } from '@/lib/campus/housing/model';
import type { SerializedHousingListing } from '@/lib/campus/housing/serialize';
import { withinRing, type DistanceRing } from '@/lib/format/distance';
import { askText, isEmptyQuery, matchItem, parseQuery, type ParsedQuery, type SearchContext } from '@/lib/search/campusSearch';
import type { CampusAudience, GenderPref } from '@/types/campus';

export type HousingFeedListing = SerializedHousingListing;

/** Campus the API says the viewer belongs to. */
export interface HousingCampusRef {
  id: string;
  code: string;
  label: string;
}

/** Every link the housing feed builds, per audience. */
export interface HousingPaths {
  /** Where the header back button goes. */
  back: string;
  create: string;
  myPosts: string;
  detail(id: string): string;
  /** One-tap ask: the roommate form, with the area filled in when known. */
  ask(area: string | null): string;
}

export function housingPaths(audience: CampusAudience): HousingPaths {
  const girls = audience === 'girls';
  const base = girls ? '/girls-space/housing' : '/housing';
  return {
    back: girls ? '/girls-space' : '/',
    create: girls ? '/housing/new?audience=girls' : '/housing/new',
    myPosts: `/campus/activity?tab=posts&audience=${audience}`,
    detail: (id) => `${base}/${encodeURIComponent(id)}`,
    ask: (area) => {
      const params = new URLSearchParams({ type: 'roommate' });
      if (area) params.set('area', area);
      if (girls) params.set('audience', 'girls');
      return `/housing/new?${params.toString()}`;
    },
  };
}

export function housingPostsEndpoint(audience: CampusAudience): string {
  return audience === 'girls' ? '/api/girls-space/housing' : '/api/housing/posts';
}

type FeedStatus = 'loading' | 'ready' | 'error';

interface FeedResponse {
  campus?: HousingCampusRef | null;
  items?: HousingFeedListing[];
  error?: string;
}

async function fetchFeed(endpoint: string, signal?: AbortSignal): Promise<FeedResponse> {
  const response = await fetch(endpoint, { cache: 'no-store', signal });
  const data = (await response.json().catch(() => ({}))) as FeedResponse;
  if (!response.ok) throw new Error(data.error || 'Could not load housing');
  return data;
}

export function useHousingFeed(audience: CampusAudience) {
  const endpoint = housingPostsEndpoint(audience);
  const [items, setItems] = useState<HousingFeedListing[]>([]);
  const [campus, setCampus] = useState<HousingCampusRef | null>(null);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [error, setError] = useState('');
  const pendingSaves = useRef(new Set<string>());
  const latest = useRef(0);

  const apply = useCallback((request: number, data: FeedResponse) => {
    if (request !== latest.current) return;
    setItems(Array.isArray(data.items) ? data.items : []);
    setCampus(data.campus ?? null);
    setError('');
    setStatus('ready');
  }, []);

  const fail = useCallback((request: number, cause: unknown) => {
    if (request !== latest.current) return;
    if (cause instanceof DOMException && cause.name === 'AbortError') return;
    setError(cause instanceof Error && cause.message ? cause.message : 'Could not load housing');
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
  const toggleSave = useCallback(async (listing: Pick<HousingFeedListing, 'id' | 'isSaved'>) => {
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
        body: JSON.stringify({ action: next ? 'save' : 'unsave', contentType: 'housing', contentId: listing.id }),
      });
      if (!response.ok) throw new Error('save failed');
    } catch {
      setSaved(!next);
    } finally {
      pendingSaves.current.delete(listing.id);
    }
  }, []);

  return { items, campus, status, error, reload, toggleSave };
}

// ---------------------------------------------------------------------------
// Filtering

export interface HousingFilterState {
  q: string;
  /** Distance ring in metres. */
  ring: DistanceRing;
  kind: 'all' | HousingKind;
  /** 'anyone' means no gender filter. */
  gender: GenderPref;
  /** Collapse agent posts into one digest row. */
  fromStudents: boolean;
  /** Also show posts beyond the ring. */
  showFarther: boolean;
}

export interface HousingView<T> {
  parsed: ParsedQuery;
  /** True when the search names an area or landmark: the ring is then ignored. */
  placeSearch: boolean;
  /** Student posts inside the ring (or every match on a place search). */
  near: T[];
  /** Student posts beyond the ring, shown once 'Show N farther' is tapped. */
  farther: T[];
  /** Posts beyond the ring that are still hidden. */
  hiddenFarther: number;
  /** Agent posts collapsed into the digest row (From students on). */
  agents: T[];
  /** Every post matching search and chips, at any distance. */
  matched: number;
}

type FilterableListing = Pick<
  HousingFeedListing,
  'title' | 'description' | 'serial' | 'collegeId' | 'kind' | 'stayType' | 'rentPp' | 'whoCanStay' | 'postedAs' | 'brokerage' | 'distanceM'
> & { place: Pick<HousingFeedListing['place'], 'landmarkId' | 'label' | 'area' | 'roughDistanceM'> };

/** Agent posts: a broker's listing, or any post that charges brokerage. */
export function isAgentPost(item: Pick<HousingFeedListing, 'postedAs' | 'brokerage'>): boolean {
  return item.postedAs === 'agent' || item.brokerage?.charged === true;
}

function distanceOf(item: FilterableListing): number | null {
  const meters = item.distanceM ?? item.place.roughDistanceM;
  return typeof meters === 'number' && Number.isFinite(meters) ? meters : null;
}

/**
 * Splits the feed for the current filters. Posts with no known distance stay
 * in the near list, so a missing place never hides a post.
 */
export function selectHousingView<T extends FilterableListing>(
  items: readonly T[],
  filters: HousingFilterState,
  context: SearchContext & { audience: CampusAudience },
): HousingView<T> {
  const parsed = parseQuery(filters.q, context);
  const searching = !isEmptyQuery(parsed);
  const placeSearch = parsed.areaIds.length > 0 || parsed.landmarkIds.length > 0;

  const matches = items.filter((item) => {
    // Girls' space shows girls posts only, whatever the stored doc says.
    if (context.audience === 'girls' && item.whoCanStay === 'boys') return false;
    if (filters.kind !== 'all' && item.kind !== filters.kind) return false;
    if (filters.gender !== 'anyone' && item.whoCanStay !== 'anyone' && item.whoCanStay !== filters.gender) return false;
    return !searching || matchItem(item, parsed);
  });

  const inside: T[] = [];
  const outside: T[] = [];
  for (const item of matches) {
    const meters = distanceOf(item);
    if (placeSearch || meters === null || withinRing(meters, filters.ring)) inside.push(item);
    else outside.push(item);
  }
  outside.sort((a, b) => (distanceOf(a) ?? 0) - (distanceOf(b) ?? 0));

  const shownOutside = filters.showFarther ? outside : [];
  const agents = filters.fromStudents ? [...inside, ...shownOutside].filter(isAgentPost) : [];
  const keep = (item: T) => !(filters.fromStudents && isAgentPost(item));

  return {
    parsed,
    placeSearch,
    near: inside.filter(keep),
    farther: shownOutside.filter(keep),
    hiddenFarther: filters.showFarther ? 0 : outside.length,
    agents,
    matched: matches.length,
  };
}

/** The place a search names: the area, else the landmark's label. Null when none. */
export function searchedPlace(parsed: ParsedQuery): string | null {
  if (parsed.areaIds.length > 0) return parsed.areaIds[0];
  const id = parsed.landmarkIds[0];
  if (!id) return null;
  for (const campus of listCampuses()) {
    const landmark = campus.landmarks.find((entry) => entry.id === id);
    if (landmark) return landmark.label;
  }
  return null;
}

const ASK_PLACE_MAX = 40;

/**
 * The empty-search ask. 'kothnur' -> 'Any room near Kothanur available?';
 * a search without a place -> 'Any room under 9k available?'.
 */
export function housingAsk(q: string, area: string | null): { text: string; area: string | null } {
  if (area) {
    const place = area.slice(0, ASK_PLACE_MAX);
    return { text: `Any room near ${place} available?`, area: place };
  }
  const words = q.trim();
  return { text: askText(/\broom/i.test(words) ? words : `room ${words}`), area: null };
}
