import posthog from "posthog-js";

// Auto-loaded by Next.js to initialize PostHog (wizard)
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    capture_exceptions: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: 'canvas, [data-ph-no-capture], [data-ph-mask]',
    },
    debug: process.env.NODE_ENV === "development",
  });
} else {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('PostHog disabled: NEXT_PUBLIC_POSTHOG_KEY is not set');
  }
}