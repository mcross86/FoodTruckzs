import { z } from "zod";

import { isRfqNumberIdentifier, isUuidRfqIdentifier } from "./rfq-identifier.js";

const trimmedString = z.string().trim();
const uuidSchema = z.uuid();

export const rfqIdentifierSchema = z
  .string()
  .trim()
  .refine((value) => isUuidRfqIdentifier(value) || isRfqNumberIdentifier(value), {
    message: "RFQ identifier must be a UUID or a numeric RFQ number (1-8 digits).",
  });
const optionalText = trimmedString.min(1).max(4_000).optional();
const tagListSchema = z.array(trimmedString.min(1).max(100)).max(40).default([]);
const positiveIntegerSchema = z.number().int().positive();
const nonNegativeMoneySchema = z.number().int().min(0);
const dateTimeSchema = trimmedString.datetime({ offset: true });
const phoneSchema = trimmedString.min(7).max(40);

export const rfqIdParamsSchema = z.object({
  rfqId: rfqIdentifierSchema,
});

export const vendorRfqListParamsSchema = z.object({
  vendorId: uuidSchema,
});

export const rfqTargetActionParamsSchema = z.object({
  rfqId: rfqIdentifierSchema,
  targetId: uuidSchema,
});

export const messageThreadParamsSchema = z.object({
  threadId: uuidSchema,
});

export const rfqListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  status: trimmedString.min(1).max(40).optional(),
  targetStatus: trimmedString.min(1).max(40).optional(),
});

const contactSchema = z.object({
  email: trimmedString.email(),
  name: trimmedString.min(2).max(160),
  phone: phoneSchema,
});

const venueSchema = z.object({
  additionalInsuredRequired: z.boolean().optional(),
  allowsFoodTrucks: z.boolean().optional(),
  businessLicenseRequired: z.boolean().optional(),
  canRemainOnsite: z.boolean().optional(),
  city: trimmedString.min(1).max(120),
  coiRequired: z.boolean().optional(),
  country: trimmedString.min(2).max(2).default("US"),
  departureTime: trimmedString.regex(/^\d{2}:\d{2}(?::\d{2})?$/).optional(),
  estimatedDistanceFromTruckToGuestsFeet: z.number().int().min(0).optional(),
  fireInspectionRequired: z.boolean().optional(),
  gateOrSecurityInstructions: optionalText,
  generatorAllowed: z.boolean().optional(),
  greaseDisposalExpectations: optionalText,
  healthPermitRequired: z.boolean().optional(),
  indoorOutdoor: z.enum(["indoor", "outdoor", "mixed"]),
  line1: trimmedString.min(1).max(180),
  line2: trimmedString.max(180).optional(),
  loadInInstructions: optionalText,
  noiseRestrictions: optionalText,
  onsiteContactName: trimmedString.min(2).max(160),
  onsiteContactPhone: phoneSchema,
  openFlameRestrictions: optionalText,
  parkingNotes: optionalText,
  permitResponsibility: trimmedString.min(1).max(120).optional(),
  postalCode: trimmedString.min(1).max(20).optional(),
  powerAvailable: z.boolean().optional(),
  powerType: trimmedString.min(1).max(80).optional(),
  restrictionDescription: optionalText,
  restroomAccessForStaff: z.boolean().optional(),
  setupAccessTime: trimmedString.regex(/^\d{2}:\d{2}(?::\d{2})?$/).optional(),
  spaceAvailableForTruckAndLine: z.boolean().optional(),
  state: trimmedString.min(2).max(32),
  surfaceIsLevel: z.boolean().optional(),
  surfaceType: trimmedString.min(1).max(80).optional(),
  truckParkingLocation: trimmedString.min(1).max(240).optional(),
  venueName: trimmedString.min(1).max(180),
  wasteDisposalAvailable: z.boolean().optional(),
  waterAccessAvailable: z.boolean().optional(),
  weatherBackupPlan: optionalText,
});

const serviceStyleSchema = z.object({
  cashierNeeded: z.boolean().optional(),
  cleanupStaffNeeded: z.boolean().optional(),
  desiredMealsPerHour: z.number().int().positive().optional(),
  desiredServiceStyle: trimmedString.min(1).max(120),
  guestArrivalPattern: trimmedString.min(1).max(120).optional(),
  guestPaymentModel: trimmedString.min(1).max(120),
  mealPeriod: trimmedString.min(1).max(80),
  menuSignageNeeded: z.boolean().optional(),
  orderAheadNeeded: z.boolean().optional(),
  serviceEndsAt: dateTimeSchema,
  servicePointsRequested: z.number().int().positive().optional(),
  serviceStartsAt: dateTimeSchema,
  servingStaffNeeded: z.boolean().optional(),
});

const foodRequirementsSchema = z.object({
  allergyNotes: optionalText,
  buffetLabelsRequired: z.boolean().optional(),
  crossContaminationSensitive: z.boolean().optional(),
  cuisinePreferences: tagListSchema,
  dairyFreeCount: z.number().int().min(0).optional(),
  dietaryAccommodations: tagListSchema,
  dishesToAvoid: tagListSchema,
  glutenFreeCount: z.number().int().min(0).optional(),
  individuallyPackagedMeals: z.boolean().optional(),
  mealComponents: tagListSchema,
  menuPreference: trimmedString.min(1).max(120),
  mustHaveDishes: tagListSchema,
  nutFreeRequired: z.boolean().optional(),
  otherAllergyNotes: optionalText,
  shellfishAllergy: z.boolean().optional(),
  spiceLevel: trimmedString.min(1).max(80).optional(),
  veganCount: z.number().int().min(0).optional(),
  vegetarianCount: z.number().int().min(0).optional(),
});

