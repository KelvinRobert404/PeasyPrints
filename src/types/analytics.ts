export type AnalyticsEventName =
  | 'page_view'
  | 'upload_selected'
  | 'upload_analyzed'
  | 'pricing_recalculated'
  | 'checkout_clicked'
  | 'razorpay_order_created'
  | 'razorpay_payment_succeeded'
  | 'razorpay_payment_failed'
  | 'order_created'
  | 'order_creation_failed'
  | 'feature_flag_ready'
  | 'feature_flag_used'
  | 'offline_queue_applied'
  | 'error';

export interface BaseEventProperties {
  // Common context
  $current_url?: string;
  $pathname?: string;
  $screen_width?: number;
  $screen_height?: number;
  userId?: string;
  shopId?: string;
  shopName?: string;
  // Upload/pricing context
  totalPages?: number;
  totalCost?: number;
  printSettings?: {
    paperSize: 'A3' | 'A4';
    printFormat: 'Single-Sided' | 'Double-Sided';
    printColor: 'Black & White' | 'Color';
    orientation: 'Vertical' | 'Horizontal';
    binding?: 'Soft Binding' | 'Spiral Binding' | 'Hard Binding' | '';
    copies?: number;
    emergency?: boolean;
    afterDark?: boolean;
    extraColorPages?: number;
  };
  // Payment context
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  status?: string;
  // Error context
  error?: string;
}


