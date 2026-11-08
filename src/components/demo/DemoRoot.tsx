'use client';

// The demo's root mount: the first child of <body>, outside ClerkProvider.
// Renders nothing unless the demo is on, and no parts until mounted, so the
// server HTML matches and nothing here touches window during render.
// Demo pieces (PERSIST, DEMOBAR) mount inside DemoParts below. A hidden
// marker (same on server and client) tells globals.css the demo is on.

import { useSyncExternalStore } from 'react';
import { isDemoMode } from '@/lib/demo/mode';
import { DemoPersistence } from '@/lib/demo/client/DemoPersistence';
import { DemoBar } from '@/components/demo/DemoBar';

const subscribeNever = () => () => {};
const mountedOnClient = () => true;
const notMountedOnServer = () => false;

function useMounted(): boolean {
  return useSyncExternalStore(subscribeNever, mountedOnClient, notMountedOnServer);
}

/** The one place demo pieces mount. Add each one here, in order. */
function DemoParts() {
  return (
    <>
      <DemoPersistence />
      <DemoBar />
    </>
  );
}

function DemoRootOn() {
  const mounted = useMounted();
  // The marker renders on the server too, so globals.css reserves the demo
  // bar's height (--demo-bar-h) from the first paint, before the bar mounts.
  return (
    <>
      <span hidden data-swoop-demo="" />
      {mounted ? <DemoParts /> : null}
    </>
  );
}

function DemoRootOff() {
  return null;
}

export const DemoRoot = isDemoMode() ? DemoRootOn : DemoRootOff;
