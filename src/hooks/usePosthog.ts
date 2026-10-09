"use client";

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { captureEvent, identifyUser, isFeatureEnabled, getFeatureFlag } from '@/lib/posthog/client';
import type { AnalyticsEventName, BaseEventProperties } from '@/types/analytics';
import { useUser } from '@clerk/nextjs';

export function usePosthog() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  const distinctId = useMemo(() => user?.id || undefined, [user?.id]);

  useEffect(() => {
    if (!isLoaded) return;
    // Identify or reset
    if (distinctId) {
      // Identify by Clerk id only; names, emails and phone numbers stay out of analytics.
      identifyUser(distinctId, { provider: 'clerk' });
    }
  }, [isLoaded, distinctId]);

  useEffect(() => {
    // Page view event for manual funnels
    const props = buildBaseProps({ pathname });
    captureEvent('page_view', props);
  }, [pathname]);

  return {
    capture: <T extends AnalyticsEventName>(event: T, properties?: BaseEventProperties & Record<string, any>) =>
      captureEvent(event, { ...buildBaseProps({ pathname }), ...properties }),
    isFeatureEnabled,
    getFeatureFlag,
  } as const;
}

function buildBaseProps({ pathname }: { pathname?: string | null }): BaseEventProperties {
  if (typeof window === 'undefined') return {};
  return {
    $current_url: window.location.href,
    $pathname: pathname || window.location.pathname,
    $screen_width: window.innerWidth,
    $screen_height: window.innerHeight,
  };
}
