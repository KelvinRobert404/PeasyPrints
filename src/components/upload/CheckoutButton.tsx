'use client';

import { useEffect, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { imagesToPdf } from '@/lib/utils/imagesToPdf';
import { splitAssignmentPdf } from '@/lib/utils/splitAssignmentPdf';
import { useAuthStore } from '@/lib/stores/authStore';
import { useUser } from '@clerk/nextjs';
import { uploadPdfAndGetUrl } from '@/lib/firebase/storageUpload';
import { loadRazorpay } from '@/lib/razorpay/loadRazorpay';
// import { createOrderDoc } from '@/lib/firebase/createOrder';
import { useRouter } from 'next/navigation';
import { usePosthog } from '@/hooks/usePosthog';
import { startSessionRecording, stopSessionRecording } from '@/lib/posthog/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PdfPreviewer } from '@/components/upload/PdfPreviewer';
import { ImagesLayoutPreview } from '@/components/upload/ImagesLayoutPreview';

export function CheckoutButton({ shopId, shopName }: { shopId: string; shopName?: string }) {
  const { file, pageCount, totalCost, settings, jobType, images, imagesPages, imagesGapCm, imagesScale, assignmentMode, assignmentColorPages, assignmentConfirmed } = useUploadStore();
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isLongWait, setIsLongWait] = useState(false);
  const router = useRouter();
  const { capture, isFeatureEnabled } = usePosthog();

  function formatRanges(nums: number[]): string {
    if (!nums || nums.length === 0) return '';
    const a = [...nums].sort((x, y) => x - y);
    const parts: string[] = [];
    let start = a[0];
    let prev = a[0];
    for (let i = 1; i < a.length; i++) {
      if (a[i] === prev + 1) prev = a[i];
      else { parts.push(start === prev ? String(start) : `${start}-${prev}`); start = prev = a[i]; }
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    return parts.join(', ');
  }

  const colorText = (() => formatRanges(assignmentColorPages))();
  const bwText = (() => {
    if (!pageCount) return '';
    const color = new Set(assignmentColorPages);
    const bw: number[] = [];
    for (let i = 1; i <= pageCount; i++) if (!color.has(i)) bw.push(i);
    return formatRanges(bw);
  })();

  const startPaymentFlow = async () => {
    // Prepare upload blobs upfront to avoid File permission issues post-payment
    let preparedSingle: { blob: Blob; name: string } | null = null;
    let preparedSplit: { bw: Blob; color: Blob } | null = null;
    try {
      if (jobType === 'Images') {
        const pdfBytes = await imagesToPdf(images, imagesPages, settings.paperSize, imagesGapCm, imagesScale);
        const date = new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const dynamicName = `images-${images.length}img-${imagesPages}pg-${settings.paperSize}-${y}${m}${d}-${hh}${mm}.pdf`;
        // Convert Uint8Array -> ArrayBuffer to satisfy DOM BlobPart typing
        const ab = new ArrayBuffer(pdfBytes.byteLength);
        new Uint8Array(ab).set(pdfBytes);
        preparedSingle = { blob: new Blob([ab], { type: 'application/pdf' }), name: dynamicName };
      } else if (jobType === 'Assignment' && file) {
        if (assignmentMode === 'Mixed' && assignmentColorPages.length > 0) {
          const buf = await file.arrayBuffer();
          const { bwBytes, colorBytes } = await splitAssignmentPdf(buf, assignmentColorPages);
          preparedSplit = {
            bw: new Blob([bwBytes], { type: 'application/pdf' }),
            color: new Blob([colorBytes], { type: 'application/pdf' }),
            // also keep original for shop access
            original: new Blob([buf], { type: 'application/pdf' })
          } as any;
        } else {
          // Clone original file to ensure stable Blob reference
          const buf = await file.arrayBuffer();
          preparedSingle = { blob: new Blob([buf], { type: 'application/pdf' }), name: file.name || 'document.pdf' };
        }
      } else if (file) {
        const buf = await file.arrayBuffer();
        preparedSingle = { blob: new Blob([buf], { type: 'application/pdf' }), name: file.name || 'document.pdf' };
      }
    } catch (e) {
      alert('Failed to prepare file for upload. Please reselect your file.');
      return;
    }
    const hasPdf = jobType !== 'Images' && !!file;
    const hasImages = jobType === 'Images' && images.length > 0;
    if (!isClerkLoaded || !clerkUser || (!hasPdf && !hasImages) || pageCount === 0 || totalCost <= 0) return;
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
        jobType,
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
        description: hasPdf ? file!.name : `${images.length} images`,
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
            // 3) After successful payment, upload the prepared blob(s)
            const uid = clerkUser.id;
            let fileUrl = '';
            let splitUrls: { bwUrl: string; colorUrl: string; originalUrl?: string } | null = null;
            if (preparedSplit) {
              const bwFile = new File([ (preparedSplit as any).bw ], 'bw.pdf', { type: 'application/pdf' });
              const colorFile = new File([ (preparedSplit as any).color ], 'color.pdf', { type: 'application/pdf' });
              const originalBlob: Blob | undefined = (preparedSplit as any).original;
              const uploads: Promise<string>[] = [
                uploadPdfAndGetUrl(uid, bwFile),
                uploadPdfAndGetUrl(uid, colorFile)
              ];
              if (originalBlob) {
                const originalFile = new File([originalBlob], 'original.pdf', { type: 'application/pdf' });
                uploads.push(uploadPdfAndGetUrl(uid, originalFile));
              }
              const urls = await Promise.all(uploads);
              const bwUrl = urls[0];
              const colorUrl = urls[1];
              const originalUrl = urls[2];
              splitUrls = { bwUrl, colorUrl, originalUrl };
              fileUrl = originalUrl || colorUrl; // primary reference
            } else if (preparedSingle) {
              const uploadFile = new File([preparedSingle.blob], preparedSingle.name, { type: 'application/pdf' });
              fileUrl = await uploadPdfAndGetUrl(uid, uploadFile);
            } else {
              throw new Error('Nothing to upload');
            }
            const res = await fetch('/api/orders/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shopId,
                shopName: shopName || '',
                userName: clerkUser.fullName || clerkUser.username || clerkUser.phoneNumbers?.[0]?.phoneNumber || clerkUser.emailAddresses?.[0]?.emailAddress || 'User',
                fileUrl,
                fileName: hasPdf ? file!.name : (jobType === 'Images' ? 'images.pdf' : 'document.pdf'),
                totalPages: pageCount,
                printSettings: settings,
                jobType,
                splitFiles: splitUrls || undefined,
                assignment: (jobType === 'Assignment' && assignmentMode === 'Mixed') ? { colorPages: assignmentColorPages } : undefined
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

  const handleCheckout = () => {
    const hasPdf = jobType !== 'Images' && !!file;
    const hasImages = jobType === 'Images' && images.length > 0;
    if (jobType === 'Assignment' && assignmentMode === 'Mixed' && !assignmentConfirmed) {
      alert('Please confirm color page selection before checkout.');
      return;
    }
    if (!isClerkLoaded || !clerkUser || (!hasPdf && !hasImages) || pageCount === 0 || totalCost <= 0) return;
    setPreviewOpen(true);
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
        disabled={(() => {
          const hasPdf = jobType !== 'Images' && !!file;
          const hasImages = jobType === 'Images' && images.length > 0;
          return loading || (!hasPdf && !hasImages) || totalCost <= 0 || !isClerkLoaded || !clerkUser;
        })()}
        className="w-full h-14 bg-blue-600 text-white rounded-xl disabled:opacity-50 font-quinn text-[24px]"
        style={{ letterSpacing: '0.02em' }}
      >
        {loading ? 'PROCESSING…' : 'CHECKOUT'}
      </button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm preview</DialogTitle>
            <DialogDescription>What you see is exactly what the shop sees.</DialogDescription>
          </DialogHeader>
          {jobType === 'Assignment' && assignmentMode === 'Mixed' && (
            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Color: {colorText || 'None'}</span>
              <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-700 border">B/W: {bwText || 'None'}</span>
            </div>
          )}
          <div className="max-h-[60vh] overflow-auto border rounded p-2 bg-white">
            {jobType === 'Images' ? <ImagesLayoutPreview /> : <PdfPreviewer />}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="h-10 px-3 rounded-md border bg-white" onClick={() => setPreviewOpen(false)}>Cancel</button>
            <button
              type="button"
              className="h-10 px-3 rounded-md bg-blue-600 text-white"
              onClick={async () => {
                setPreviewOpen(false);
                await startPaymentFlow();
              }}
            >
              Confirm & Pay
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
