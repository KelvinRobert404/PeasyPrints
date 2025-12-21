export type PrintFormat = 'Single-Sided' | 'Double-Sided';
export type PrintColor = 'Black & White' | 'Color';
export type PaperSize = 'A3' | 'A4';

export type PrintJobType = 'PDF' | 'Images' | 'Assignment';

export interface PricingTier {
  minPages: number;
  maxPages: number;
  // Full pricing configuration for this tier
  a4: {
    singleBW: number;
    doubleBW: number;
    singleColor: number;
    doubleColor: number;
  };
  a3: {
    singleBW: number;
    doubleBW: number;
    singleColor: number;
    doubleColor: number;
  };
}

export interface ShopPricing {
  // Legacy fields kept optional for backwards compatibility during migration,
  // but unified "tiers" is now the source of truth if present.
  a4?: {
    singleBW: number;
    doubleBW: number;
    singleColor: number;
    doubleColor: number;
  };
  a3?: {
    singleBW: number;
    doubleBW: number;
    singleColor: number;
    doubleColor: number;
  };
  services: {
    softBinding?: number;
    hardBinding?: number;
    emergency?: number;
    afterDark?: number;
    spiralBinding?: number;
  };
  // Unified tier-based pricing (overrides flat per-page pricing)
  tiers?: PricingTier[];
  // Convenience fee per order (flat amount) - DEPRECATED in favor of tiers
  convenienceFee?: number;
  // Tiered convenience fee (e.g. 1-5 pages: Rs 2, 6-10 pages: Rs 5)
  convenienceFeeTiers?: {
    minPages: number;
    maxPages: number;
    fee: number;
  }[];
}

export interface Shop {
  id: string;
  name: string;
  address: string;
  timing?: string;
  openingTime?: string;
  closingTime?: string;
  logoUrl?: string;
  pricing?: ShopPricing;
  // Whether the storefront is open for customers
  isOpen?: boolean;
  // College this shop belongs to
  collegeId?: string;
}

export interface PrintSettings {
  paperSize: PaperSize;
  printFormat: PrintFormat;
  printColor: PrintColor;
  orientation: 'Vertical' | 'Horizontal';
  binding?: 'Soft Binding' | 'Spiral Binding' | 'Hard Binding' | '';
  copies: number;
  customMessage?: string;
  vinylColor?: string;
  extraColorPages?: number;
  emergency?: boolean;
  afterDark?: boolean;
}

export interface PricingDetails {
  basePricePerPage: number;
  bindingCost: number;
  emergencyCost: number;
  afterDarkCost?: number;
  commission: number;
  convenienceFee?: number;
  couponDiscount?: number;
  couponCode?: string;
}

export interface OrderDoc {
  // Optional Firestore document id for routing/navigation
  id?: string;
  jobType?: PrintJobType;
  userId: string;
  shopId: string;
  shopName: string;
  userName: string;
  fileName: string;
  fileUrl: string;
  // Optional multi-file support for complex jobs (e.g., assignments split)
  // Prefer named fields over array for clarity in shopfront UI
  splitFiles?: { bwUrl: string; colorUrl: string };
  // Optional assignment metadata (for color page indices)
  assignment?: { colorPages: number[] };
  totalPages: number;
  totalCost: number;
  status: 'pending' | 'processing' | 'printing' | 'printed' | 'collected' | 'completed' | 'cancelled';
  timestamp: any; // Firestore Timestamp
  emergency: boolean;
  afterDark?: boolean;
  printSettings: PrintSettings;
  pricingDetails: PricingDetails;
  // Optional coupon applied to order
  couponCode?: string;
  couponDiscount?: number;
}

// Marketplace types

export type ListingCategory = 'student' | 'housing' | 'tickets';

export type ListingStatus = 'pending_moderation' | 'active' | 'hidden' | 'removed';

export interface ListingLocation {
  lat: number;
  lng: number;
  area: string; // e.g. "Kothanur"
}

export interface Listing {
  id: string;
  category: ListingCategory;
  status: ListingStatus;
  collegeName: string; // e.g. "Kristu Jayanti College"
  title: string;
  description?: string;
  price?: number; // item price / monthly rent / per-ticket
  images: string[]; // up to 3 image URLs
  tags: string[]; // boolean-like attributes rendered as pills
  whatsappAllowed: boolean;
  whatsappNumber?: string;
  createdAt: any; // Firestore Timestamp
  authorId: string;
  authorName?: string;
  authorVerified: boolean;
  location: ListingLocation;
}

// Coupon types

export type CouponDiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number; // Percentage (0-100) or fixed amount in rupees
  minOrderAmount?: number; // Minimum order value to apply coupon
  maxDiscount?: number; // Cap on discount for percentage coupons
  validFrom?: any; // Firestore Timestamp
  validUntil?: any; // Firestore Timestamp
  usageLimit?: number; // Max total uses
  usageCount: number; // Current usage count
  shopIds?: string[]; // Empty/undefined = all shops
  active: boolean;
  createdAt: any; // Firestore Timestamp
  createdBy?: string; // Admin email who created
}

// Marketplace user verification

export interface MarketplaceUser {
  id: string;
  clerkId?: string;
  email: string;
  name: string;
  phone?: string;
  verified: boolean;
  verifiedAt?: any; // Firestore Timestamp
  verifiedBy?: string; // Admin email
  createdAt: any; // Firestore Timestamp
  listingsCount?: number;
}

// College types

export interface College {
  id: string;
  name: string;
  shortName?: string;
  createdAt: any; // Firestore Timestamp
}