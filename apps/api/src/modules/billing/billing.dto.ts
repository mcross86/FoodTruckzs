import { z } from "zod";

const uuidSchema = z.uuid();
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const platformBillingQuerySchema = z.object({
  vendorId: uuidSchema.optional(),
});

export const vendorBillingParamsSchema = z.object({
  vendorId: uuidSchema,
});

export const createVendorInvoiceSchema = z.object({
  billingPeriodEnd: dateStringSchema,
  billingPeriodStart: dateStringSchema,
  vendorId: uuidSchema,
});

export type PlatformBillingQueryDto = z.infer<typeof platformBillingQuerySchema>;
export type CreateVendorInvoiceDto = z.infer<typeof createVendorInvoiceSchema>;
