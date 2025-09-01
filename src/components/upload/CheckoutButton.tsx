'use client';

import { useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useUser } from '@clerk/nextjs';
import { uploadPdfAndGetUrl } from '@/lib/firebase/storageUpload';
import { loadRazorpay } from '@/lib/razorpay/loadRazorpay';
// import { createOrderDoc } from '@/lib/firebase/createOrder';
import { useRouter } from 'next/navigation';
import { usePosthog } from '@/hooks/usePosthog';
import { startSessionRecording, stopSessionRecording } from '@/lib/posthog/client';

export function CheckoutButton({ shopId, shopName }: { shopId: string; shopName?: string }) {
  const { file, pageCount, totalCost, settings } = useUploadStore();
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const [loading, setLoading] = useState(false);
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

  return (
    <button
      onClick={handleCheckout}
      disabled={loading || !file || totalCost <= 0 || !isClerkLoaded || !clerkUser}
      className="w-full h-14 bg-blue-600 text-white rounded-xl disabled:opacity-50 font-quinn text-[24px]"
      style={{ letterSpacing: '0.02em' }}
    >
      {loading ? 'PROCESSING…' : 'CHECKOUT'}
    </button>
  );
}
