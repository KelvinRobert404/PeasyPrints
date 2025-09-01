'use client';

import { useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useUser } from '@clerk/nextjs';
import { uploadPdfAndGetUrl } from '@/lib/firebase/storageUpload';
import { loadRazorpay } from '@/lib/razorpay/loadRazorpay';
import { createOrderDoc } from '@/lib/firebase/createOrder';
import { useRouter } from 'next/navigation';

export function CheckoutButton({ shopId, shopName }: { shopId: string; shopName?: string }) {
  const { file, pageCount, totalCost, settings } = useUploadStore();
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    if (!isClerkLoaded || !clerkUser || !file || pageCount === 0 || totalCost <= 0) return;
    setLoading(true);
    try {
      // 1) Create Razorpay order first (match Flutter flow)
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalCost, currency: 'INR' })
      });
      const { order, error } = await orderRes.json();
      if (error || !order?.id) throw new Error(error || 'Failed to create Razorpay order');

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
            return;
          }
          try {
            // 3) After successful payment, upload and create order doc
            const uid = clerkUser.id;
            const fileUrl = await uploadPdfAndGetUrl(uid, file);
            await createOrderDoc({
              userId: uid,
              shopId,
              shopName: shopName || '',
              userName: clerkUser.fullName || clerkUser.username || clerkUser.phoneNumbers?.[0]?.phoneNumber || clerkUser.emailAddresses?.[0]?.emailAddress || 'User',
              fileName: file.name,
              fileUrl,
              totalPages: pageCount,
              totalCost: totalCost,
              emergency: !!settings.emergency,
              afterDark: !!settings.afterDark,
              printSettings: settings,
              pricingDetails: { basePricePerPage: 0, bindingCost: 0, emergencyCost: 0, afterDarkCost: 0, commission: 0 },
              status: 'processing'
            });
            router.replace('/orders');
          } catch (err: any) {
            alert(err?.message || 'Order finalization failed');
          }
        }
      });
      rzp.on('payment.failed', function (resp: any) {
        console.error('Razorpay payment failed', resp?.error);
        alert('Payment failed. Please try again.');
      });
      rzp.open();
    } catch (e: any) {
      alert(e?.message || 'Checkout failed');
    } finally {
      setLoading(false);
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
