import { z } from "zod";

export const agreementIdParamsSchema = z.object({
  agreementId: z.string().uuid(),
});

export const quoteAgreementParamsSchema = z.object({
  quoteId: z.string().uuid(),
});

export const signAgreementSchema = z.object({
  acceptedTermsVersion: z.string().uuid(),
  acknowledgements: z
    .object({
      cancellationPolicy: z.literal(true),
      customerResponsibilities: z.literal(true),
      paymentTerms: z.literal(true),
    })
    .strict(),
  signatureMetadata: z.record(z.string(), z.unknown()).optional().default({}),
  typedName: z.string().trim().min(2).max(160),
});

export type SignAgreementDto = z.infer<typeof signAgreementSchema>;
