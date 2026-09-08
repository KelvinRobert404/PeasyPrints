'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CampusSession } from '@/types/campus';

const EMPTY_SESSION: CampusSession = {
  signedIn: false,
  membership: null,
  verifiedStudent: false,
  girlsSpaceApproved: false,
  unreadContactRequests: 0,
};

export function useCampusSession() {
  const [session, setSession] = useState<CampusSession>(EMPTY_SESSION);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/campus/session', { cache: 'no-store' });
      const data = await response.json();
      setSession(response.ok ? data : EMPTY_SESSION);
    } catch {
      setSession(EMPTY_SESSION);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { session, loading, refresh };
}

