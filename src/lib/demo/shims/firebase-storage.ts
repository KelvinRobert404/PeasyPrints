// Demo stand-in for 'firebase/storage' (aliased in the demo dev build only, see
// src/lib/demo/build-config.cjs). Never talks to Google.
//
// ref and getDownloadURL work: the URL is an inline data: URL for a file in the
// visitor's sample bucket, fetched through /api/demo/firestore. Uploads from
// the browser reject; the demo uploads through its own API routes instead.

import { getApp } from './firebase-app.ts';
import type { FirebaseApp } from './firebase-app.ts';

const DEMO_ENDPOINT = '/api/demo/firestore';
const DEMO_BUCKET = 'swoop-demo';

interface StorageError extends Error {
  code: string;
}

function storageError(code: string, message: string): StorageError {
  return Object.assign(new Error(message), { name: 'FirebaseError', code: `storage/${code}` });
}

function notInDemo(name: string): StorageError {
  return storageError('unauthorized', `Not in the demo: ${name}`);
}

// ---------------------------------------------------------------------------
// Service and references

export interface FirebaseStorage {
  readonly app: FirebaseApp;
  maxUploadRetryTime: number;
  maxOperationRetryTime: number;
}

const storages = new Map<string, FirebaseStorage>();

/** Never throws, with or without env. */
export function getStorage(app?: FirebaseApp): FirebaseStorage {
  const target = app ?? getApp();
  let storage = storages.get(target.name);
  if (!storage) {
    storage = { app: target, maxUploadRetryTime: 0, maxOperationRetryTime: 0 };
    storages.set(target.name, storage);
  }
  return storage;
}

function normalizePath(path: string): string {
  return path.split('/').filter((segment) => segment.length > 0).join('/');
}

export class StorageReference {
  readonly storage: FirebaseStorage;
  readonly fullPath: string;
  readonly bucket = DEMO_BUCKET;

  constructor(storage: FirebaseStorage, fullPath: string) {
    this.storage = storage;
    this.fullPath = normalizePath(fullPath);
  }

  get name(): string {
    return this.fullPath.slice(this.fullPath.lastIndexOf('/') + 1);
  }

  get root(): StorageReference {
    return new StorageReference(this.storage, '');
  }

  get parent(): StorageReference | null {
    if (!this.fullPath) return null;
    const index = this.fullPath.lastIndexOf('/');
    return new StorageReference(this.storage, index < 0 ? '' : this.fullPath.slice(0, index));
  }

  toString(): string {
    return `gs://${this.bucket}/${this.fullPath}`;
  }
}

export function ref(storageOrRef: FirebaseStorage | StorageReference, path?: string): StorageReference {
  if (storageOrRef instanceof StorageReference) {
    return new StorageReference(storageOrRef.storage, path ? `${storageOrRef.fullPath}/${path}` : storageOrRef.fullPath);
  }
  if (path && /^(gs|https?):\/\//i.test(path)) throw notInDemo('ref with a URL');
  return new StorageReference(storageOrRef, path ?? '');
}

// ---------------------------------------------------------------------------
// Download URLs

export async function getDownloadURL(reference: StorageReference): Promise<string> {
  if (typeof window === 'undefined') throw notInDemo('getDownloadURL on the server');
  if (!reference.fullPath) throw storageError('invalid-root-operation', 'Cannot get a URL for the bucket root.');
  let response: Response;
  try {
    response = await fetch(DEMO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ op: 'downloadUrl', path: reference.fullPath }),
    });
  } catch {
    throw storageError('retry-limit-exceeded', 'Could not reach the demo server.');
  }
  const body = (await response.json().catch(() => null)) as { url?: unknown; error?: { code?: unknown; message?: unknown } } | null;
  if (response.ok && typeof body?.url === 'string') return body.url;
  const code = body?.error?.code === 'not-found' ? 'object-not-found' : 'unknown';
  const message = typeof body?.error?.message === 'string' ? body.error.message : 'Could not open this sample file.';
  throw storageError(code, message);
}

// ---------------------------------------------------------------------------
// Uploads: always rejected in the demo

export interface UploadTaskSnapshot {
  bytesTransferred: number;
  totalBytes: number;
  state: 'running' | 'paused' | 'success' | 'canceled' | 'error';
  ref: StorageReference;
  task: UploadTask;
  metadata: Record<string, unknown>;
}

type TaskObserver = {
  next?: (snapshot: UploadTaskSnapshot) => void;
  error?: (error: Error) => void;
  complete?: () => void;
};

export class UploadTask {
  readonly snapshot: UploadTaskSnapshot;
  private readonly failure: StorageError;
  private readonly settled: Promise<UploadTaskSnapshot>;

  constructor(reference: StorageReference, name: string) {
    this.failure = notInDemo(name);
    this.snapshot = { bytesTransferred: 0, totalBytes: 0, state: 'error', ref: reference, task: this, metadata: {} };
    this.settled = Promise.reject(this.failure);
    // Callers that never await the task should not see an unhandled rejection.
    this.settled.catch(() => undefined);
  }

  on(
    _event: string,
    nextOrObserver?: ((snapshot: UploadTaskSnapshot) => void) | TaskObserver | null,
    error?: ((error: Error) => void) | null,
  ): () => void {
    void _event;
    const onError = typeof nextOrObserver === 'object' && nextOrObserver !== null ? nextOrObserver.error : error;
    let active = true;
    queueMicrotask(() => {
      if (active) onError?.(this.failure);
    });
    return () => {
      active = false;
    };
  }

  then<T1 = UploadTaskSnapshot, T2 = never>(
    onFulfilled?: ((snapshot: UploadTaskSnapshot) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return this.settled.then(onFulfilled, onRejected);
  }

  catch<T = never>(onRejected?: ((reason: unknown) => T | PromiseLike<T>) | null): Promise<UploadTaskSnapshot | T> {
    return this.settled.catch(onRejected);
  }

  cancel(): boolean {
    return false;
  }

  pause(): boolean {
    return false;
  }

  resume(): boolean {
    return false;
  }
}

export function uploadBytesResumable(reference: StorageReference, _data?: unknown, _metadata?: unknown): UploadTask {
  void _data;
  void _metadata;
  return new UploadTask(reference, 'uploadBytesResumable');
}

export async function uploadBytes(_reference?: StorageReference, _data?: unknown, _metadata?: unknown): Promise<never> {
  void _reference;
  void _data;
  void _metadata;
  throw notInDemo('uploadBytes');
}

export async function uploadString(_reference?: StorageReference, _data?: unknown): Promise<never> {
  void _reference;
  void _data;
  throw notInDemo('uploadString');
}

export async function deleteObject(_reference?: StorageReference): Promise<never> {
  void _reference;
  throw notInDemo('deleteObject');
}

export async function listAll(_reference?: StorageReference): Promise<never> {
  void _reference;
  throw notInDemo('listAll');
}

export async function getMetadata(_reference?: StorageReference): Promise<never> {
  void _reference;
  throw notInDemo('getMetadata');
}

export function connectStorageEmulator(): void {
  throw notInDemo('connectStorageEmulator');
}
