import { z } from "zod";

import { VENDOR_ROLES } from "../auth/auth.types.js";

const trimmedString = z.string().trim();
const optionalText = trimmedString.min(1).max(2_000).optional();
const tagListSchema = z.array(trimmedString.min(1).max(80)).max(25).default([]);
const uuidSchema = z.uuid();
const nonNegativeMoneySchema = z.number().int().min(0);
const positiveIntegerSchema = z.number().int().positive();

export const vendorIdParamsSchema = z.object({
  vendorId: uuidSchema,
});

export const menuIdParamsSchema = vendorIdParamsSchema.extend({
  menuId: uuidSchema,
});

export const menuItemIdParamsSchema = menuIdParamsSchema.extend({
  itemId: uuidSchema,
});

export const menuPackageIdParamsSchema = menuIdParamsSchema.extend({
  packageId: uuidSchema,
});

export const membershipIdParamsSchema = vendorIdParamsSchema.extend({
  membershipId: uuidSchema,
});

export const cuisineIdParamsSchema = z.object({
  cuisineId: uuidSchema,
});

export const createVendorAccountSchema = z.object({
  averageResponseTimeMinutes: positiveIntegerSchema.optional(),
  businessName: trimmedString.min(2).max(160),
  businessEmail: trimmedString.email().optional(),
  businessLicenseMetadata: z.record(z.string(), z.unknown()).default({}),
  businessPhone: trimmedString.min(7).max(40).optional(),
  cateringMinimumCents: nonNegativeMoneySchema.optional(),
  cuisineIds: z.array(uuidSchema).max(12).default([]),
  description: optionalText,
  headline: trimmedString.max(180).optional(),
  insuranceMetadata: z.record(z.string(), z.unknown()).default({}),
  ownerContactName: trimmedString.min(2).max(160).optional(),
  pricingSummary: trimmedString.max(240).optional(),
  profileDescription: optionalText,
  serviceAreas: z
    .array(
      z.object({
        city: trimmedString.min(1).max(120).optional(),
        metroArea: trimmedString.min(1).max(120),
        postalCode: trimmedString.min(1).max(20).optional(),
        radiusMiles: positiveIntegerSchema.optional(),
        state: trimmedString.min(2).max(32),
      }),
    )
    .max(20)
    .default([]),
  serviceStyles: tagListSchema,
  settings: z
    .object({
      defaultSetupMinutes: z.number().int().min(0).optional(),
      defaultTravelBufferMinutes: z.number().int().min(0).optional(),
      maxDailyBookings: positiveIntegerSchema.optional(),
      minimumGuestCount: positiveIntegerSchema.optional(),
      minimumLeadTimeDays: z.number().int().min(7).optional(),
      quoteResponseTargetHours: positiveIntegerSchema.optional(),
      requestAnywayOnBlackout: z.boolean().optional(),
      timezone: trimmedString.min(1).max(80).optional(),
      travelRadiusMiles: positiveIntegerSchema.optional(),
    })
    .optional(),
  socialLinks: z.record(z.string(), trimmedString.url()).default({}),
  websiteUrl: trimmedString.url().optional(),
});

export const updateVendorProfileSchema = z.object({
  averageResponseTimeMinutes: positiveIntegerSchema.optional(),
  businessEmail: trimmedString.email().optional(),
  businessName: trimmedString.min(2).max(160).optional(),
  businessPhone: trimmedString.min(7).max(40).optional(),
  cateringMinimumCents: nonNegativeMoneySchema.optional(),
  dietaryAccommodations: tagListSchema.optional(),
  headline: trimmedString.max(180).optional(),
  isPublished: z.boolean().optional(),
  ownerContactName: trimmedString.min(2).max(160).optional(),
  pricingSummary: trimmedString.max(240).optional(),
  publicDescription: optionalText,
  serviceStyles: tagListSchema.optional(),
  socialLinks: z.record(z.string(), trimmedString.url()).optional(),
  websiteUrl: trimmedString.url().optional(),
});

export const createMembershipSchema = z.object({
  role: z.enum(VENDOR_ROLES),
  userId: uuidSchema,
});

export const updateMembershipSchema = z.object({
  role: z.enum(VENDOR_ROLES).optional(),
  status: z.enum(["active", "invited", "suspended", "removed"]).optional(),
});

