"use client";

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { captureEvent, identifyUser, isFeatureEnabled, getFeatureFlag } from '@/lib/posthog/client';
import type { AnalyticsEventName, BaseEventProperties } from '@/types/analytics';
import { useUser } from '@clerk/nextjs';
import { isDemoMode } from '@/lib/demo/mode';

function useLivePosthog() {
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

// The demo sends no analytics: captures do nothing and every flag is off.
const demoPosthog = {
  capture: async <T extends AnalyticsEventName>(_event: T, _properties?: BaseEventProperties & Record<string, any>): Promise<void> => {},
  isFeatureEnabled: async (_flagKey: string): Promise<boolean> => false,
  getFeatureFlag: async (_flagKey: string): Promise<any> => undefined,
} as const;

function useDemoPosthog(): ReturnType<typeof useLivePosthog> {
  return demoPosthog;
}

export const usePosthog = isDemoMode() ? useDemoPosthog : useLivePosthog;

function buildBaseProps({ pathname }: { pathname?: string | null }): BaseEventProperties {
  if (typeof window === 'undefined') return {};
  return {
    $current_url: window.location.href,
    $pathname: pathname || window.location.pathname,
    $screen_width: window.innerWidth,
    $screen_height: window.innerHeight,
  };
}
