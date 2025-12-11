'use client';

import { useState } from 'react';
import { useCouponStore } from '@/lib/stores/couponsStore';
import { useUploadStore } from '@/lib/stores/uploadStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, X, Check, Loader2 } from 'lucide-react';

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
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                            <Check className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-green-700">{appliedCoupon.code}</span>
                                <span className="text-sm text-green-600">applied</span>
                            </div>
                            <p className="text-sm text-green-600">
                                You save ₹{discount}
                                {appliedCoupon.discountType === 'percentage' && ` (${appliedCoupon.discountValue}% off)`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={clearCoupon}
                        className="rounded-full p-1 hover:bg-green-100 transition-colors"
                        aria-label="Remove coupon"
                    >
                        <X className="h-4 w-4 text-green-600" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter coupon code"
                        className="pl-10 font-mono uppercase"
                        disabled={loading}
                    />
                </div>
                <Button
                    onClick={handleApply}
                    disabled={loading || !couponCode.trim()}
                    variant="outline"
                    className="px-6"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        'Apply'
                    )}
                </Button>
            </div>
            {error && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    {error}
                </p>
            )}
        </div>
    );
}
