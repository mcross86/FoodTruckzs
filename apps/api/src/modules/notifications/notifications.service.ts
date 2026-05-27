import { AuthorizationError, NotFoundError } from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import type { EmailDeliveryProvider } from "./email-provider.js";
import type {
  NotificationListQueryDto,
  UpdateNotificationPreferencesDto,
} from "./notifications.dto.js";
import type { NotificationRepository, VendorRecipientUser } from "./notifications.repository.js";

type NotificationChannel = "email" | "in_app";
type OutboxEvent = Awaited<ReturnType<NotificationRepository["claimOutboxEvents"]>>[number];
type NotificationRow = Awaited<ReturnType<NotificationRepository["listNotifications"]>>[number];
type NotificationPreferenceRow = Awaited<
  ReturnType<NotificationRepository["listNotificationPreferences"]>
>[number];

type NotificationRecipient = {
  email: string | null;
  userId: string;
};

type NotificationPlan = {
  body: string;
  entityId: string | null;
  entityType: string | null;
  recipients: NotificationRecipient[];
  title: string;
  type: SupportedNotificationType;
};

export type NotificationResult = {
  body: string;
  createdAt: Date;
  entityId: string | null;
  entityType: string | null;
  id: string;
  readAt: Date | null;
  title: string;
  type: string;
};

export type NotificationCenterResult = {
  notifications: NotificationResult[];
  unreadCount: number;
};

export type NotificationPreferenceResult = {
  channel: NotificationChannel;
  isEnabled: boolean;
  notificationType: SupportedNotificationType;
  required: boolean;
};

export type OutboxProcessingResult = {
  claimed: number;
  deadLettered: number;
  processed: number;
  retried: number;
};

export type NotificationService = {
  listNotifications: (
    ctx: RequestContext,
    query: NotificationListQueryDto,
  ) => Promise<NotificationCenterResult>;
  listPreferences: (ctx: RequestContext) => Promise<NotificationPreferenceResult[]>;
  markAllRead: (ctx: RequestContext) => Promise<{ updatedCount: number; unreadCount: number }>;
  markRead: (ctx: RequestContext, notificationId: string) => Promise<NotificationCenterResult>;
  processOutboxBatch: (batchSize: number) => Promise<OutboxProcessingResult>;
  processOutboxEvent: (event: OutboxEvent) => Promise<void>;
  updatePreferences: (
    ctx: RequestContext,
    input: UpdateNotificationPreferencesDto,
  ) => Promise<NotificationPreferenceResult[]>;
};

export type NotificationServiceDeps = {
  emailProvider: EmailDeliveryProvider;
  repository: NotificationRepository;
};

const supportedNotificationTypes = [
  "rfq.submitted",
  "rfq.clarification_requested",
  "quote.sent",
  "quote.accepted",
  "agreement.ready",
  "agreement.signed",
  "payment.deposit_paid",
  "event.confirmed",
  "platform_fee.created",
] as const;

type SupportedNotificationType = (typeof supportedNotificationTypes)[number];

const supportedTypeSet = new Set<string>(supportedNotificationTypes);
const supportedChannels: NotificationChannel[] = ["in_app", "email"];
const maxOutboxAttempts = 5;
const retryDelaysByAttemptNumberMs = new Map<number, number>([
  [2, 60_000],
  [3, 5 * 60_000],
  [4, 30 * 60_000],
  [5, 2 * 60 * 60_000],
]);

class PermanentNotificationError extends Error {}

function now(): Date {
  return new Date();
}

function assertAuthenticated(ctx: RequestContext): string {
  if (!ctx.userId) {
    throw new AuthorizationError("Authentication is required.");
  }
  return ctx.userId;
}

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function canonicalNotificationType(eventType: string): SupportedNotificationType | null {
  if (eventType === "calendar.confirmed_event_created") {
    return "event.confirmed";
  }

  if (supportedTypeSet.has(eventType)) {
    return eventType as SupportedNotificationType;
  }

  return null;
}

function eventNameLabel(value: string | null): string {
  return value ?? "the event";
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown notification processing error.";
}

function nextAvailableAt(failedAttempts: number, currentTime: Date): Date {
  const nextAttemptNumber = failedAttempts + 1;
  const delayMs = retryDelaysByAttemptNumberMs.get(nextAttemptNumber) ?? 2 * 60 * 60_000;
  return new Date(currentTime.getTime() + delayMs);
}

function toResult(notification: NotificationRow): NotificationResult {
  return {
    body: notification.body,
    createdAt: notification.createdAt,
    entityId: notification.entityId,
    entityType: notification.entityType,
    id: notification.id,
    readAt: notification.readAt,
    title: notification.title,
    type: notification.type,
  };
}

function preferenceKey(notificationType: string, channel: NotificationChannel): string {
  return `${notificationType}:${channel}`;
}

