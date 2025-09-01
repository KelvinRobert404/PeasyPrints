/*
 Server-only PostHog client using posthog-node
*/
import type { AnalyticsEventName, BaseEventProperties } from '@/types/analytics';

let serverClient: import('posthog-node').PostHog | null = null;

function getServerKey() {
  return process.env.POSTHOG_API_KEY || process.env.POSTHOG_PERSONAL_API_KEY || '';
}

function getServerHost() {
  return process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || undefined;
}

function ensureServerClient(): import('posthog-node').PostHog | null {
  if (serverClient) return serverClient;
  const key = getServerKey();
  if (!key) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PostHog } = require('posthog-node') as typeof import('posthog-node');
  serverClient = new PostHog(key, { host: getServerHost(), flushAt: 1, flushInterval: 0 });
  return serverClient;
}

export async function captureServerEvent<T extends AnalyticsEventName>(params: {
  distinctId?: string;
  event: T;
  properties?: BaseEventProperties & Record<string, any>;
}): Promise<void> {
  try {
    const client = ensureServerClient();
    if (!client) return;
    client.capture({
      distinctId: params.distinctId || 'server',
      event: params.event,
      properties: params.properties || {},
      timestamp: new Date(),
    });
    await client.flushAsync?.();
  } catch {}
}

export function shutdownServerAnalytics(): void {
  try { ensureServerClient()?.shutdown(); } catch {}
}


