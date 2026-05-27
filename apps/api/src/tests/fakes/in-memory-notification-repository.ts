import { randomUUID } from "node:crypto";

import type {
  Notification,
  NotificationDelivery,
  NotificationPreference,
  OutboxEvent,
  Rfq,
  User,
  VendorMembership,
  notificationDeliveries,
  notificationPreferences,
  notifications,
  outboxEvents,
} from "../../db/schema/index.js";
import type {
  NotificationListInput,
  NotificationRepository,
  VendorRecipientUser,
} from "../../modules/notifications/notifications.repository.js";
import type { InMemoryAuthRepository } from "./in-memory-auth-repository.js";
import type { InMemoryRfqRepository } from "./in-memory-rfq-repository.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

function now(): Date {
  return new Date();
}

export class InMemoryNotificationRepository implements NotificationRepository {
  readonly deliveries = new Map<string, NotificationDelivery>();
  readonly notifications = new Map<string, Notification>();
  readonly outboxEvents = new Map<string, OutboxEvent>();
  readonly preferences = new Map<string, NotificationPreference>();

  constructor(
    private readonly authRepository?: InMemoryAuthRepository,
    private readonly rfqRepository?: InMemoryRfqRepository,
    private readonly vendorRepository?: InMemoryVendorRepository,
  ) {}

  seedOutboxEvent(input: Partial<typeof outboxEvents.$inferInsert> & { eventType: string }) {
    const createdAt = now();
    const event: OutboxEvent = {
      aggregateId: input.aggregateId ?? randomUUID(),
      aggregateType: input.aggregateType ?? "test",
      attempts: input.attempts ?? 0,
      availableAt: input.availableAt ?? createdAt,
      createdAt,
      eventType: input.eventType,
      id: input.id ?? randomUUID(),
      lastError: input.lastError ?? null,
      payload: input.payload ?? {},
      processedAt: input.processedAt ?? null,
      requestId: input.requestId ?? null,
      status: input.status ?? "pending",
      updatedAt: createdAt,
    };
    this.outboxEvents.set(event.id, event);
    return event;
  }

  async claimOutboxEvents(limit: number, claimedAt: Date): Promise<OutboxEvent[]> {
    const claimable = [...this.outboxEvents.values()]
      .filter(
        (event) =>
          (event.status === "pending" || event.status === "failed") &&
          event.availableAt.getTime() <= claimedAt.getTime(),
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(0, limit);

    for (const event of claimable) {
      this.outboxEvents.set(event.id, {
        ...event,
        status: "processing",
        updatedAt: claimedAt,
      });
    }

    return claimable.map((event) => ({ ...event, status: "processing", updatedAt: claimedAt }));
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    return [...this.notifications.values()].filter(
      (notification) => notification.userId === userId && notification.readAt === null,
    ).length;
  }

  async createNotification(input: typeof notifications.$inferInsert): Promise<Notification> {
    if (input.outboxEventId) {
      const existing = await this.findNotificationByOutboxEvent(
        input.userId,
        input.outboxEventId,
        input.type,
      );
      if (existing) {
        return existing;
      }
    }

    const createdAt = now();
    const notification: Notification = {
      body: input.body,
      createdAt,
      entityId: input.entityId ?? null,
      entityType: input.entityType ?? null,
      id: randomUUID(),
      outboxEventId: input.outboxEventId ?? null,
      readAt: input.readAt ?? null,
      title: input.title,
      type: input.type,
      userId: input.userId,
    };
    this.notifications.set(notification.id, notification);
    return notification;
  }

  async createNotificationDelivery(
    input: typeof notificationDeliveries.$inferInsert,
  ): Promise<NotificationDelivery> {
    const existing = await this.findDelivery(input.notificationId, input.channel);
    if (existing) {
      return existing;
    }

    const createdAt = now();
    const delivery: NotificationDelivery = {
      attemptCount: input.attemptCount ?? 0,
      channel: input.channel,
      createdAt,
      id: randomUUID(),
      lastError: input.lastError ?? null,
      nextRetryAt: input.nextRetryAt ?? null,
      notificationId: input.notificationId,
      providerMessageId: input.providerMessageId ?? null,
      sentAt: input.sentAt ?? null,
      status: input.status ?? "pending",
      updatedAt: createdAt,
    };
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  async findDelivery(
    notificationId: string,
    channel: "email" | "in_app" | "sms",
  ): Promise<NotificationDelivery | null> {
    return (
      [...this.deliveries.values()].find(
        (delivery) => delivery.notificationId === notificationId && delivery.channel === channel,
      ) ?? null
    );
  }

  async findNotificationByOutboxEvent(
    userId: string,
    outboxEventId: string,
    type: string,
  ): Promise<Notification | null> {
    return (
      [...this.notifications.values()].find(
        (notification) =>
          notification.userId === userId &&
          notification.outboxEventId === outboxEventId &&
          notification.type === type,
      ) ?? null
    );
  }

  async findRfqById(rfqId: string): Promise<Rfq | null> {
    return this.rfqRepository?.rfqs.get(rfqId) ?? null;
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.authRepository?.users.get(userId) ?? null;
  }

  async listActiveVendorUsers(
    vendorId: string,
    roles?: VendorMembership["role"][],
  ): Promise<VendorRecipientUser[]> {
    const memberships = [...(this.vendorRepository?.memberships.values() ?? [])].filter(
      (membership) =>
        membership.vendorId === vendorId &&
        membership.status === "active" &&
        (!roles || roles.includes(membership.role)),
    );

    return memberships.flatMap((membership) => {
      const user = this.authRepository?.users.get(membership.userId);
      if (!user) {
        return [];
      }
      return [{ email: user.email, role: membership.role, userId: user.id }];
    });
  }

  async listNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
    return [...this.preferences.values()].filter((preference) => preference.userId === userId);
  }

  async listNotifications(input: NotificationListInput): Promise<Notification[]> {
    return [...this.notifications.values()]
      .filter(
        (notification) =>
          notification.userId === input.userId &&
          (!input.unreadOnly || notification.readAt === null),
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, input.limit);
  }

  async markAllNotificationsRead(userId: string, readAt: Date): Promise<number> {
    let updated = 0;
    for (const notification of this.notifications.values()) {
      if (notification.userId === userId && notification.readAt === null) {
        this.notifications.set(notification.id, { ...notification, readAt });
        updated += 1;
      }
    }
    return updated;
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
    readAt: Date,
  ): Promise<Notification | null> {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.userId !== userId) {
      return null;
    }
    const updated = { ...notification, readAt };
    this.notifications.set(notificationId, updated);
    return updated;
  }

