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
    spiralBinding?: number;
  };
}

export interface Shop {
  id: string;
  name: string;
  address: string;
  timing?: string;
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
}

export interface PricingDetails {
  basePricePerPage: number;
  bindingCost: number;
  emergencyCost: number;
  commission: number;
}

export interface OrderDoc {
  userId: string;
  shopId: string;
  shopName: string;
  userName: string;
  fileName: string;
  fileUrl: string;
  totalPages: number;
  totalCost: number;
  status: 'pending' | 'processing' | 'printing' | 'completed' | 'cancelled';
  timestamp: any; // Firestore Timestamp
  emergency: boolean;
  printSettings: PrintSettings;
  pricingDetails: PricingDetails;
}