export const createCuisineSchema = z.object({
  isActive: z.boolean().default(true),
  name: trimmedString.min(2).max(80),
  slug: trimmedString
    .min(2)
    .max(90)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const updateCuisineSchema = z.object({
  isActive: z.boolean().optional(),
  name: trimmedString.min(2).max(80).optional(),
  slug: trimmedString
    .min(2)
    .max(90)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export const replaceVendorCuisinesSchema = z.object({
  cuisineIds: z.array(uuidSchema).min(1).max(12),
});

export const replaceServiceAreasSchema = z.object({
  serviceAreas: z
    .array(
      z.object({
        city: trimmedString.min(1).max(120).optional(),
        metroArea: trimmedString.min(1).max(120),
        postalCode: trimmedString.min(1).max(20).optional(),
        radiusMiles: positiveIntegerSchema.optional(),
        state: trimmedString.min(2).max(32),
      }),
    )
    .min(1)
    .max(20),
});

export const availabilityRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  effectiveEndDate: trimmedString.regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveStartDate: trimmedString.regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsAtLocal: trimmedString.regex(/^\d{2}:\d{2}(?::\d{2})?$/),
  startsAtLocal: trimmedString.regex(/^\d{2}:\d{2}(?::\d{2})?$/),
  timezone: trimmedString.min(1).max(80),
});

export const availabilityExceptionSchema = z.object({
  capacityLimit: z.number().int().min(0).optional(),
  endsAt: trimmedString.datetime({ offset: true }),
  reason: trimmedString.max(240).optional(),
  startsAt: trimmedString.datetime({ offset: true }),
  timezone: trimmedString.min(1).max(80),
  type: z.enum(["blackout", "special_hours", "capacity_limit"]),
});

export const replaceAvailabilitySchema = z.object({
  exceptions: z.array(availabilityExceptionSchema).max(60).default([]),
  rules: z.array(availabilityRuleSchema).max(21).default([]),
  settings: z.object({
    defaultSetupMinutes: z.number().int().min(0).optional(),
    defaultTravelBufferMinutes: z.number().int().min(0).optional(),
    maxDailyBookings: positiveIntegerSchema.optional(),
    minimumGuestCount: positiveIntegerSchema.optional(),
    minimumLeadTimeDays: z.number().int().min(7),
    quoteResponseTargetHours: positiveIntegerSchema.optional(),
    requestAnywayOnBlackout: z.boolean().default(false),
    timezone: trimmedString.min(1).max(80),
    travelRadiusMiles: positiveIntegerSchema,
  }),
});

export const createMenuSchema = z.object({
  description: optionalText,
  dietaryTags: tagListSchema,
  isPublic: z.boolean().default(false),
  items: z
    .array(
      z.object({
        category: trimmedString.max(80).optional(),
        description: optionalText,
        dietaryTags: tagListSchema,
        isAvailable: z.boolean().default(true),
        name: trimmedString.min(1).max(140),
        priceCents: nonNegativeMoneySchema.optional(),
        sortOrder: z.number().int().min(0).default(0),
      }),
    )
    .max(100)
    .default([]),
  maximumGuestCount: positiveIntegerSchema.optional(),
  minimumGuestCount: positiveIntegerSchema.optional(),
  name: trimmedString.min(2).max(140),
  packages: z
    .array(
      z.object({
        description: optionalText,
        dietaryTags: tagListSchema,
        includedItemIds: z.array(uuidSchema).max(50).default([]),
        isAvailable: z.boolean().default(true),
        maximumGuestCount: positiveIntegerSchema.optional(),
        minimumGuestCount: positiveIntegerSchema.optional(),
        name: trimmedString.min(1).max(140),
        priceCents: nonNegativeMoneySchema.optional(),
        pricingModel: z.enum(["fixed", "per_person", "market"]).default("fixed"),
        sortOrder: z.number().int().min(0).default(0),
      }),
    )
    .max(50)
    .default([]),
  prepLeadTimeHours: z.number().int().min(0).optional(),
  seasonalEndDate: trimmedString.regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  seasonalStartDate: trimmedString.regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  serviceStyles: tagListSchema,
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export const updateMenuSchema = createMenuSchema
  .omit({
    items: true,
    packages: true,
  })
  .partial();

export const createMenuItemSchema = z.object({
  category: trimmedString.max(80).optional(),
  description: optionalText,
  dietaryTags: tagListSchema,
  isAvailable: z.boolean().default(true),
  name: trimmedString.min(1).max(140),
  priceCents: nonNegativeMoneySchema.optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  status: z.enum(["active", "archived"]).optional(),
});

export const createMenuPackageSchema = z.object({
  description: optionalText,
  dietaryTags: tagListSchema,
  includedItemIds: z.array(uuidSchema).max(50).default([]),
  isAvailable: z.boolean().default(true),
  maximumGuestCount: positiveIntegerSchema.optional(),
  minimumGuestCount: positiveIntegerSchema.optional(),
  name: trimmedString.min(1).max(140),
  priceCents: nonNegativeMoneySchema.optional(),
  pricingModel: z.enum(["fixed", "per_person", "market"]).default("fixed"),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateMenuPackageSchema = createMenuPackageSchema.partial().extend({
  status: z.enum(["active", "archived"]).optional(),
});

export const updateBillingSettingsSchema = z.object({
  agreementFeeBasisPoints: z.number().int().min(0),
  billingEmail: trimmedString.email().optional(),
  invoiceTermsDays: positiveIntegerSchema,
});

export type CreateVendorAccountDto = z.infer<typeof createVendorAccountSchema>;
export type UpdateVendorProfileDto = z.infer<typeof updateVendorProfileSchema>;
export type CreateMembershipDto = z.infer<typeof createMembershipSchema>;
export type UpdateMembershipDto = z.infer<typeof updateMembershipSchema>;
export type CreateCuisineDto = z.infer<typeof createCuisineSchema>;
export type UpdateCuisineDto = z.infer<typeof updateCuisineSchema>;
export type ReplaceVendorCuisinesDto = z.infer<typeof replaceVendorCuisinesSchema>;
export type ReplaceServiceAreasDto = z.infer<typeof replaceServiceAreasSchema>;
export type ReplaceAvailabilityDto = z.infer<typeof replaceAvailabilitySchema>;
export type CreateMenuDto = z.infer<typeof createMenuSchema>;
export type UpdateMenuDto = z.infer<typeof updateMenuSchema>;
export type CreateMenuItemDto = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemDto = z.infer<typeof updateMenuItemSchema>;
export type CreateMenuPackageDto = z.infer<typeof createMenuPackageSchema>;
export type UpdateMenuPackageDto = z.infer<typeof updateMenuPackageSchema>;
export type UpdateBillingSettingsDto = z.infer<typeof updateBillingSettingsSchema>;
