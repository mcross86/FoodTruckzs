import { z } from "zod";

export const vendorIdParamsSchema = z.object({
  vendorId: z.string().uuid(),
});

export const paymentIdParamsSchema = z.object({
  paymentId: z.string().uuid(),
});

export const createStripeOnboardingLinkSchema = z.object({
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
});

export const createDepositCheckoutSessionSchema = z.object({
  agreementId: z.string().uuid(),
  paymentScheduleItemId: z.string().uuid(),
});

export const listVendorPaymentsQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
});

export type CreateStripeOnboardingLinkDto = z.infer<typeof createStripeOnboardingLinkSchema>;
export type CreateDepositCheckoutSessionDto = z.infer<typeof createDepositCheckoutSessionSchema>;
