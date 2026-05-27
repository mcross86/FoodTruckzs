import { z } from "zod";

export const discoveryNearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  openNow: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  radiusM: z.coerce.number().int().min(100).max(100_000).optional().default(15_000),
  serviceArea: z.string().trim().min(1).max(120).optional(),
});

export type DiscoveryNearbyQuery = z.infer<typeof discoveryNearbyQuerySchema>;

export const discoveryTruckSlugParamsSchema = z.object({
  vendorSlug: z.string().trim().min(1),
});
