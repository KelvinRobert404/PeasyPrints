'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';
import { useCouponStore } from '@/lib/stores/couponsStore';
import { useMemo } from 'react';
import { calculateTotalCost, resolvePageRates } from '@/lib/utils/pricing';

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2).replace(/\.00$/, '');

export function PriceSummary() {
  const { totalCost, pageCount, settings, shopPricing, jobType, assignmentMode, assignmentColorPages } = useUploadStore();
  const { appliedCoupon, discount: couponDiscount } = useCouponStore();

  const breakdown = useMemo(() => {
    if (!shopPricing) {
      return {
        perPage: 0,
        basePagesCost: 0,
        bindingCostTotal: 0,
        extraColorSurcharge: 0,
        rushCost: 0,
        afterDarkCost: 0,
        convenienceFee: 0,
        copies: settings.copies || 1,
        assignment: null as null | { bwPages: number; colorPages: number; bwSubtotal: number; colorSubtotal: number }
      };
    }

    // Use the same rate resolution and fee logic as the total (and the server),
    // so tier-priced shops and tiered fees add up.
    const { perPage, bwPerPage, colorPerPage } = resolvePageRates(settings, pageCount, shopPricing);
    const { details } = calculateTotalCost(settings, pageCount, shopPricing);

    const copies = Math.max(settings.copies || 1, 1);
    const basePagesCostSingle = perPage * pageCount;
    const bindingCostTotal = details.bindingCost * copies;

    const extraColorPages = settings.extraColorPages || 0;
    const extraColorDelta = Math.max(colorPerPage - bwPerPage, 0) * extraColorPages;
    const extraColorSurcharge = (settings.printColor === 'Black & White' ? extraColorDelta : 0) * copies;

    const rushCost = details.emergencyCost;
    const afterDarkCost = details.afterDarkCost ?? 0;
    const convenienceFee = details.convenienceFee ?? 0;

    let assignment: null | { bwPages: number; colorPages: number; bwSubtotal: number; colorSubtotal: number } = null;
    if (jobType === 'Assignment') {
      const colorPages = assignmentMode === 'Mixed' ? (assignmentColorPages?.length || 0) : 0;
      const bwPages = Math.max(pageCount - colorPages, 0);
      const bwSubtotal = bwPages * bwPerPage * copies;
      const colorSubtotal = colorPages * colorPerPage * copies;
      assignment = { bwPages, colorPages, bwSubtotal, colorSubtotal };
    }

    return {
      perPage,
      basePagesCost: basePagesCostSingle * copies,
      bindingCostTotal,
      extraColorSurcharge,
      rushCost,
      afterDarkCost,
      convenienceFee,
      copies,
      assignment
    };
  }, [shopPricing, settings, pageCount, jobType, assignmentMode, assignmentColorPages]);

  const subtotal = totalCost;
  const finalTotal = Math.max(subtotal - couponDiscount, 0);

  return (
    <div className="space-y-2 text-sm">
      {breakdown.assignment ? (
        <div className="space-y-1">
          <div className="flex justify-between"><span>B&W ({breakdown.assignment.bwPages} pages)</span><span>₹{money(breakdown.assignment.bwSubtotal)}</span></div>
          <div className="flex justify-between"><span>Color ({breakdown.assignment.colorPages} pages)</span><span>₹{money(breakdown.assignment.colorSubtotal)}</span></div>
        </div>
      ) : (
        <div className="flex justify-between"><span>Pages × Rate</span><span>₹{money(breakdown.basePagesCost)}</span></div>
      )}
      {breakdown.bindingCostTotal > 0 && (
        <div className="flex justify-between"><span>Binding</span><span>₹{money(breakdown.bindingCostTotal)}</span></div>
      )}
      {breakdown.extraColorSurcharge > 0 && (
        <div className="flex justify-between"><span>Extra color pages</span><span>₹{money(breakdown.extraColorSurcharge)}</span></div>
      )}
      {breakdown.rushCost > 0 && (
        <div className="flex justify-between"><span>Rush</span><span>₹{money(breakdown.rushCost)}</span></div>
      )}
      {breakdown.afterDarkCost > 0 && (
        <div className="flex justify-between"><span>After dark</span><span>₹{money(breakdown.afterDarkCost)}</span></div>
      )}
      {breakdown.convenienceFee > 0 && (
        <div className="flex justify-between"><span>Service Fee</span><span>₹{money(breakdown.convenienceFee)}</span></div>
      )}
      {appliedCoupon && couponDiscount > 0 && (
        <div className="flex justify-between text-green-600">
          <span>Coupon ({appliedCoupon.code})</span>
          <span>-₹{money(couponDiscount)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold border-t pt-2">
        <span>Total</span>
        <span className={appliedCoupon ? 'text-green-600' : ''}>
          ₹{money(appliedCoupon ? finalTotal : subtotal)}
        </span>
      </div>
    </div>
  );
}

