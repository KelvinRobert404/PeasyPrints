import { z } from 'zod';

export const PrintSettingsSchema = z.object({
  paperSize: z.enum(['A3', 'A4']),
  printFormat: z.enum(['Single-Sided', 'Double-Sided']),
  printColor: z.enum(['Black & White', 'Color']),
  orientation: z.enum(['Vertical', 'Horizontal']),
  binding: z.enum(['Soft Binding', 'Spiral Binding', 'Hard Binding', '']).optional().default(''),
  copies: z.number().int().min(1).max(50),
  extraColorPages: z.number().int().min(0).max(5000).optional().default(0),
  emergency: z.boolean().optional().default(false),
  afterDark: z.boolean().optional().default(false),
});

export const CheckoutQuoteSchema = z.object({
  shopId: z.string().trim().min(1).max(128),
  totalPages: z.number().int().min(1).max(5000),
  printSettings: PrintSettingsSchema,
  jobType: z.enum(['PDF', 'Images', 'Assignment']).optional().default('PDF'),
  assignment: z.object({
    colorPages: z.array(z.number().int().min(1).max(5000)).max(5000),
  }).optional(),
}).superRefine((value, context) => {
  if (value.printSettings.extraColorPages > value.totalPages) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['printSettings', 'extraColorPages'], message: 'Color page count exceeds total pages' });
  }
  if (value.assignment?.colorPages.some((page) => page > value.totalPages)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['assignment', 'colorPages'], message: 'Assignment page exceeds total pages' });
  }
});

export const FinalizeOrderSchema = z.object({
  razorpayOrderId: z.string().trim().min(1).max(128),
  razorpayPaymentId: z.string().trim().min(1).max(128),
  filePath: z.string().trim().min(1).max(1024),
  fileName: z.string().trim().min(1).max(255),
  splitFiles: z.object({
    bwPath: z.string().trim().min(1).max(1024),
    colorPath: z.string().trim().min(1).max(1024),
    originalPath: z.string().trim().min(1).max(1024).optional(),
  }).optional(),
  userName: z.string().trim().max(160).optional(),
});

export type CheckoutQuoteInput = z.infer<typeof CheckoutQuoteSchema>;