  async markOutboxDeadLetter(
    eventId: string,
    attempts: number,
    lastError: string,
    failedAt: Date,
  ): Promise<void> {
    const event = this.outboxEvents.get(eventId);
    if (event) {
      this.outboxEvents.set(eventId, {
        ...event,
        attempts,
        lastError,
        status: "dead_letter",
        updatedAt: failedAt,
      });
    }
  }

  async markOutboxProcessed(eventId: string, processedAt: Date): Promise<void> {
    const event = this.outboxEvents.get(eventId);
    if (event) {
      this.outboxEvents.set(eventId, {
        ...event,
        lastError: null,
        processedAt,
        status: "processed",
        updatedAt: processedAt,
      });
    }
  }

  async markOutboxRetry(
    eventId: string,
    attempts: number,
    availableAt: Date,
    lastError: string,
    updatedAt: Date,
  ): Promise<void> {
    const event = this.outboxEvents.get(eventId);
    if (event) {
      this.outboxEvents.set(eventId, {
        ...event,
        attempts,
        availableAt,
        lastError,
        status: "failed",
        updatedAt,
      });
    }
  }

  async transaction<T>(callback: (repo: NotificationRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async updateDelivery(
    deliveryId: string,
    input: Partial<
      Pick<
        NotificationDelivery,
        "attemptCount" | "lastError" | "nextRetryAt" | "providerMessageId" | "sentAt" | "status"
      >
    >,
    updatedAt: Date,
  ): Promise<NotificationDelivery | null> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      return null;
    }
    const updated = { ...delivery, ...input, updatedAt };
    this.deliveries.set(deliveryId, updated);
    return updated;
  }

  async upsertNotificationPreference(
    input: typeof notificationPreferences.$inferInsert,
  ): Promise<NotificationPreference> {
    const existing = [...this.preferences.values()].find(
      (preference) =>
        preference.userId === input.userId &&
        preference.notificationType === input.notificationType &&
        preference.channel === input.channel,
    );
    const updatedAt = now();

    if (existing) {
      const updated = { ...existing, isEnabled: input.isEnabled ?? true, updatedAt };
      this.preferences.set(existing.id, updated);
      return updated;
    }

    const preference: NotificationPreference = {
      channel: input.channel,
      createdAt: updatedAt,
      id: randomUUID(),
      isEnabled: input.isEnabled ?? true,
      notificationType: input.notificationType,
      updatedAt,
      userId: input.userId,
    };
    this.preferences.set(preference.id, preference);
    return preference;
  }
}
