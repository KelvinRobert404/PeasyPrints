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
      const email = user?.emailAddresses?.[0]?.emailAddress;
      const phone = user?.phoneNumbers?.[0]?.phoneNumber;
      const safeProps = {
        email: email ? hashLike(email) : undefined,
        phone: phone ? hashLike(phone) : undefined,
        name: user?.fullName || user?.username || undefined,
        provider: 'clerk',
      };
      identifyUser(distinctId, safeProps);
    }
  }, [isLoaded, distinctId, user?.fullName, user?.username, user?.emailAddresses, user?.phoneNumbers]);

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

// Minimal irreversible transform for PII markers used only for identification props
function hashLike(input: string): string {
  try {
    const data = new TextEncoder().encode(input);
    return Array.from(new Uint8Array(data.slice(0, 12)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return 'redacted';
  }
}