function isRequiredChannel(
  _notificationType: SupportedNotificationType,
  channel: NotificationChannel,
) {
  return channel === "in_app";
}

function isEnabled(
  preferences: NotificationPreferenceRow[],
  notificationType: SupportedNotificationType,
  channel: NotificationChannel,
): boolean {
  if (isRequiredChannel(notificationType, channel)) {
    return true;
  }

  const preference = preferences.find(
    (candidate) => candidate.notificationType === notificationType && candidate.channel === channel,
  );
  return preference?.isEnabled ?? true;
}

function uniqueRecipients(recipients: NotificationRecipient[]): NotificationRecipient[] {
  const byUserId = new Map<string, NotificationRecipient>();
  for (const recipient of recipients) {
    byUserId.set(recipient.userId, recipient);
  }
  return [...byUserId.values()];
}

function vendorRecipients(users: VendorRecipientUser[]): NotificationRecipient[] {
  return users.map((user) => ({ email: user.email, userId: user.userId }));
}

async function loadCustomerRecipient(
  repository: NotificationRepository,
  userId: string | null,
): Promise<NotificationRecipient[]> {
  if (!userId) {
    return [];
  }

  const user = await repository.findUserById(userId);
  if (!user) {
    return [];
  }

  return [{ email: user.email, userId: user.id }];
}

async function rfqOrThrow(repository: NotificationRepository, rfqId: string | null) {
  if (!rfqId) {
    throw new PermanentNotificationError("Notification event is missing rfqId.");
  }

  const rfq = await repository.findRfqById(rfqId);
  if (!rfq) {
    throw new PermanentNotificationError(`RFQ ${rfqId} was not found for notification event.`);
  }

  return rfq;
}

