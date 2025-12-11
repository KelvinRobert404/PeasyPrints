'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Coupon } from '@/types/models';

interface CouponState {
    appliedCoupon: Coupon | null;
    couponCode: string;
    loading: boolean;
    error: string | null;
    discount: number;
    setCouponCode: (code: string) => void;
    validateCoupon: (orderTotal: number, shopId?: string) => Promise<boolean>;
    calculateDiscount: (orderTotal: number) => number;
    clearCoupon: () => void;
}

export const useCouponStore = create<CouponState>()(
    immer((set, get) => ({
        appliedCoupon: null,
        couponCode: '',
        loading: false,
        error: null,
        discount: 0,

        setCouponCode: (code) => {
            set((s) => {
                s.couponCode = code.toUpperCase();
                s.error = null;
            });
        },

        validateCoupon: async (orderTotal, shopId) => {
            const { couponCode } = get();
            if (!couponCode.trim()) {
                set((s) => {
                    s.error = 'Please enter a coupon code';
                    s.appliedCoupon = null;
                    s.discount = 0;
                });
                return false;
            }

            set((s) => {
                s.loading = true;
                s.error = null;
            });

            try {
                const q = query(
                    collection(db, 'coupons'),
                    where('code', '==', couponCode.trim().toUpperCase()),
                    where('active', '==', true)
                );
                const snap = await getDocs(q);

                if (snap.empty) {
                    set((s) => {
                        s.error = 'Invalid coupon code';
                        s.appliedCoupon = null;
                        s.discount = 0;
                        s.loading = false;
                    });
                    return false;
                }

                const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as Coupon;

                // Check validity period
                const now = new Date();
                if (coupon.validFrom) {
                    const from = coupon.validFrom.toDate ? coupon.validFrom.toDate() : new Date(coupon.validFrom);
                    if (now < from) {
                        set((s) => {
                            s.error = 'Coupon is not yet valid';
                            s.appliedCoupon = null;
                            s.discount = 0;
                            s.loading = false;
                        });
                        return false;
                    }
                }
                if (coupon.validUntil) {
                    const until = coupon.validUntil.toDate ? coupon.validUntil.toDate() : new Date(coupon.validUntil);
                    if (now > until) {
                        set((s) => {
                            s.error = 'Coupon has expired';
                            s.appliedCoupon = null;
                            s.discount = 0;
                            s.loading = false;
                        });
                        return false;
                    }
                }

                // Check usage limit
                if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
                    set((s) => {
                        s.error = 'Coupon usage limit reached';
                        s.appliedCoupon = null;
                        s.discount = 0;
                        s.loading = false;
                    });
                    return false;
                }

                // Check shop restriction
                if (coupon.shopIds && coupon.shopIds.length > 0 && shopId) {
                    if (!coupon.shopIds.includes(shopId)) {
                        set((s) => {
                            s.error = 'Coupon not valid for this store';
                            s.appliedCoupon = null;
                            s.discount = 0;
                            s.loading = false;
                        });
                        return false;
                    }
                }

                // Check minimum order amount
                if (coupon.minOrderAmount && orderTotal < coupon.minOrderAmount) {
                    set((s) => {
                        s.error = `Minimum order amount is ₹${coupon.minOrderAmount}`;
                        s.appliedCoupon = null;
                        s.discount = 0;
                        s.loading = false;
                    });
                    return false;
                }

                // Calculate discount
                let discount = 0;
                if (coupon.discountType === 'percentage') {
                    discount = Math.round((orderTotal * coupon.discountValue) / 100);
                    if (coupon.maxDiscount) {
                        discount = Math.min(discount, coupon.maxDiscount);
                    }
                } else {
                    discount = coupon.discountValue;
                }
                discount = Math.min(discount, orderTotal); // Can't exceed order total

                set((s) => {
                    s.appliedCoupon = coupon;
                    s.discount = discount;
                    s.error = null;
                    s.loading = false;
                });

                return true;
            } catch (err) {
                console.error('Failed to validate coupon', err);
                set((s) => {
                    s.error = 'Failed to validate coupon';
                    s.appliedCoupon = null;
                    s.discount = 0;
                    s.loading = false;
                });
                return false;
            }
        },

        calculateDiscount: (orderTotal) => {
            const { appliedCoupon } = get();
            if (!appliedCoupon) return 0;

            let discount = 0;
            if (appliedCoupon.discountType === 'percentage') {
                discount = Math.round((orderTotal * appliedCoupon.discountValue) / 100);
                if (appliedCoupon.maxDiscount) {
                    discount = Math.min(discount, appliedCoupon.maxDiscount);
                }
            } else {
                discount = appliedCoupon.discountValue;
            }
            return Math.min(discount, orderTotal);
        },

        clearCoupon: () => {
            set((s) => {
                s.appliedCoupon = null;
                s.couponCode = '';
                s.discount = 0;
                s.error = null;
            });
        },
    }))
);
