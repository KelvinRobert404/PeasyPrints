'use client';

import { useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { uploadPdfAndGetUrl } from '@/lib/firebase/storageUpload';
import { loadRazorpay } from '@/lib/razorpay/loadRazorpay';
import { createOrderDoc } from '@/lib/firebase/createOrder';
import { useRouter } from 'next/navigation';

export function CheckoutButton({ shopId, shopName }: { shopId: string; shopName?: string }) {
  const { file, pageCount, totalCost, settings } = useUploadStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    if (!user || !file || pageCount === 0 || totalCost <= 0) return;
    setLoading(true);
    try {
      const fileUrl = await uploadPdfAndGetUrl(user.uid, file);

      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalCost, currency: 'INR' })
      });
      const { order } = await orderRes.json();

      await loadRazorpay();
      // @ts-ignore
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxx',
        amount: order.amount,
        currency: order.currency,
        name: 'PeasyPrints',
        description: file.name,
        order_id: order.id,
        handler: async function () {
          await createOrderDoc({
            userId: user.uid,
            shopId,
            shopName: shopName || '',
            userName: user.displayName || user.phoneNumber || user.email || 'User',
            fileName: file.name,
            fileUrl,
            totalPages: pageCount,
            totalCost: totalCost,
            emergency: false,
            printSettings: settings,
            pricingDetails: { basePricePerPage: 0, bindingCost: 0, emergencyCost: 0, commission: 0 },
            status: 'processing'
          });
          router.replace('/orders');
        }
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
      disabled={loading || !file || totalCost <= 0}
      className="w-full h-12 bg-blue-600 text-white rounded disabled:opacity-50"
    >
      {loading ? 'Processing...' : 'Checkout'}
    </button>
  );
}
