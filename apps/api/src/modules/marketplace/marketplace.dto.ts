import { z } from "zod";

const trimmedString = z.string().trim();
const nonNegativeMoneySchema = z.coerce.number().int().min(0);
const positiveIntegerSchema = z.coerce.number().int().positive();

export const publicVendorSearchQuerySchema = z
  .object({
    budgetMaxCents: nonNegativeMoneySchema.optional(),
    budgetMinCents: nonNegativeMoneySchema.optional(),
    cuisine: trimmedString.min(1).max(90).optional(),
    guestCount: positiveIntegerSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(24),
    serviceArea: trimmedString.min(1).max(140).optional(),
    serviceStyle: trimmedString.min(1).max(80).optional(),
  })
  .refine(
    (query) =>
      query.budgetMinCents === undefined ||
      query.budgetMaxCents === undefined ||
      query.budgetMinCents <= query.budgetMaxCents,
    {
      message: "Budget minimum cannot exceed budget maximum.",
      path: ["budgetMinCents"],
    },
  );

export const publicVendorSlugParamsSchema = z.object({
  vendorSlug: trimmedString.min(1).max(120),
});

export type PublicVendorSearchQueryDto = z.infer<typeof publicVendorSearchQuerySchema>;
