// Demo stand-in for 'firebase/app' (aliased in the demo dev build only, see
// src/lib/demo/build-config.cjs). No Firebase project: initializeApp keeps the
// options it is given (empty without env) and never talks to Google.

const DEFAULT_APP_NAME = '[DEFAULT]';

export interface FirebaseOptions {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  databaseURL?: string;
}

export interface FirebaseApp {
  readonly name: string;
  readonly options: FirebaseOptions;
  automaticDataCollectionEnabled: boolean;
}

export const SDK_VERSION = 'demo';

const apps = new Map<string, FirebaseApp>();

function notInDemo(name: string): Error {
  return new Error(`Not in the demo: ${name}`);
}

export function initializeApp(options: FirebaseOptions = {}, nameOrConfig?: string | { name?: string }): FirebaseApp {
  const name = (typeof nameOrConfig === 'string' ? nameOrConfig : nameOrConfig?.name) || DEFAULT_APP_NAME;
  const existing = apps.get(name);
  if (existing) return existing;
  const app: FirebaseApp = { name, options: { ...options }, automaticDataCollectionEnabled: false };
  apps.set(name, app);
  return app;
}

export function getApps(): FirebaseApp[] {
  return [...apps.values()];
}

export function getApp(name: string = DEFAULT_APP_NAME): FirebaseApp {
  return apps.get(name) ?? initializeApp({}, name);
}

export async function deleteApp(app: FirebaseApp): Promise<void> {
  apps.delete(app.name);
}

export function registerVersion(): void {
  // Nothing to register in the demo.
}

export function setLogLevel(): void {
  // The demo has no Firebase logger.
}

export function onLog(): void {
  throw notInDemo('onLog');
}