async function plansForEvent(
  repository: NotificationRepository,
  event: OutboxEvent,
): Promise<NotificationPlan[]> {
  const notificationType = canonicalNotificationType(event.eventType);
  if (!notificationType) {
    return [];
  }

  const payload = event.payload;
  const rfqId = payloadString(payload, "rfqId");
  const vendorId = payloadString(payload, "vendorId");
  const quoteId = payloadString(payload, "quoteId");
  const quoteRevisionId = payloadString(payload, "quoteRevisionId");
  const agreementId = payloadString(payload, "agreementId");
  const paymentId = payloadString(payload, "paymentId");
  const platformFeeId = event.aggregateType === "platform_agreement_fee" ? event.aggregateId : null;
  const eventId = payloadString(payload, "calendarEventId") ?? event.aggregateId;
  const rfq = rfqId ? await repository.findRfqById(rfqId) : null;
  const customerUserId = payloadString(payload, "customerUserId") ?? rfq?.customerUserId ?? null;
  const eventName = eventNameLabel(rfq?.eventName ?? null);

  if (notificationType === "rfq.submitted") {
    const targetVendorIds = Array.isArray(payload.targetVendorIds)
      ? payload.targetVendorIds.filter((value): value is string => typeof value === "string")
      : [];
    const vendorUsers = (
      await Promise.all(
        targetVendorIds.map((targetVendorId) => repository.listActiveVendorUsers(targetVendorId)),
      )
    ).flat();

    return [
      {
        body: `Your request for ${eventName} was submitted and vendors can now review it.`,
        entityId: rfqId,
        entityType: "rfq",
        recipients: await loadCustomerRecipient(repository, customerUserId),
        title: "RFQ submitted",
        type: "rfq.submitted",
      },
      {
        body: `A new catering request for ${eventName} is ready for review.`,
        entityId: rfqId,
        entityType: "rfq",
        recipients: vendorRecipients(vendorUsers),
        title: "New RFQ received",
        type: "rfq.submitted",
      },
    ];
  }

  if (notificationType === "rfq.clarification_requested") {
    const contextRfq = await rfqOrThrow(repository, rfqId);
    return [
      {
        body: `A vendor requested clarification for ${eventName}.`,
        entityId: contextRfq.id,
        entityType: "rfq",
        recipients: await loadCustomerRecipient(repository, contextRfq.customerUserId),
        title: "Clarification requested",
        type: "rfq.clarification_requested",
      },
    ];
  }

  if (notificationType === "quote.sent") {
    const contextRfq = await rfqOrThrow(repository, rfqId);
    const revised = typeof payload.revisionNumber === "number" && payload.revisionNumber > 1;
    return [
      {
        body: `A vendor ${revised ? "revised a quote" : "sent a quote"} for ${eventName}.`,
        entityId: quoteRevisionId ?? quoteId,
        entityType: quoteRevisionId ? "quote_revision" : "quote",
        recipients: await loadCustomerRecipient(repository, contextRfq.customerUserId),
        title: revised ? "Quote revised" : "Quote ready",
        type: "quote.sent",
      },
    ];
  }

  if (notificationType === "quote.accepted") {
    if (!vendorId) {
      throw new PermanentNotificationError("Quote accepted event is missing vendorId.");
    }

    return [
      {
        body: `The customer accepted your quote for ${eventName}.`,
        entityId: quoteId,
        entityType: "quote",
        recipients: vendorRecipients(await repository.listActiveVendorUsers(vendorId)),
        title: "Quote accepted",
        type: "quote.accepted",
      },
    ];
  }

  if (notificationType === "agreement.ready") {
    const contextRfq = await rfqOrThrow(repository, rfqId);
    return [
      {
        body: `The agreement for ${eventName} is ready for review and signature.`,
        entityId: agreementId,
        entityType: "agreement",
        recipients: await loadCustomerRecipient(repository, contextRfq.customerUserId),
        title: "Agreement ready",
        type: "agreement.ready",
      },
    ];
  }

  if (notificationType === "agreement.signed") {
    if (!vendorId) {
      throw new PermanentNotificationError("Agreement signed event is missing vendorId.");
    }

    return [
      {
        body: `The customer signed the agreement for ${eventName}.`,
        entityId: agreementId,
        entityType: "agreement",
        recipients: vendorRecipients(await repository.listActiveVendorUsers(vendorId)),
        title: "Agreement signed",
        type: "agreement.signed",
      },
    ];
  }

  if (notificationType === "payment.deposit_paid") {
    if (!vendorId) {
      throw new PermanentNotificationError("Deposit paid event is missing vendorId.");
    }

    const contextRfq = await rfqOrThrow(repository, rfqId);
    return [
      {
        body: `Your deposit for ${eventName} was received.`,
        entityId: paymentId,
        entityType: "payment",
        recipients: await loadCustomerRecipient(repository, contextRfq.customerUserId),
        title: "Payment confirmed",
        type: "payment.deposit_paid",
      },
      {
        body: `The customer deposit for ${eventName} was paid.`,
        entityId: paymentId,
        entityType: "payment",
        recipients: vendorRecipients(await repository.listActiveVendorUsers(vendorId)),
        title: "Deposit paid",
        type: "payment.deposit_paid",
      },
    ];
  }

  if (notificationType === "event.confirmed") {
    if (!vendorId) {
      throw new PermanentNotificationError("Event confirmed event is missing vendorId.");
    }

    const contextRfq = await rfqOrThrow(repository, rfqId);
    return [
      {
        body: `${eventName} is confirmed on the vendor calendar.`,
        entityId: eventId,
        entityType: "calendar_event",
        recipients: await loadCustomerRecipient(repository, contextRfq.customerUserId),
        title: "Event confirmed",
        type: "event.confirmed",
      },
      {
        body: `${eventName} is confirmed and ready for operations planning.`,
        entityId: eventId,
        entityType: "calendar_event",
        recipients: vendorRecipients(await repository.listActiveVendorUsers(vendorId)),
        title: "Event confirmed",
        type: "event.confirmed",
      },
    ];
  }

  if (notificationType === "platform_fee.created") {
    if (!vendorId) {
      throw new PermanentNotificationError("Platform fee event is missing vendorId.");
    }

    return [
      {
        body: "A signed-agreement platform fee was created for vendor invoicing.",
        entityId: platformFeeId,
        entityType: "platform_agreement_fee",
        recipients: vendorRecipients(
          await repository.listActiveVendorUsers(vendorId, ["owner", "manager"]),
        ),
        title: "Platform fee created",
        type: "platform_fee.created",
      },
    ];
  }

  return [];
}

