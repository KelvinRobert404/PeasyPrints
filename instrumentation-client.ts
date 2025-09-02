import posthog from "posthog-js";

// Auto-loaded by Next.js to initialize PostHog (wizard)
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
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