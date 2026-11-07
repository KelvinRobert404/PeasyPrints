'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { create } from 'zustand';
import type { CampusSession } from '@/types/campus';

const EMPTY_SESSION: CampusSession = {
  signedIn: false,
  membership: null,
  verifiedStudent: false,
  girlsSpaceApproved: false,
  unreadContactRequests: 0,
};

type SessionState = {
  session: CampusSession;
  /** True until the first /api/campus/session answer lands. */
  loading: boolean;
};

/** One store for the whole tab: navbar, gate and pages share it. */
const useSessionStore = create<SessionState>()(() => ({ session: EMPTY_SESSION, loading: true }));

let started = false;
let latestRequest = 0;
let inflight: Promise<void> | null = null;
/** Clerk user id seen last; undefined until Clerk first loads. */
let seenUserId: string | null | undefined;

function fetchSession(): Promise<void> {
  const request = ++latestRequest;
  const run = (async () => {
    let next = EMPTY_SESSION;
    try {
      const response = await fetch('/api/campus/session', { cache: 'no-store' });
      const data = (await response.json()) as CampusSession;
      next = response.ok ? data : EMPTY_SESSION;
    } catch {
      next = EMPTY_SESSION;
    }
    // A newer request owns the store; drop this stale answer.
    if (request !== latestRequest) return;
    useSessionStore.setState({ session: next, loading: false });
  })();
  inflight = run;
  void run.finally(() => {
    if (inflight === run) inflight = null;
  });
  return run;
}

/** First caller starts the fetch; everyone else shares it. */
function ensureSession(): Promise<void> {
  if (!started) {
    started = true;
    return fetchSession();
  }
  return inflight ?? Promise.resolve();
}

/** Refetches the session for every subscriber. Stale data stays on screen meanwhile. */
function refreshSession(): Promise<void> {
  started = true;
  return fetchSession();
}

export function useCampusSession() {
  const session = useSessionStore((state) => state.session);
  const loading = useSessionStore((state) => state.loading);
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    void ensureSession();
  }, []);

  // Sign-in or sign-out without a full reload: refetch once for everyone.
  useEffect(() => {
    if (!isLoaded) return;
    const current = userId ?? null;
    if (seenUserId === undefined) {
      seenUserId = current;
      return;
    }
    if (seenUserId === current) return;
    seenUserId = current;
    void refreshSession();
  }, [isLoaded, userId]);

  return { session, loading, refresh: refreshSession };
}
