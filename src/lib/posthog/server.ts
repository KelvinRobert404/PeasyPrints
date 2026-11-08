/*
PostHog server wrapper. Initializes lazily.
*/
import type { AnalyticsEventName, BaseEventProperties } from '@/types/analytics';
import { PostHog } from 'posthog-node';
import { isDemoMode } from '@/lib/demo/mode';

// The demo sends no analytics: capture and shutdown do nothing there.
const DEMO = isDemoMode();

let client: PostHog | null = null;

function ensureServerClient(): void {
  if (client) return;
  const apiKey = process.env.POSTHOG_API_KEY as string | undefined;
  if (!apiKey) return;
  const host = (process.env.POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';
  client = new PostHog(apiKey, { host });
}

export async function captureServerEvent<T extends AnalyticsEventName>({
  distinctId,
  event,
  properties
}: {
  distinctId?: string;
  event: T;
  properties?: BaseEventProperties & Record<string, any>;
}): Promise<void> {
  if (DEMO) return;
  ensureServerClient();
  if (!client) return;
  try {
    await client.capture({
      distinctId: distinctId || 'anonymous',
      event: event as string,
      properties
    });
  } catch {}
}

export function shutdownServerAnalytics(): void {
  if (DEMO) return;
  if (!client) return;
  try { client.shutdown(); } catch {}
}
