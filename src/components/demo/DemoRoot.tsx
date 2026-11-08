'use client';

// The demo's root mount: the first child of <body>, outside ClerkProvider.
// Renders nothing unless the demo is on, and nothing until mounted, so the
// server HTML matches and nothing here touches window during render.
// Demo pieces (PERSIST, DEMOBAR) mount inside DemoParts below.

import { useSyncExternalStore } from 'react';
import { isDemoMode } from '@/lib/demo/mode';
import { DemoPersistence } from '@/lib/demo/client/DemoPersistence';

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
    </>
  );
}

function DemoRootOn() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <DemoParts />;
}

function DemoRootOff() {
  return null;
}

export const DemoRoot = isDemoMode() ? DemoRootOn : DemoRootOff;
