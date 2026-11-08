// Demo stand-in for the `razorpay` Node SDK (webpack alias, demo dev build only).
// The real routes (/api/razorpay/order, /api/razorpay/verify) run unchanged on it.
// The store and signing helpers live in src/lib/demo/server/razorpay.ts.
// Anything else on the SDK throws 'Not in the demo: razorpay.<name>'.
// Server only. Node tests import it, so runtime imports are relative.

import { getAdminDb } from '../../firebase/admin.ts';
import { isDemoMode } from '../mode.ts';

export * from '../server/razorpay.ts';
import { captureDemoPayment, createDemoOrder, fetchDemoOrder, fetchDemoOrderPayments, fetchDemoPayment, notInDemo, validateWebhookSignature } from '../server/razorpay.ts';
import type { DemoOrderCreateParams, DemoRazorpayOrder, DemoRazorpayPayment } from '../server/razorpay.ts';

// ---------------------------------------------------------------------------
// The SDK class

export interface RazorpayOptions {
  key_id?: string;
  key_secret?: string;
  headers?: Record<string, string>;
}

/** Wraps a namespace so any method the demo lacks throws 'Not in the demo: razorpay.<ns>.<method>'. */
function guarded<T extends object>(name: string, target: T): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      if (typeof property === 'symbol' || property === 'then') return Reflect.get(object, property, receiver);
      if (property in object) return Reflect.get(object, property, receiver);
      return () => {
        throw notInDemo(`${name}.${property}`);
      };
    },
  });
}

const KNOWN_MEMBERS = new Set(['orders', 'payments', 'key_id', 'key_secret', 'constructor']);

export default class Razorpay {
  static validateWebhookSignature(body: string, signature: string, secret: string): boolean {
    return validateWebhookSignature(body, signature, secret);
  }

  readonly key_id: string;
  readonly key_secret: string;
  readonly orders: {
    create: (params: DemoOrderCreateParams) => Promise<DemoRazorpayOrder>;
    fetch: (orderId: string) => Promise<DemoRazorpayOrder>;
    fetchPayments: (orderId: string) => Promise<{ entity: 'collection'; count: number; items: DemoRazorpayPayment[] }>;
  };
  readonly payments: {
    fetch: (paymentId: string) => Promise<DemoRazorpayPayment>;
    capture: (paymentId: string, amount: number | string, currency?: string) => Promise<DemoRazorpayPayment>;
  };

  constructor(options: RazorpayOptions = {}) {
    if (!isDemoMode()) throw notInDemo('razorpay');
    if (!options.key_id) throw new Error('`key_id` or `oauthToken` is mandatory');
    if (!options.key_secret) throw new Error('`key_secret` is mandatory');
    this.key_id = options.key_id;
    this.key_secret = options.key_secret;
    const db = () => getAdminDb();
    this.orders = guarded('razorpay.orders', {
      create: (params: DemoOrderCreateParams) => createDemoOrder(db(), params),
      fetch: (orderId: string) => fetchDemoOrder(db(), orderId),
      fetchPayments: (orderId: string) => fetchDemoOrderPayments(db(), orderId),
    });
    this.payments = guarded('razorpay.payments', {
      fetch: (paymentId: string) => fetchDemoPayment(db(), paymentId),
      capture: (paymentId: string, amount: number | string, currency?: string) => captureDemoPayment(db(), paymentId, amount, currency),
    });
    // Any other SDK namespace (customers, refunds, ...) is outside the demo.
    return new Proxy(this, {
      get(object, property, receiver) {
        if (typeof property === 'symbol' || property === 'then' || KNOWN_MEMBERS.has(property) || property in object) {
          return Reflect.get(object, property, receiver);
        }
        return guarded(`razorpay.${property}`, {});
      },
    });
  }
}
