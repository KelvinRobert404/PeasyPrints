import { isDemoMode } from '@/lib/demo/mode';

let loading: Promise<void> | null = null;

// Resolve only once the SDK has actually loaded; a script tag alone isn't enough
// (it may still be loading, or may have failed and needs a retry).
function loadRealRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));
  if ((window as any).Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    document.getElementById('razorpay-sdk')?.remove();
    const script = document.createElement('script');
    script.id = 'razorpay-sdk';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error('Failed to load Razorpay SDK'));
    };
    document.body.appendChild(script);
  });
  return loading;
}

// Demo: install the stand-in Checkout (src/lib/demo/client/checkout.ts) and
// never load checkout.razorpay.com. Imported lazily so other builds skip it.
async function loadDemoRazorpay(): Promise<void> {
  if (typeof window === 'undefined') throw new Error('Window not available');
  const { installDemoRazorpay } = await import('@/lib/demo/client/checkout');
  installDemoRazorpay();
}

export const loadRazorpay: () => Promise<void> = isDemoMode() ? loadDemoRazorpay : loadRealRazorpay;
