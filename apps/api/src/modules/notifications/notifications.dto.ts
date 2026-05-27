import { z } from "zod";

const uuidSchema = z.string().uuid();

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const notificationParamsSchema = z.object({
  notificationId: uuidSchema,
});

export const notificationPreferenceSchema = z.object({
  channel: z.enum(["in_app", "email"]),
  isEnabled: z.boolean(),
  notificationType: z.string().trim().min(1).max(100),
});

export const updateNotificationPreferencesSchema = z.object({
  preferences: z.array(notificationPreferenceSchema).max(100),
});

export type NotificationListQueryDto = z.infer<typeof notificationListQuerySchema>;
export type UpdateNotificationPreferencesDto = z.infer<typeof updateNotificationPreferencesSchema>;
