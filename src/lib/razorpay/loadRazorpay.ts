let loading: Promise<void> | null = null;

// Resolve only once the SDK has actually loaded; a script tag alone isn't enough
// (it may still be loading, or may have failed and needs a retry).
export function loadRazorpay(): Promise<void> {
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
