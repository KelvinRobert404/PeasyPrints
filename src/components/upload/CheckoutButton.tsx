'use client';

import { useEffect, useRef, useState } from 'react';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { imagesToPdf } from '@/lib/utils/imagesToPdf';
import { splitAssignmentPdf } from '@/lib/utils/splitAssignmentPdf';
import { useAuthStore } from '@/lib/stores/authStore';
import { useUser } from '@clerk/nextjs';
import { uploadPdfAndGetPath } from '@/lib/firebase/storageUpload';
import { loadRazorpay } from '@/lib/razorpay/loadRazorpay';
import type { CheckoutFiles } from '@/lib/checkout/schema';
import { useRouter } from 'next/navigation';
import { usePosthog } from '@/hooks/usePosthog';
import { startSessionRecording, stopSessionRecording } from '@/lib/posthog/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PdfPreviewer } from '@/components/upload/PdfPreviewer';
import { ImagesLayoutPreview } from '@/components/upload/ImagesLayoutPreview';
import { SpinnerIcon } from '@/components/upload/icons';
import { swButton } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2).replace(/\.00$/, '');

export function CheckoutButton({ shopId, shopName }: { shopId: string; shopName?: string }) {
  const { file, pageCount, totalCost, settings, jobType, images, imagesPages, imagesGapCm, imagesScale, assignmentMode, assignmentColorPages, assignmentConfirmed } = useUploadStore();
  const { user } = useAuthStore();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isLongWait, setIsLongWait] = useState(false);
  const uploadedRef = useRef<{ key: string; files: CheckoutFiles } | null>(null);
  const inFlightRef = useRef(false);
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

  // Upload before paying: the server prices the file it actually received, and a
  // failed upload can never leave the customer charged without an order. Retries
  // (e.g. after closing the payment sheet) reuse the same upload.
  const uploadCheckoutFiles = async (): Promise<CheckoutFiles> => {
    const key = JSON.stringify({
      file: file ? [file.name, file.size, file.lastModified] : null,
      images: (images || []).map((img) => [img.name, img.size, img.lastModified]),
      imagesPages, imagesGapCm, imagesScale, paperSize: settings.paperSize,
      jobType, assignmentMode, assignmentColorPages,
    });
    if (uploadedRef.current?.key === key) return uploadedRef.current.files;

    const uid = clerkUser!.id;
    const pdfFile = (bytes: Uint8Array | ArrayBuffer, name: string) => {
      // Copy into a fresh ArrayBuffer to satisfy DOM BlobPart typing
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      return new File([ab], name, { type: 'application/pdf' });
    };

    let files: CheckoutFiles;
    if ((images?.length || 0) > 0) {
      const pdfBytes = await imagesToPdf(images, imagesPages, settings.paperSize, imagesGapCm, imagesScale);
      const filePath = await uploadPdfAndGetPath(uid, pdfFile(pdfBytes, 'images.pdf'));
      files = { filePath, fileName: 'images.pdf' };
    } else if (file && jobType === 'Assignment' && assignmentMode === 'Mixed' && assignmentColorPages.length > 0) {
      const buf = await file.arrayBuffer();
      const { bwBytes, colorBytes } = await splitAssignmentPdf(buf, assignmentColorPages);
      const [bwPath, colorPath, originalPath] = await Promise.all([
        uploadPdfAndGetPath(uid, pdfFile(bwBytes, 'bw.pdf')),
        uploadPdfAndGetPath(uid, pdfFile(colorBytes, 'color.pdf')),
        // also keep original for shop access
        uploadPdfAndGetPath(uid, pdfFile(buf, 'original.pdf')),
      ]);
      files = { filePath: originalPath, fileName: file.name || 'document.pdf', splitFiles: { bwPath, colorPath, originalPath } };
    } else if (file) {
      const filePath = await uploadPdfAndGetPath(uid, pdfFile(await file.arrayBuffer(), file.name || 'document.pdf'));
      files = { filePath, fileName: file.name || 'document.pdf' };
    } else {
      throw new Error('Nothing to upload');
    }
    uploadedRef.current = { key, files };
    return files;
  };

  // orders/create is idempotent per payment, so transient failures are safe to retry.
  const finalizeOrder = async (body: Record<string, unknown>) => {
    let lastError = 'Failed to create order';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) return;
        const data = await res.json().catch(() => ({}));
        lastError = data?.error || lastError;
        if (res.status < 500) break;
      } catch {
        lastError = 'Network error while confirming your order';
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    throw new Error(lastError);
  };

  const startPaymentFlow = async () => {
    const hasPdf = !!file;
    const hasImages = (images?.length || 0) > 0;
    if (!isClerkLoaded || !clerkUser || (!hasPdf && !hasImages) || pageCount === 0 || totalCost <= 0) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      // Conditionally enable session recording for checkout flow
      try {
        const enabled = await isFeatureEnabled('record_checkout');
        if (enabled) await startSessionRecording();
      } catch { }
      capture('checkout_clicked', {
        userId: clerkUser.id,
        shopId,
        shopName,
        totalPages: pageCount,
        totalCost,
        printSettings: settings,
        jobType,
      });

      // 1) Upload the exact file(s) the shop will print
      let files: CheckoutFiles;
      try {
        files = await uploadCheckoutFiles();
      } catch (e: any) {
        throw new Error(e?.message && e.message !== 'Upload failed' ? e.message : 'Failed to upload your file. Please check your connection and try again.');
      }

      // 2) Create the Razorpay order; the server re-prices against the uploaded file
      const checkoutId = crypto.randomUUID();
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': checkoutId },
        body: JSON.stringify({
          shopId,
          totalPages: pageCount,
          printSettings: settings,
          jobType,
          assignment: (jobType === 'Assignment' && assignmentMode === 'Mixed') ? { colorPages: assignmentColorPages } : undefined,
          files,
        })
      });
      const { order, quote, error } = await orderRes.json().catch(() => ({}));
      if (error || !order?.id) throw new Error(error || 'Failed to create Razorpay order');
      capture('razorpay_order_created', { razorpay_order_id: order.id, totalCost: quote?.amount, userId: clerkUser.id });

      // 3) Load Razorpay SDK and open checkout quickly to keep click context
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
        theme: { color: '#0055FF' },
        handler: async (response: any) => {
          setProcessing(true);
          const paymentRef = response?.razorpay_payment_id ? ` (payment ID ${response.razorpay_payment_id})` : '';
          let verified = false;
          try {
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
            const verify = await verifyRes.json().catch(() => ({}));
            verified = verifyRes.ok && verify.valid;
          } catch { }
          if (!verified) {
            alert(`We couldn't confirm your payment yet${paymentRef}. If you were charged, please don't pay again — contact support and we'll sort it out.`);
            capture('razorpay_payment_failed', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              status: 'verification_failed',
            });
            setProcessing(false);
            return;
          }
          try {
            // 4) Finalize the order; the server uses the files bound to this payment
            await finalizeOrder({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              userName: clerkUser.fullName || clerkUser.username || clerkUser.phoneNumbers?.[0]?.phoneNumber || clerkUser.emailAddresses?.[0]?.emailAddress || 'User',
            });
            capture('razorpay_payment_succeeded', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              status: 'paid',
            });
            capture('order_created', { shopId, totalPages: pageCount, totalCost });
            uploadedRef.current = null;
            router.replace('/orders');
            // Clear the cart so returning to /upload can't re-order the same job by accident.
            useUploadStore.getState().reset();
          } catch (err: any) {
            capture('order_creation_failed', { error: err?.message || 'Order finalization failed' });
            alert(`Your payment went through${paymentRef}, but we couldn't confirm the order: ${err?.message || 'unknown error'}. Please don't pay again — check Orders in a few minutes or contact support.`);
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
      inFlightRef.current = false;
      setLoading(false);
      try { await stopSessionRecording(); } catch { }
    }
  };

  const handleCheckout = () => {
    const hasPdf = !!file;
    const hasImages = (images?.length || 0) > 0;
    if (jobType === 'Assignment' && assignmentMode === 'Mixed' && !assignmentConfirmed) {
      alert('Please confirm color page selection before checkout.');
      return;
    }
    if (!isClerkLoaded || !clerkUser || (!hasPdf && !hasImages) || pageCount === 0 || totalCost <= 0) return;
    try {
      // Fire GA4 recommended event for checkout start
      (window as any).gtag?.('event', 'begin_checkout', {
        currency: 'INR',
        value: totalCost,
        shop_id: shopId,
        shop_name: shopName || undefined,
        job_type: jobType,
        page_count: pageCount
      });
    } catch { }
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
          const hasPdf = !!file;
          const hasImages = (images?.length || 0) > 0;
          return loading || (!hasPdf && !hasImages) || totalCost <= 0 || !isClerkLoaded || !clerkUser;
        })()}
        className={cn(swButton({ size: 'lg' }), 'w-full', !loading && totalCost > 0 && 'justify-between')}
      >
        {loading ? (
          <>
            <SpinnerIcon size={18} className="animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <span>Checkout</span>
            {totalCost > 0 && <span className="font-heading text-[14.5px] leading-none tabular-nums">₹{money(totalCost)}</span>}
          </>
        )}
      </button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[92vw] max-w-2xl rounded-[14px] p-3.5">
          <DialogHeader className="mb-2.5">
            <DialogTitle className="font-heading text-[16px] text-ink">Check your print</DialogTitle>
            <DialogDescription className="mt-0.5 text-[11.5px] text-slate">What you see is exactly what the shop sees.</DialogDescription>
          </DialogHeader>
          {jobType === 'Assignment' && assignmentMode === 'Mixed' && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-royal-tint px-2 py-0.5 text-[11px] font-bold text-royal tabular-nums">Colour: {colorText || 'None'}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink tabular-nums">B&W: {bwText || 'None'}</span>
            </div>
          )}
          <div className="max-h-[60vh] overflow-auto rounded-[12px] border border-line bg-white p-2">
            {(images?.length || 0) > 0 ? <ImagesLayoutPreview /> : <PdfPreviewer />}
          </div>
          <div className="mt-3 flex justify-end gap-1.5">
            <button type="button" className={swButton({ variant: 'surface', size: 'md' })} onClick={() => setPreviewOpen(false)}>Cancel</button>
            <button
              type="button"
              className={swButton({ variant: 'primary', size: 'md' })}
              onClick={async () => {
                setPreviewOpen(false);
                await startPaymentFlow();
              }}
            >
              Confirm & pay
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={processing} onOpenChange={() => { }} dismissible={false}>
        <DialogContent className="w-[92vw] max-w-sm rounded-[14px] p-3.5">
          <DialogHeader className="mb-2.5">
            <DialogTitle className="font-heading text-[16px] text-ink">Processing payment</DialogTitle>
            <DialogDescription className="mt-0.5 text-[11.5px] text-slate">
              Don&apos;t close or refresh this page. This can take up to a minute.
            </DialogDescription>
          </DialogHeader>
          <div role="status" className="flex items-center gap-2.5 rounded-[12px] bg-surface px-3 py-2.5 text-[12.5px] font-bold text-ink">
            <SpinnerIcon size={18} className="shrink-0 animate-spin text-royal" />
            Waiting for confirmation…
          </div>
          {isLongWait && (
            <div className="mt-3">
              <p className="text-[11.5px] text-slate">Still processing. This is taking longer than usual.</p>
              <button
                type="button"
                onClick={() => router.push('/orders')}
                className={cn(swButton({ size: 'lg' }), 'mt-2.5 w-full')}
              >
                View orders
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
