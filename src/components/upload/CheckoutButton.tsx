'use client';

import { useEffect, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useUser } from '@clerk/nextjs';
import { uploadPdfAndGetUrl } from '@/lib/firebase/storageUpload';
import { loadRazorpay } from '@/lib/razorpay/loadRazorpay';
// import { createOrderDoc } from '@/lib/firebase/createOrder';
import { useRouter } from 'next/navigation';
import { usePosthog } from '@/hooks/usePosthog';
import { startSessionRecording, stopSessionRecording } from '@/lib/posthog/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CheckoutButton({ shopId, shopName }: { shopId: string; shopName?: string }) {
  const { file, pageCount, totalCost, settings } = useUploadStore();
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isLongWait, setIsLongWait] = useState(false);
  const router = useRouter();
  const { capture, isFeatureEnabled } = usePosthog();

  const handleCheckout = async () => {
    if (!isClerkLoaded || !clerkUser || !file || pageCount === 0 || totalCost <= 0) return;
    setLoading(true);
    try {
      // Conditionally enable session recording for checkout flow
      try {
        const enabled = await isFeatureEnabled('record_checkout');
        if (enabled) await startSessionRecording();
      } catch {}
      capture('checkout_clicked', {
        userId: clerkUser.id,
        shopId,
        shopName,
        totalPages: pageCount,
        totalCost,
        printSettings: settings,
      });
      // 1) Create Razorpay order first (match Flutter flow)
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalCost, currency: 'INR' })
      });
      const { order, error } = await orderRes.json();
      if (error || !order?.id) throw new Error(error || 'Failed to create Razorpay order');
      capture('razorpay_order_created', { razorpay_order_id: order.id, totalCost, userId: clerkUser.id });

      // 2) Load Razorpay SDK and open checkout quickly to keep click context
      await loadRazorpay();
      // @ts-ignore
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'PeasyPrints',
        description: file.name,
        order_id: order.id,
        prefill: {
          name: clerkUser.fullName || 'User',
          email: clerkUser.emailAddresses?.[0]?.emailAddress,
          contact: clerkUser.phoneNumbers?.[0]?.phoneNumber
        },
        theme: { color: '#2563eb' },
        handler: async (response: any) => {
          setProcessing(true);
          // Verify signature server-side per Razorpay docs
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const verify = await verifyRes.json();
          if (!verifyRes.ok || !verify.valid) {
            alert('Payment verification failed.');
            capture('razorpay_payment_failed', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              status: 'verification_failed',
            });
            setProcessing(false);
            return;
          }
          try {
            // 3) After successful payment, upload file and ask server to create the order
            const uid = clerkUser.id;
            const fileUrl = await uploadPdfAndGetUrl(uid, file);
            const res = await fetch('/api/orders/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shopId,
                shopName: shopName || '',
                userName: clerkUser.fullName || clerkUser.username || clerkUser.phoneNumbers?.[0]?.phoneNumber || clerkUser.emailAddresses?.[0]?.emailAddress || 'User',
                fileUrl,
                fileName: file.name,
                totalPages: pageCount,
                printSettings: settings
              })
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              capture('order_creation_failed', { error: data?.error || 'Failed to create order' });
              throw new Error(data?.error || 'Failed to create order');
            }
            capture('razorpay_payment_succeeded', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              status: 'paid',
            });
            capture('order_created', { shopId, totalPages: pageCount, totalCost });
            router.replace('/orders');
          } catch (err: any) {
            alert(err?.message || 'Order finalization failed');
            capture('error', { error: err?.message || 'Order finalization failed' });
            setProcessing(false);
          }
        }
      });
      rzp.on('payment.failed', function (resp: any) {
        console.error('Razorpay payment failed', resp?.error);
        alert('Payment failed. Please try again.');
        capture('razorpay_payment_failed', { status: 'failed' });
      });
      rzp.open();
    } catch (e: any) {
      alert(e?.message || 'Checkout failed');
      capture('error', { error: e?.message || 'Checkout failed' });
    } finally {
      setLoading(false);
      try { await stopSessionRecording(); } catch {}
    }
  };

  // Show long-wait hint if processing takes >60s
  useEffect(() => {
    if (!processing) {
      setIsLongWait(false);
      return;
    }
    const timer = setTimeout(() => setIsLongWait(true), 60000);
    return () => clearTimeout(timer);
  }, [processing]);

  return (
    <>
      <button
        onClick={handleCheckout}
        disabled={loading || !file || totalCost <= 0 || !isClerkLoaded || !clerkUser}
        className="w-full h-14 bg-blue-600 text-white rounded-xl disabled:opacity-50 font-quinn text-[24px]"
        style={{ letterSpacing: '0.02em' }}
      >
        {loading ? 'PROCESSING…' : 'CHECKOUT'}
      </button>

      <Dialog open={processing} onOpenChange={() => {}} dismissible={false}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Processing payment</DialogTitle>
            <DialogDescription>
              Do not close or refresh this page. This can take up to a minute.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 text-gray-700 text-sm">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Waiting for confirmation…
          </div>
          {isLongWait && (
            <div className="mt-4 text-sm text-gray-600">
              <div>Still processing… This is taking longer than usual.</div>
              <button
                onClick={() => router.push('/orders')}
                className="mt-3 w-full h-10 rounded-md bg-blue-600 text-white"
              >
                View Orders
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
