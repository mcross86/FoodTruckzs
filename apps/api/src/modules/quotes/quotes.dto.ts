import { z } from "zod";

import { rfqIdentifierSchema } from "../rfqs/rfqs.dto.js";
import { QUOTE_LINE_ITEM_TYPES } from "./quote-calculation.js";

const trimmedString = z.string().trim();
const uuidSchema = z.uuid();
const dateTimeSchema = trimmedString.datetime({ offset: true });
const optionalText = trimmedString.min(1).max(4_000).optional();
const nonNegativeMoneySchema = z.number().int().min(0);

export const quoteIdParamsSchema = z.object({
  quoteId: uuidSchema,
});

export const rfqQuoteParamsSchema = z.object({
  rfqId: rfqIdentifierSchema,
});

const quoteLineItemSchema = z
  .object({
    description: trimmedString.max(1_000).optional(),
    isInternal: z.boolean().default(false),
    isOptional: z.boolean().default(false),
    name: trimmedString.min(1).max(180),
    quantity: z.number().int().positive(),
    taxable: z.boolean().default(false),
    type: z.enum(QUOTE_LINE_ITEM_TYPES),
    unit: trimmedString.min(1).max(80).default("each"),
    unitAmountCents: z.number().int(),
  })
  .refine((lineItem) => lineItem.type === "discount" || lineItem.unitAmountCents >= 0, {
    message: "Only discount line items can use a negative unit amount.",
    path: ["unitAmountCents"],
  });

const paymentScheduleItemSchema = z.object({
  amountCents: nonNegativeMoneySchema,
  dueAt: dateTimeSchema.optional(),
  label: trimmedString.min(1).max(180),
  type: z.enum(["deposit", "milestone", "final_balance", "invoice", "onsite"]),
});

const quoteWriteBaseSchema = z.object({
  assumptions: z.array(trimmedString.min(1).max(500)).max(30).default([]),
  cancellationPolicySummary: optionalText,
  depositRequiredCents: nonNegativeMoneySchema.default(0),
  exclusions: z.array(trimmedString.min(1).max(500)).max(30).default([]),
  expiresAt: dateTimeSchema,
  lineItems: z.array(quoteLineItemSchema).min(1).max(120),
  menuSummary: trimmedString.min(1).max(2_000),
  notes: optionalText,
  paymentSchedule: z.array(paymentScheduleItemSchema).min(1).max(20),
  serviceStyle: trimmedString.min(1).max(180),
});

export const createQuoteSchema = quoteWriteBaseSchema.extend({
  vendorId: uuidSchema,
});

export const createQuoteRevisionSchema = quoteWriteBaseSchema.extend({
  notes: trimmedString.min(1).max(4_000),
});

export const acceptQuoteSchema = z.object({
  acceptedRevisionId: uuidSchema,
});

export const declineQuoteSchema = z.object({
  reason: trimmedString.max(1_000).optional(),
});

export const requestQuoteRevisionSchema = z.object({
  message: trimmedString.min(1).max(4_000),
  requestedRevisionId: uuidSchema,
  reasonCodes: z
    .array(
      z.enum([
        "guest_count_change",
        "menu_change",
        "service_style_change",
        "venue_logistics_change",
        "budget_adjustment",
        "equipment_rental_change",
        "date_time_change",
        "other",
      ]),
    )
    .max(10)
    .default([]),
});

export type AcceptQuoteDto = z.infer<typeof acceptQuoteSchema>;
export type CreateQuoteDto = z.infer<typeof createQuoteSchema>;
export type CreateQuoteRevisionDto = z.infer<typeof createQuoteRevisionSchema>;
export type DeclineQuoteDto = z.infer<typeof declineQuoteSchema>;
export type RequestQuoteRevisionDto = z.infer<typeof requestQuoteRevisionSchema>;