const equipmentSchema = z.object({
  expectsVendorServiceware: z.boolean(),
  expectsVendorTablesOrTenting: z.boolean(),
  requests: z
    .array(
      z.object({
        item: trimmedString.min(1).max(120),
        notes: trimmedString.max(500).optional(),
        quantity: z.number().int().positive().optional(),
        required: z.boolean().default(false),
      }),
    )
    .max(80)
    .default([]),
  trashCleanup: trimmedString.min(1).max(160),
});

const budgetSchema = z
  .object({
    balanceMayBeCollectedOnsite: z.boolean().optional(),
    budgetFlexibility: trimmedString.min(1).max(120),
    budgetMaxCents: nonNegativeMoneySchema.optional(),
    budgetMinCents: nonNegativeMoneySchema.optional(),
    corporateBillingContact: optionalText,
    depositReadiness: trimmedString.min(1).max(120),
    desiredDepositDate: dateTimeSchema.optional(),
    finalPaymentPreference: trimmedString.min(1).max(160).optional(),
    invoiceOrReceiptNeeded: z.boolean().optional(),
    payer: trimmedString.min(1).max(120),
    purchaseOrderRequired: z.boolean().optional(),
    quoteResponseDeadline: dateTimeSchema.optional(),
    taxExempt: z.boolean().optional(),
  })
  .refine(
    (budget) =>
      budget.budgetMinCents === undefined ||
      budget.budgetMaxCents === undefined ||
      budget.budgetMinCents <= budget.budgetMaxCents,
    {
      message: "Budget minimum cannot exceed budget maximum.",
      path: ["budgetMinCents"],
    },
  );

const attachmentMetadataSchema = z.object({
  category: trimmedString.min(1).max(120),
  contentType: trimmedString.min(1).max(120).optional(),
  fileId: uuidSchema.optional(),
  fileName: trimmedString.min(1).max(240),
  notes: trimmedString.max(500).optional(),
  sizeBytes: z.number().int().positive().max(25_000_000).optional(),
});

export const createRfqSchema = z
  .object({
    attachments: z.array(attachmentMetadataSchema).max(20).default([]),
    eventBasics: z.object({
      ageMix: trimmedString.min(1).max(80).optional(),
      customerType: trimmedString.min(1).max(80),
      endsAt: dateTimeSchema,
      eventName: trimmedString.min(2).max(180),
      eventType: trimmedString.min(1).max(100),
      eventWebsiteUrl: trimmedString.url().optional(),
      estimatedHeadcount: positiveIntegerSchema,
      isOpenToPublic: z.boolean().default(false),
      isRecurring: z.boolean().default(false),
      primaryContact: contactSchema,
      startsAt: dateTimeSchema,
      timezone: trimmedString.min(1).max(80),
    }),
    foodRequirements: foodRequirementsSchema,
    serviceStyle: serviceStyleSchema,
    targetVendorIds: z.array(uuidSchema).max(12).default([]),
    venue: venueSchema,
    budget: budgetSchema,
    equipment: equipmentSchema,
    specialNotes: optionalText,
  })
  .refine(
    (input) =>
      new Date(input.eventBasics.startsAt).getTime() < new Date(input.eventBasics.endsAt).getTime(),
    {
      message: "Event start time must be before event end time.",
      path: ["eventBasics", "startsAt"],
    },
  )
  .refine(
    (input) =>
      new Date(input.serviceStyle.serviceStartsAt).getTime() <
      new Date(input.serviceStyle.serviceEndsAt).getTime(),
    {
      message: "Service start time must be before service end time.",
      path: ["serviceStyle", "serviceStartsAt"],
    },
  );

export const acceptRfqTargetSchema = z.object({
  note: trimmedString.max(1_000).optional(),
});

export const rejectRfqTargetSchema = z.object({
  note: trimmedString.max(1_000).optional(),
  reasonCode: z.enum([
    "unavailable",
    "outside_service_area",
    "budget_too_low",
    "poor_fit",
    "other",
  ]),
});

export const requestClarificationSchema = z.object({
  body: trimmedString.min(1).max(4_000),
});

export const sendThreadMessageSchema = z.object({
  body: trimmedString.min(1).max(4_000),
});

export const markThreadReadSchema = z.object({
  lastReadMessageId: uuidSchema.optional(),
});

export type AcceptRfqTargetDto = z.infer<typeof acceptRfqTargetSchema>;
export type CreateRfqDto = z.infer<typeof createRfqSchema>;
export type MarkThreadReadDto = z.infer<typeof markThreadReadSchema>;
export type RejectRfqTargetDto = z.infer<typeof rejectRfqTargetSchema>;
export type RequestClarificationDto = z.infer<typeof requestClarificationSchema>;
export type RfqListQueryDto = z.infer<typeof rfqListQuerySchema>;
export type SendThreadMessageDto = z.infer<typeof sendThreadMessageSchema>;