export function createNotificationService(deps: NotificationServiceDeps): NotificationService {
  const { emailProvider, repository } = deps;

  async function deliverPlan(event: OutboxEvent, plan: NotificationPlan) {
    for (const recipient of uniqueRecipients(plan.recipients)) {
      const preferences = await repository.listNotificationPreferences(recipient.userId);
      const inAppEnabled = isEnabled(preferences, plan.type, "in_app");
      const emailEnabled = isEnabled(preferences, plan.type, "email");

      if (!inAppEnabled && !emailEnabled) {
        continue;
      }

      const notification = await repository.createNotification({
        body: plan.body,
        entityId: plan.entityId,
        entityType: plan.entityType,
        outboxEventId: event.id,
        title: plan.title,
        type: plan.type,
        userId: recipient.userId,
      });

      if (inAppEnabled) {
        await repository.createNotificationDelivery({
          channel: "in_app",
          notificationId: notification.id,
          sentAt: now(),
          status: "sent",
        });
      }

      if (!emailEnabled) {
        await repository.createNotificationDelivery({
          channel: "email",
          lastError: "Disabled by notification preferences.",
          notificationId: notification.id,
          status: "skipped",
        });
        continue;
      }

      const delivery = await repository.createNotificationDelivery({
        channel: "email",
        notificationId: notification.id,
        status: "pending",
      });

      if (delivery.status === "sent" || delivery.status === "skipped") {
        continue;
      }

      const attemptedAt = now();
      const attemptCount = delivery.attemptCount + 1;

      if (!recipient.email) {
        await repository.updateDelivery(
          delivery.id,
          {
            attemptCount,
            lastError: "User email address is unavailable.",
            status: "skipped",
          },
          attemptedAt,
        );
        continue;
      }

      try {
        const result = await emailProvider.sendEmail({
          body: plan.body,
          notificationId: notification.id,
          subject: plan.title,
          to: recipient.email,
        });
        await repository.updateDelivery(
          delivery.id,
          {
            attemptCount,
            lastError: null,
            nextRetryAt: null,
            providerMessageId: result.providerMessageId,
            sentAt: now(),
            status: "sent",
          },
          now(),
        );
      } catch (error) {
        const message = normalizeError(error);
        await repository.updateDelivery(
          delivery.id,
          {
            attemptCount,
            lastError: message,
            nextRetryAt: nextAvailableAt(attemptCount, attemptedAt),
            status: "failed",
          },
          attemptedAt,
        );
        throw error;
      }
    }
  }

  async function centerForUser(userId: string, query: NotificationListQueryDto) {
    const [notifications, unreadCount] = await Promise.all([
      repository.listNotifications({
        limit: query.limit,
        unreadOnly: query.unreadOnly,
        userId,
      }),
      repository.countUnreadNotifications(userId),
    ]);

    return {
      notifications: notifications.map(toResult),
      unreadCount,
    };
  }

  async function preferencesForUser(userId: string): Promise<NotificationPreferenceResult[]> {
    const preferences = await repository.listNotificationPreferences(userId);
    const byKey = new Map(
      preferences.map((preference) => [
        preferenceKey(preference.notificationType, preference.channel as NotificationChannel),
        preference,
      ]),
    );

    return supportedNotificationTypes.flatMap((notificationType) =>
      supportedChannels.map((channel) => ({
        channel,
        isEnabled:
          isRequiredChannel(notificationType, channel) ||
          (byKey.get(preferenceKey(notificationType, channel))?.isEnabled ?? true),
        notificationType,
        required: isRequiredChannel(notificationType, channel),
      })),
    );
  }

  async function processOutboxEvent(event: OutboxEvent) {
    const plans = await plansForEvent(repository, event);

    for (const plan of plans) {
      await deliverPlan(event, plan);
    }
  }

  return {
    async listNotifications(ctx, query) {
      return centerForUser(assertAuthenticated(ctx), query);
    },

    async listPreferences(ctx) {
      return preferencesForUser(assertAuthenticated(ctx));
    },

    async markAllRead(ctx) {
      const userId = assertAuthenticated(ctx);
      const updatedCount = await repository.markAllNotificationsRead(userId, now());
      const unreadCount = await repository.countUnreadNotifications(userId);
      return { unreadCount, updatedCount };
    },

    async markRead(ctx, notificationId) {
      const userId = assertAuthenticated(ctx);
      const notification = await repository.markNotificationRead(userId, notificationId, now());
      if (!notification) {
        throw new NotFoundError("Notification was not found.");
      }
      return centerForUser(userId, { limit: 50, unreadOnly: false });
    },

    async processOutboxBatch(batchSize) {
      const claimed = await repository.claimOutboxEvents(batchSize, now());
      const result: OutboxProcessingResult = {
        claimed: claimed.length,
        deadLettered: 0,
        processed: 0,
        retried: 0,
      };

      for (const event of claimed) {
        try {
          await processOutboxEvent(event);
          await repository.markOutboxProcessed(event.id, now());
          result.processed += 1;
        } catch (error) {
          const message = normalizeError(error);
          const attempts = event.attempts + 1;

          if (error instanceof PermanentNotificationError || attempts >= maxOutboxAttempts) {
            await repository.markOutboxDeadLetter(event.id, attempts, message, now());
            result.deadLettered += 1;
          } else {
            await repository.markOutboxRetry(
              event.id,
              attempts,
              nextAvailableAt(attempts, now()),
              message,
              now(),
            );
            result.retried += 1;
          }
        }
      }

      return result;
    },

    processOutboxEvent,

    async updatePreferences(ctx, input) {
      const userId = assertAuthenticated(ctx);

      for (const preference of input.preferences) {
        if (!supportedTypeSet.has(preference.notificationType)) {
          continue;
        }

        const notificationType = preference.notificationType as SupportedNotificationType;
        const channel = preference.channel;
        await repository.upsertNotificationPreference({
          channel,
          isEnabled: isRequiredChannel(notificationType, channel) ? true : preference.isEnabled,
          notificationType,
          userId,
        });
      }

      return preferencesForUser(userId);
    },
  };
}
