export type PrintFormat = 'Single-Sided' | 'Double-Sided';
export type PrintColor = 'Black & White' | 'Color';
export type PaperSize = 'A3' | 'A4';

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
  userId: string;
  shopId: string;
  shopName: string;
  userName: string;
  fileName: string;
  fileUrl: string;
  totalPages: number;
  totalCost: number;
  status: 'pending' | 'processing' | 'printing' | 'printed' | 'collected' | 'completed' | 'cancelled';
  timestamp: any; // Firestore Timestamp
  emergency: boolean;
  afterDark?: boolean;
  printSettings: PrintSettings;
  pricingDetails: PricingDetails;
}
