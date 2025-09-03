/*
PostHog client wrapper. Initializes lazily on first use.
*/
import type { AnalyticsEventName, BaseEventProperties } from '@/types/analytics';
import posthog from 'posthog-js';

let posthogInitialized = false;

function ensurePosthogInit(): void {
  if (posthogInitialized) return;
  if (typeof window === 'undefined') return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY as string | undefined;
  if (!apiKey) {
    return;
  }
  const apiHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST as string | undefined) || '/ingest';
  posthog.init(apiKey, {
    api_host: apiHost,
    capture_pageview: false,
    mask_all_text: true,
    mask_all_attributes: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only'
  });
  posthogInitialized = true;
}

export async function identifyUser(distinctId: string, props?: Record<string, any>): Promise<void> {
  ensurePosthogInit();
  if (!posthogInitialized) return;
  try {
    posthog.identify(distinctId, props);
  } catch {}
}

export async function resetUser(): Promise<void> {
  if (!posthogInitialized) return;
  try { posthog.reset(); } catch {}
}

export async function captureEvent<T extends AnalyticsEventName>(
  event: T,
  properties?: BaseEventProperties & Record<string, any>
): Promise<void> {
  ensurePosthogInit();
  if (!posthogInitialized) return;
  try {
    posthog.capture(event as string, properties);
  } catch {}
}

export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  ensurePosthogInit();
  if (!posthogInitialized) return false;
  try {
    const res = await (posthog as any).isFeatureEnabledAsync?.(flagKey);
    if (typeof res === 'boolean') return res;
    return Boolean(posthog.isFeatureEnabled(flagKey));
  } catch {
    return false;
  }
}

export async function getFeatureFlag(flagKey: string): Promise<any> {
  ensurePosthogInit();
  if (!posthogInitialized) return undefined;
  try { return posthog.getFeatureFlag(flagKey); } catch { return undefined; }
}

export async function startSessionRecording(): Promise<void> {
  ensurePosthogInit();
  if (!posthogInitialized) return;
  try { (posthog as any).startSessionRecording?.(); } catch {}
}

export async function stopSessionRecording(): Promise<void> {
  if (!posthogInitialized) return;
  try { (posthog as any).stopSessionRecording?.(); } catch {}
}
