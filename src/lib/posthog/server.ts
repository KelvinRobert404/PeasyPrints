/*
PostHog server wrapper. Initializes lazily.
*/
import type { AnalyticsEventName, BaseEventProperties } from '@/types/analytics';
import { PostHog } from 'posthog-node';

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
  if (!client) return;
  try { client.shutdown(); } catch {}
}
