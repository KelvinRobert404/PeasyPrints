'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';
import { useCouponStore } from '@/lib/stores/couponsStore';
import { useMemo, type ReactNode } from 'react';
import { calculateTotalCost, resolvePageRates } from '@/lib/utils/pricing';
import { Card, ListRow } from '@/components/swoop/primitives';
import { cn } from '@/lib/utils/cn';

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2).replace(/\.00$/, '');

function Amount({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('shrink-0 text-[12.5px] font-bold text-ink tabular-nums', className)}>{children}</span>;
}

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

  const copiesNote = breakdown.copies > 1 ? ` × ${breakdown.copies} copies` : '';

  return (
    <Card>
      {breakdown.assignment ? (
        <>
          <ListRow
            className="px-3"
            title="Black & white"
            subtitle={`${breakdown.assignment.bwPages} pages${copiesNote}`}
            trailing={<Amount>₹{money(breakdown.assignment.bwSubtotal)}</Amount>}
          />
          <ListRow
            className="px-3"
            title="Colour"
            subtitle={`${breakdown.assignment.colorPages} pages${copiesNote}`}
            trailing={<Amount>₹{money(breakdown.assignment.colorSubtotal)}</Amount>}
          />
        </>
      ) : (
        <ListRow
          className="px-3"
          title="Printing"
          subtitle={breakdown.perPage > 0 ? `${pageCount} pages × ₹${money(breakdown.perPage)}${copiesNote}` : 'Pages × rate'}
          trailing={<Amount>₹{money(breakdown.basePagesCost)}</Amount>}
        />
      )}
      {breakdown.bindingCostTotal > 0 && (
        <ListRow className="px-3" title="Binding" trailing={<Amount>₹{money(breakdown.bindingCostTotal)}</Amount>} />
      )}
      {breakdown.extraColorSurcharge > 0 && (
        <ListRow className="px-3" title="Extra colour pages" trailing={<Amount>₹{money(breakdown.extraColorSurcharge)}</Amount>} />
      )}
      {breakdown.rushCost > 0 && (
        <ListRow className="px-3" title="Rush" trailing={<Amount>₹{money(breakdown.rushCost)}</Amount>} />
      )}
      {breakdown.afterDarkCost > 0 && (
        <ListRow className="px-3" title="After dark" trailing={<Amount>₹{money(breakdown.afterDarkCost)}</Amount>} />
      )}
      {breakdown.convenienceFee > 0 && (
        <ListRow className="px-3" title="Service fee" trailing={<Amount>₹{money(breakdown.convenienceFee)}</Amount>} />
      )}
      {appliedCoupon && couponDiscount > 0 && (
        <ListRow
          className="px-3"
          title={`Coupon (${appliedCoupon.code})`}
          trailing={<Amount className="text-go-text">-₹{money(couponDiscount)}</Amount>}
        />
      )}
      <div className="flex items-center justify-between gap-3 px-3 py-3">
        <span className="font-heading text-[14.5px] leading-none text-ink">Total</span>
        <span className={cn('font-heading text-[14.5px] leading-none tabular-nums', appliedCoupon ? 'text-go-text' : 'text-ink')}>
          ₹{money(appliedCoupon ? finalTotal : subtotal)}
        </span>
      </div>
    </Card>
  );
}

