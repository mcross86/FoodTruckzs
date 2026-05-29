import { z } from "zod";

const trimmedString = z.string().trim();
const uuidSchema = z.uuid();
const isoDateTimeSchema = trimmedString.datetime({ offset: true });

export const calendarEventTypes = [
  "confirmed_catering",
  "manual_booking",
  "food_truck_location",
  "festival",
  "blocked_time",
] as const;

export const calendarViews = ["month", "week", "day", "agenda", "timeline"] as const;

export const vendorIdParamsSchema = z.object({
  vendorId: uuidSchema,
});

export const calendarEventIdParamsSchema = vendorIdParamsSchema.extend({
  eventId: uuidSchema,
});

export const listCalendarEventsQuerySchema = z.object({
  startsFrom: isoDateTimeSchema,
  startsTo: isoDateTimeSchema,
  types: trimmedString.optional(),
  view: z.enum(calendarViews).default("agenda"),
});

export const calendarRecurrenceSchema = z
  .object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    frequency: z.enum(["weekly", "biweekly"]),
    occurrenceCount: z.number().int().min(2).max(52).optional(),
    until: trimmedString.regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((value) => value.occurrenceCount !== undefined || value.until !== undefined, {
    message: "Provide occurrenceCount or until for recurring events.",
  });

export const createCalendarEventSchema = z.object({
  endsAt: isoDateTimeSchema,
  isBlocking: z.boolean().optional(),
  location: trimmedString.min(1).max(240).optional(),
  notes: trimmedString.max(4_000).optional(),
  recurrence: calendarRecurrenceSchema.optional(),
  startsAt: isoDateTimeSchema,
  status: z.enum(["tentative", "confirmed", "blocking"]).optional(),
  title: trimmedString.min(2).max(180),
  type: z.enum(["manual_booking", "food_truck_location", "festival", "blocked_time"]),
});

export type CalendarView = (typeof calendarViews)[number];
export type CalendarEventType = (typeof calendarEventTypes)[number];
export type CalendarRecurrenceDto = z.infer<typeof calendarRecurrenceSchema>;
export type CreateCalendarEventDto = z.infer<typeof createCalendarEventSchema>;
export type ListCalendarEventsQueryDto = z.infer<typeof listCalendarEventsQuerySchema>;
