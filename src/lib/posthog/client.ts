/*
 Browser-only PostHog client using posthog-js
*/
import type { AnalyticsEventName, BaseEventProperties } from '@/types/analytics';

type PostHogJs = typeof import('posthog-js');

let posthogJsSingleton: import('posthog-js').PostHog | null = null;
let posthogJsLoaded = false;

function getPublicKey() {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
}

function getPublicHost() {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || undefined;
}

async function ensurePosthogJsInit(): Promise<import('posthog-js').PostHog | null> {
  if (typeof window === 'undefined') return null;
  if (posthogJsSingleton) return posthogJsSingleton;

  const key = getPublicKey();
  if (!key) return null;

  const phModule: PostHogJs = await import('posthog-js');
  if (!posthogJsLoaded) {
    phModule.init(key, {
      api_host: getPublicHost(),
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_cookie: false,
      session_recording: {
        maskAllInputs: true,
        maskAllText: true,
        maskFormFields: true,
        captureNetwork: false,
        maskTextSelector: 'canvas, [data-ph-no-capture], [data-ph-mask]',
        maskInputOptions: { password: true, email: true, tel: true, text: true },
      },
      persistence: 'localStorage+cookie',
      request_batching: true,
      loaded: (ph) => {
        posthogJsSingleton = ph;
        posthogJsLoaded = true;
      },
    });
  }
  // @ts-ignore
  posthogJsSingleton = (window.posthog as import('posthog-js').PostHog) || posthogJsSingleton;
  return posthogJsSingleton;
}

export async function identifyUser(distinctId: string, props?: Record<string, any>): Promise<void> {
  const ph = await ensurePosthogJsInit();
  if (!ph) return;
  try { ph.identify(distinctId, sanitizeProps(props)); } catch {}
}

export async function resetUser(): Promise<void> {
  const ph = await ensurePosthogJsInit();
  if (!ph) return;
  try { ph.reset(); } catch {}
}

export async function captureEvent<T extends AnalyticsEventName>(
  event: T,
  properties?: BaseEventProperties & Record<string, any>
): Promise<void> {
  const ph = await ensurePosthogJsInit();
  if (!ph) return;
  try { ph.capture(event, sanitizeProps(properties)); } catch {}
}

export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const ph = await ensurePosthogJsInit();
  if (!ph) return false;
  try { return !!ph.isFeatureEnabled(flagKey); } catch { return false; }
}

export async function getFeatureFlag(flagKey: string): Promise<any> {
  const ph = await ensurePosthogJsInit();
  if (!ph) return undefined;
  try { return ph.getFeatureFlag(flagKey); } catch { return undefined; }
}

export async function startSessionRecording(): Promise<void> {
  const ph = await ensurePosthogJsInit();
  if (!ph) return;
  // @ts-ignore
  try { ph.startSessionRecording?.(); } catch {}
}

export async function stopSessionRecording(): Promise<void> {
  const ph = await ensurePosthogJsInit();
  if (!ph) return;
  // @ts-ignore
  try { ph.stopSessionRecording?.(); } catch {}
}

function sanitizeProps<T extends Record<string, any> | undefined>(props: T): T {
  if (!props) return props;
  const cloned: any = { ...props };
  if (typeof cloned.fileUrl === 'string') cloned.fileUrl = '[redacted]';
  if (typeof cloned.fileName === 'string') cloned.fileName = anonymizeFilename(cloned.fileName);
  if (cloned.pdfBuffer) delete cloned.pdfBuffer;
  if (cloned.token) delete cloned.token;
  if (cloned.privateKey) delete cloned.privateKey;
  return cloned;
}

function anonymizeFilename(name: string): string {
  const idx = name.lastIndexOf('.');
  const ext = idx >= 0 ? name.slice(idx) : '';
  return `file${ext || ''}`;
}


