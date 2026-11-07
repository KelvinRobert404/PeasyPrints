'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampusConfigPayload } from '@/lib/campus/membership';

export type CampusConfig = CampusConfigPayload;

/**
 * The signed-in member's campus config: origin, landmarks, pickup points and product flags.
 * Null until loaded, or when the member is not verified or has not picked a campus.
 */
export function useCampusConfig() {
  const [config, setConfig] = useState<CampusConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    try {
      const response = await fetch('/api/campus/config', { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (request !== latest.current) return;
      if (response.ok && data) {
        setConfig(data as CampusConfig);
        setError(null);
      } else {
        setConfig(null);
        setError(typeof data?.error === 'string' ? data.error : 'Could not load your campus');
      }
    } catch {
      if (request !== latest.current) return;
      setConfig(null);
      setError('Could not load your campus');
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { config, loading, error, refresh };
}
