'use client';

import { useCouponStore } from '@/lib/stores/couponsStore';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { swButton } from '@/components/swoop/primitives';
import { AlertIcon, CheckIcon, CloseIcon, TicketIcon } from '@/components/swoop/icons';
import { SpinnerIcon } from '@/components/upload/icons';

interface CouponInputProps {
    shopId?: string;
}

export function CouponInput({ shopId }: CouponInputProps) {
    const { totalCost } = useUploadStore();
    const {
        couponCode,
        appliedCoupon,
        loading,
        error,
        discount,
        setCouponCode,
        validateCoupon,
        clearCoupon,
    } = useCouponStore();

    const handleApply = async () => {
        await validateCoupon(totalCost, shopId);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleApply();
        }
    };

    if (appliedCoupon) {
        return (
            <div className="flex items-center gap-2.5 rounded-[12px] bg-go-tint px-2.5 py-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-go text-white">
                    <CheckIcon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-ink">
                        <span className="uppercase tracking-[0.04em]">{appliedCoupon.code}</span> applied
                    </p>
                    <p className="text-[11px] font-semibold text-go-text tabular-nums">
                        You save ₹{discount}
                        {appliedCoupon.discountType === 'percentage' && ` (${appliedCoupon.discountValue}% off)`}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={clearCoupon}
                    className="campus-press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink"
                    aria-label="Remove coupon"
                >
                    <CloseIcon size={13} />
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="flex gap-1.5">
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-surface pl-3 pr-2 focus-within:ring-2 focus-within:ring-royal/40">
                    <TicketIcon size={16} className="shrink-0 text-slate" />
                    <input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Coupon code"
                        aria-label="Coupon code"
                        autoCapitalize="characters"
                        className="min-w-0 flex-1 bg-transparent text-[12.5px] font-bold uppercase tracking-[0.04em] text-ink outline-none placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-slate disabled:opacity-60"
                        disabled={loading}
                    />
                </label>
                <button
                    type="button"
                    onClick={handleApply}
                    disabled={loading || !couponCode.trim()}
                    aria-label={loading ? 'Applying coupon' : undefined}
                    className={swButton({ variant: 'ink', size: 'md', className: 'min-w-[72px]' })}
                >
                    {loading ? <SpinnerIcon size={16} className="animate-spin" /> : 'Apply'}
                </button>
            </div>
            {error && (
                <p role="alert" className="flex items-center gap-1 text-[11px] font-semibold text-market">
                    <AlertIcon size={13} className="shrink-0" />
                    {error}
                </p>
            )}
        </div>
    );
}
