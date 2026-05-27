import { z } from "zod";

const uuidSchema = z.uuid();
const trimmedString = z.string().trim();
const optionalNoteSchema = trimmedString.min(1).max(2_000).optional();
const requiredNoteSchema = trimmedString.min(1).max(2_000);
const dateTimeSchema = trimmedString.datetime({ offset: true }).optional();

export const adminVendorListQuerySchema = z.object({
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  search: trimmedString.min(1).max(120).optional(),
});

export const adminVendorParamsSchema = z.object({
  vendorId: uuidSchema,
});

export const vendorApprovalDecisionSchema = z.object({
  note: optionalNoteSchema,
});

export const vendorRejectionSchema = z.object({
  reason: requiredNoteSchema,
});

export const vendorRequestChangesSchema = z.object({
  note: requiredNoteSchema,
});

export const marketplaceVisibilitySchema = z
  .object({
    isPublished: z.boolean().optional(),
    reason: optionalNoteSchema,
    status: z.enum(["active", "suspended"]).optional(),
  })
  .refine((value) => value.isPublished !== undefined || value.status !== undefined, {
    message: "Provide isPublished or status.",
  });

export const adminRfqListQuerySchema = z.object({
  search: trimmedString.min(1).max(120).optional(),
  status: z
    .enum([
      "draft",
      "submitted",
      "vendor_reviewing",
      "clarification_requested",
      "quote_in_progress",
      "quote_sent",
      "negotiation",
      "accepted",
      "agreement_pending",
      "agreement_signed",
      "deposit_paid",
      "confirmed",
      "completed",
      "cancelled",
    ])
    .optional(),
});

export const adminRfqParamsSchema = z.object({
  rfqId: uuidSchema,
});

export const adminNoteSchema = z.object({
  note: requiredNoteSchema,
});

export const adminDisputeStatusSchema = z.object({
  note: optionalNoteSchema,
  status: z.enum(["open", "monitoring", "resolved", "dismissed"]),
});

export const adminPaymentListQuerySchema = z.object({
  dateFrom: dateTimeSchema,
  dateTo: dateTimeSchema,
  status: z
    .enum([
      "requires_payment",
      "checkout_created",
      "processing",
      "succeeded",
      "failed",
      "cancelled",
      "refund_pending",
      "partially_refunded",
      "refunded",
    ])
    .optional(),
  vendorId: uuidSchema.optional(),
});

export const adminWebhookListQuerySchema = z.object({
  failedOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  status: z.enum(["received", "processed", "failed", "ignored"]).optional(),
});

export type AdminVendorListQueryDto = z.infer<typeof adminVendorListQuerySchema>;
export type MarketplaceVisibilityDto = z.infer<typeof marketplaceVisibilitySchema>;
export type AdminRfqListQueryDto = z.infer<typeof adminRfqListQuerySchema>;
export type AdminPaymentListQueryDto = z.infer<typeof adminPaymentListQuerySchema>;
export type AdminWebhookListQueryDto = z.infer<typeof adminWebhookListQuerySchema>;
