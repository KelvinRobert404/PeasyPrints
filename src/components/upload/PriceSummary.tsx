'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';
import { useCouponStore } from '@/lib/stores/couponsStore';
import { useMemo } from 'react';

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

    const isA4 = settings.paperSize === 'A4';
    const table = isA4 ? shopPricing.a4 : shopPricing.a3;

    const perPage = settings.printColor === 'Color'
      ? (settings.printFormat === 'Double-Sided' ? (table?.doubleColor ?? 0) : (table?.singleColor ?? 0))
      : (settings.printFormat === 'Double-Sided' ? (table?.doubleBW ?? 0) : (table?.singleBW ?? 0));

    const bwPerPage = (settings.printFormat === 'Double-Sided' ? (table?.doubleBW ?? 0) : (table?.singleBW ?? 0));
    const colorPerPage = (settings.printFormat === 'Double-Sided' ? (table?.doubleColor ?? 0) : (table?.singleColor ?? 0));

    const copies = Math.max(settings.copies || 1, 1);
    const basePagesCostSingle = perPage * pageCount;

    const bindingMap: Record<string, number> = {
      'Soft Binding': shopPricing.services.softBinding ?? 0,
      'Spiral Binding': shopPricing.services.spiralBinding ?? 0,
      'Hard Binding': shopPricing.services.hardBinding ?? 0,
      '': 0
    };
    const bindingCost = bindingMap[settings.binding || ''] || 0;
    const bindingCostTotal = bindingCost * copies;

    const extraColorPages = settings.extraColorPages || 0;
    const extraColorDelta = Math.max(colorPerPage - bwPerPage, 0) * extraColorPages;
    const extraColorSurcharge = (settings.printColor === 'Black & White' ? extraColorDelta : 0) * copies;

    const rushUnit = shopPricing.services.emergency ?? 0;
    const afterDarkUnit = shopPricing.services.afterDark ?? rushUnit ?? 0;
    const rushCost = settings.emergency ? rushUnit : 0;
    const afterDarkCost = settings.afterDark ? afterDarkUnit : 0;
    const convenienceFee = shopPricing.convenienceFee ?? 0;

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
          <div className="flex justify-between"><span>B&W ({breakdown.assignment.bwPages} pages)</span><span>₹{breakdown.assignment.bwSubtotal}</span></div>
          <div className="flex justify-between"><span>Color ({breakdown.assignment.colorPages} pages)</span><span>₹{breakdown.assignment.colorSubtotal}</span></div>
        </div>
      ) : (
        <div className="flex justify-between"><span>Pages × Rate</span><span>₹{breakdown.basePagesCost}</span></div>
      )}
      {breakdown.bindingCostTotal > 0 && (
        <div className="flex justify-between"><span>Binding</span><span>₹{breakdown.bindingCostTotal}</span></div>
      )}
      {breakdown.extraColorSurcharge > 0 && (
        <div className="flex justify-between"><span>Extra color pages</span><span>₹{breakdown.extraColorSurcharge}</span></div>
      )}
      {breakdown.rushCost > 0 && (
        <div className="flex justify-between"><span>Rush</span><span>₹{breakdown.rushCost}</span></div>
      )}
      {breakdown.afterDarkCost > 0 && (
        <div className="flex justify-between"><span>After dark</span><span>₹{breakdown.afterDarkCost}</span></div>
      )}
      {breakdown.convenienceFee > 0 && (
        <div className="flex justify-between"><span>Service Fee</span><span>₹{breakdown.convenienceFee}</span></div>
      )}
      {appliedCoupon && couponDiscount > 0 && (
        <div className="flex justify-between text-green-600">
          <span>Coupon ({appliedCoupon.code})</span>
          <span>-₹{couponDiscount}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold border-t pt-2">
        <span>Total</span>
        <span className={appliedCoupon ? 'text-green-600' : ''}>
          ₹{appliedCoupon ? finalTotal : subtotal}
        </span>
      </div>
    </div>
  );
}

