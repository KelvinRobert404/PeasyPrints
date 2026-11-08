// Reset demo: back to the sample data, signed out, as a brand new visitor.
// The server drops the visitor's world and gives them a new visitor id; this
// clears everything the browser kept for the demo, then opens /demo.

import { deleteOverlayStore, haltPersistence, resumePersistence } from '@/lib/demo/client/persist';

const RESET_URL = '/api/demo/reset';
const DEMO_KEY_PREFIX = 'swoop-demo:';
/** App keys a visitor's demo run leaves behind. */
const APP_KEYS = [
  // College pick (src/lib/stores/collegeStore.ts).
  'college-store',
  // Analytics choice (src/components/privacy/AnalyticsConsent.tsx).
  'peasy_analytics_consent',
  // Blood donor WhatsApp number (app/campus/blood/page.tsx).
  'swoop.blood.whatsapp',
];

function clearLocalStorage(): void {
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null && key.startsWith(DEMO_KEY_PREFIX)) keys.push(key);
    }
    for (const key of [...keys, ...APP_KEYS]) storage.removeItem(key);
  } catch {
    // Storage blocked: nothing kept there to clear.
  }
}

function clearSessionStorage(): void {
  try {
    window.sessionStorage.clear();
  } catch {
    // Storage blocked: nothing kept there to clear.
  }
}

/** Resets the demo and opens /demo. Throws if the server could not reset; nothing is cleared then. */
export async function resetDemo(): Promise<void> {
  // Stop saving first, so no pull in flight writes the old changes back.
  haltPersistence();
  let response: Response;
  try {
    response = await fetch(RESET_URL, { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  } catch {
    resumePersistence();
    throw new Error('Could not reach the demo server.');
  }
  if (!response.ok) {
    resumePersistence();
    throw new Error('Could not reset the demo.');
  }
  await deleteOverlayStore();
  clearLocalStorage();
  clearSessionStorage();
  window.location.assign('/demo');
}
