export type PrintFormat = 'Single-Sided' | 'Double-Sided';
export type PrintColor = 'Black & White' | 'Color';
export type PaperSize = 'A3' | 'A4';

export type PrintJobType = 'PDF' | 'Images' | 'Assignment';

export interface ShopPricing {
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
  services: {
    softBinding?: number;
    hardBinding?: number;
    emergency?: number;
    afterDark?: number;
    spiralBinding?: number;
  };
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