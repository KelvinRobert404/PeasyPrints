// Demo stand-in for Razorpay Checkout (window.Razorpay). loadRazorpay()
// installs it in the demo instead of loading checkout.razorpay.com.
//
// Same surface CheckoutButton uses: new Razorpay(options), .on('payment.failed'),
// .open(), options.handler and options.modal.ondismiss. open() shows
// DemoPaySheet in its own React root; Pay and Payment fails post to
// /api/demo/razorpay/pay, which plays Razorpay's servers.
//
// Browser only, but nothing here touches window or document at import.

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DemoPaySheet } from '@/components/demo/DemoPaySheet';
import type { DemoHandlerResponse, DemoPaymentError } from '@/lib/demo/server/razorpay';

export const DEMO_PAY_ENDPOINT = '/api/demo/razorpay/pay';

export interface DemoCheckoutOptions {
  key?: string;
  amount: number | string;
  currency?: string;
  name?: string;
  description?: string;
  order_id: string;
  handler?: (response: DemoHandlerResponse) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
  [option: string]: unknown;
}

export interface DemoPaymentFailedEvent {
  error: DemoPaymentError;
}

type Listener = (event: DemoPaymentFailedEvent) => void;

type PayResult =
  | ({ ok: true } & DemoHandlerResponse)
  | { ok: false; error: DemoPaymentError };

function isPayResult(value: unknown): value is PayResult {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  if (body.ok === true) {
    return typeof body.razorpay_payment_id === 'string' && typeof body.razorpay_order_id === 'string' && typeof body.razorpay_signature === 'string';
  }
  return body.ok === false && !!body.error && typeof body.error === 'object';
}

async function postPayment(orderId: string, fail: boolean): Promise<PayResult> {
  let response: Response;
  try {
    response = await fetch(DEMO_PAY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ order_id: orderId, fail }),
    });
  } catch {
    throw new Error('Could not reach the demo. Try again.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isPayResult(body)) {
    const message = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : null;
    throw new Error(message || 'The demo payment did not go through.');
  }
  return body;
}

export class DemoRazorpay {
  private readonly options: DemoCheckoutOptions;
  private readonly listeners = new Map<string, Listener[]>();
  private host: HTMLDivElement | null = null;
  private root: Root | null = null;

  constructor(options: DemoCheckoutOptions) {
    if (!options || typeof options.order_id !== 'string' || options.order_id.length === 0) {
      throw new Error('Demo checkout needs an order_id');
    }
    this.options = options;
  }

  on(event: string, listener: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  open(): void {
    if (this.root || typeof document === 'undefined') return;
    const host = document.createElement('div');
    host.dataset.demoPaySheet = '';
    document.body.appendChild(host);
    this.host = host;
    this.root = createRoot(host);
    this.root.render(
      createElement(DemoPaySheet, {
        amountPaise: Number(this.options.amount) || 0,
        description: typeof this.options.description === 'string' ? this.options.description : undefined,
        onPay: () => this.pay(false),
        onFail: () => this.pay(true),
        onCancel: () => this.dismiss(),
      })
    );
  }

  close(): void {
    const root = this.root;
    const host = this.host;
    this.root = null;
    this.host = null;
    if (!root) return;
    // Unmount after the current event, never from inside the sheet's own handler.
    setTimeout(() => {
      root.unmount();
      host?.remove();
    }, 0);
  }

  private dismiss(): void {
    if (!this.root) return;
    this.close();
    this.options.modal?.ondismiss?.();
  }

  private emit(event: string, payload: DemoPaymentFailedEvent): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[demo] ${event} listener failed`, error);
      }
    }
  }

  private async pay(fail: boolean): Promise<void> {
    const result = await postPayment(this.options.order_id, fail);
    this.close();
    if (!result.ok) {
      this.emit('payment.failed', { error: result.error });
      return;
    }
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = result;
    // Like Checkout: hand over and move on; the page's handler owns what follows.
    const pending = this.options.handler?.({ razorpay_payment_id, razorpay_order_id, razorpay_signature });
    if (pending instanceof Promise) pending.catch((error: unknown) => console.error('[demo] payment handler failed', error));
  }
}

/** Puts the stand-in on window.Razorpay. Call only in the demo, in the browser. */
export function installDemoRazorpay(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { Razorpay: typeof DemoRazorpay }).Razorpay = DemoRazorpay;
}
