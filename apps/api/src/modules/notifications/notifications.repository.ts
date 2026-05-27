import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  notificationDeliveries,
  notificationPreferences,
  notifications,
  outboxEvents,
  rfqs,
  users,
  vendorMemberships,
} from "../../db/schema/index.js";

type NotificationDb = Database | Transaction;
type NotificationRow = typeof notifications.$inferSelect;
type NotificationDeliveryRow = typeof notificationDeliveries.$inferSelect;
type NotificationPreferenceRow = typeof notificationPreferences.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type RfqRow = typeof rfqs.$inferSelect;
type UserRow = typeof users.$inferSelect;
type VendorMembershipRole = (typeof vendorMemberships.$inferSelect)["role"];

export type NotificationListInput = {
  limit: number;
  unreadOnly?: boolean;
  userId: string;
};

export type VendorRecipientUser = {
  email: string;
  role: VendorMembershipRole;
  userId: string;
};

export type NotificationRepository = {
  claimOutboxEvents: (limit: number, claimedAt: Date) => Promise<OutboxEventRow[]>;
  countUnreadNotifications: (userId: string) => Promise<number>;
  createNotification: (input: typeof notifications.$inferInsert) => Promise<NotificationRow>;
  createNotificationDelivery: (
    input: typeof notificationDeliveries.$inferInsert,
  ) => Promise<NotificationDeliveryRow>;
  findDelivery: (
    notificationId: string,
    channel: "email" | "in_app" | "sms",
  ) => Promise<NotificationDeliveryRow | null>;
  findNotificationByOutboxEvent: (
    userId: string,
    outboxEventId: string,
    type: string,
  ) => Promise<NotificationRow | null>;
  findRfqById: (rfqId: string) => Promise<RfqRow | null>;
  findUserById: (userId: string) => Promise<UserRow | null>;
  listActiveVendorUsers: (
    vendorId: string,
    roles?: VendorMembershipRole[],
  ) => Promise<VendorRecipientUser[]>;
  listNotificationPreferences: (userId: string) => Promise<NotificationPreferenceRow[]>;
  listNotifications: (input: NotificationListInput) => Promise<NotificationRow[]>;
  markAllNotificationsRead: (userId: string, readAt: Date) => Promise<number>;
  markNotificationRead: (
    userId: string,
    notificationId: string,
    readAt: Date,
  ) => Promise<NotificationRow | null>;
  markOutboxDeadLetter: (
    eventId: string,
    attempts: number,
    lastError: string,
    failedAt: Date,
  ) => Promise<void>;
  markOutboxProcessed: (eventId: string, processedAt: Date) => Promise<void>;
  markOutboxRetry: (
    eventId: string,
    attempts: number,
    availableAt: Date,
    lastError: string,
    updatedAt: Date,
  ) => Promise<void>;
  transaction: <T>(callback: (repo: NotificationRepository) => Promise<T>) => Promise<T>;
  updateDelivery: (
    deliveryId: string,
    input: Partial<
      Pick<
        NotificationDeliveryRow,
        "attemptCount" | "lastError" | "nextRetryAt" | "providerMessageId" | "sentAt" | "status"
      >
    >,
    updatedAt: Date,
  ) => Promise<NotificationDeliveryRow | null>;
  upsertNotificationPreference: (
    input: typeof notificationPreferences.$inferInsert,
  ) => Promise<NotificationPreferenceRow>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Expected database row to be returned.");
  }
  return row;
}

function unavailable(): never {
  throw new Error("Notification repository is unavailable without a database.");
}

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: NotificationDb) {}

  async claimOutboxEvents(limit: number, claimedAt: Date): Promise<OutboxEventRow[]> {
    const claim = async (tx: NotificationDb) => {
      const rows = await tx
        .select()
        .from(outboxEvents)
        .where(
          and(
            inArray(outboxEvents.status, ["pending", "failed"]),
            lte(outboxEvents.availableAt, claimedAt),
          ),
        )
        .orderBy(asc(outboxEvents.createdAt))
        .limit(limit)
        .for("update", { skipLocked: true });

      if (rows.length === 0) {
        return [];
      }

      const claimed = await tx
        .update(outboxEvents)
        .set({ status: "processing", updatedAt: claimedAt })
        .where(
          inArray(
            outboxEvents.id,
            rows.map((row) => row.id),
          ),
        )
        .returning();

      return claimed;
    };

    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => claim(tx));
    }

    return claim(this.db);
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.value ?? 0;
  }

  async createNotification(input: typeof notifications.$inferInsert): Promise<NotificationRow> {
    const [notification] = await this.db
      .insert(notifications)
      .values(input)
      .onConflictDoNothing()
      .returning();

    if (notification) {
      return notification;
    }

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

    throw new Error("Notification was not created and no existing idempotency match was found.");
  }

  async createNotificationDelivery(
    input: typeof notificationDeliveries.$inferInsert,
  ): Promise<NotificationDeliveryRow> {
    const [delivery] = await this.db
      .insert(notificationDeliveries)
      .values(input)
      .onConflictDoNothing()
      .returning();

    if (delivery) {
      return delivery;
    }

    const existing = await this.findDelivery(input.notificationId, input.channel);
    if (existing) {
      return existing;
    }

    throw new Error("Notification delivery was not created and no existing delivery was found.");
  }

  async findDelivery(
    notificationId: string,
    channel: "email" | "in_app" | "sms",
  ): Promise<NotificationDeliveryRow | null> {
    const [delivery] = await this.db
      .select()
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.notificationId, notificationId),
          eq(notificationDeliveries.channel, channel),
        ),
      )
      .limit(1);
    return delivery ?? null;
  }

  async findNotificationByOutboxEvent(
    userId: string,
    outboxEventId: string,
    type: string,
  ): Promise<NotificationRow | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.outboxEventId, outboxEventId),
          eq(notifications.type, type),
        ),
      )
      .limit(1);
    return notification ?? null;
  }

  async findRfqById(rfqId: string): Promise<RfqRow | null> {
    const [rfq] = await this.db.select().from(rfqs).where(eq(rfqs.id, rfqId)).limit(1);
    return rfq ?? null;
  }

  async findUserById(userId: string): Promise<UserRow | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
  }

  async listActiveVendorUsers(
    vendorId: string,
    roles?: VendorMembershipRole[],
  ): Promise<VendorRecipientUser[]> {
    const rows = await this.db
      .select({
        email: users.email,
        role: vendorMemberships.role,
        userId: users.id,
      })
      .from(vendorMemberships)
      .innerJoin(users, eq(users.id, vendorMemberships.userId))
      .where(
        and(
          eq(vendorMemberships.vendorId, vendorId),
          eq(vendorMemberships.status, "active"),
          roles && roles.length > 0 ? inArray(vendorMemberships.role, roles) : undefined,
        ),
      );

    return rows;
  }

  async listNotificationPreferences(userId: string): Promise<NotificationPreferenceRow[]> {
    return this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .orderBy(asc(notificationPreferences.notificationType), asc(notificationPreferences.channel));
  }

  async listNotifications(input: NotificationListInput): Promise<NotificationRow[]> {
    return this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          input.unreadOnly ? isNull(notifications.readAt) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(input.limit);
  }

  async markAllNotificationsRead(userId: string, readAt: Date): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return rows.length;
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
    readAt: Date,
  ): Promise<NotificationRow | null> {
    const [notification] = await this.db
      .update(notifications)
      .set({ readAt })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();
    return notification ?? null;
  }

  async markOutboxDeadLetter(
    eventId: string,
    attempts: number,
    lastError: string,
    failedAt: Date,
  ): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        attempts,
        lastError,
        status: "dead_letter",
        updatedAt: failedAt,
      })
      .where(eq(outboxEvents.id, eventId));
  }

  async markOutboxProcessed(eventId: string, processedAt: Date): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        lastError: null,
        processedAt,
        status: "processed",
        updatedAt: processedAt,
      })
      .where(eq(outboxEvents.id, eventId));
  }

  async markOutboxRetry(
    eventId: string,
    attempts: number,
    availableAt: Date,
    lastError: string,
    updatedAt: Date,
  ): Promise<void> {
    await this.db
      .update(outboxEvents)
      .set({
        attempts,
        availableAt,
        lastError,
        status: "failed",
        updatedAt,
      })
      .where(eq(outboxEvents.id, eventId));
  }

  async transaction<T>(callback: (repo: NotificationRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleNotificationRepository(tx)));
    }

    return callback(this);
  }

  async updateDelivery(
    deliveryId: string,
    input: Partial<
      Pick<
        NotificationDeliveryRow,
        "attemptCount" | "lastError" | "nextRetryAt" | "providerMessageId" | "sentAt" | "status"
      >
    >,
    updatedAt: Date,
  ): Promise<NotificationDeliveryRow | null> {
    const [delivery] = await this.db
      .update(notificationDeliveries)
      .set({ ...input, updatedAt })
      .where(eq(notificationDeliveries.id, deliveryId))
      .returning();
    return delivery ?? null;
  }

  async upsertNotificationPreference(
    input: typeof notificationPreferences.$inferInsert,
  ): Promise<NotificationPreferenceRow> {
    const [preference] = await this.db
      .insert(notificationPreferences)
      .values(input)
      .onConflictDoUpdate({
        set: {
          isEnabled: input.isEnabled ?? true,
          updatedAt: new Date(),
        },
        target: [
          notificationPreferences.userId,
          notificationPreferences.notificationType,
          notificationPreferences.channel,
        ],
      })
      .returning();
    return requireReturnedRow(preference);
  }
}

export function createUnavailableNotificationRepository(): NotificationRepository {
  return {
    claimOutboxEvents: unavailable,
    countUnreadNotifications: unavailable,
    createNotification: unavailable,
    createNotificationDelivery: unavailable,
    findDelivery: unavailable,
    findNotificationByOutboxEvent: unavailable,
    findRfqById: unavailable,
    findUserById: unavailable,
    listActiveVendorUsers: unavailable,
    listNotificationPreferences: unavailable,
    listNotifications: unavailable,
    markAllNotificationsRead: unavailable,
    markNotificationRead: unavailable,
    markOutboxDeadLetter: unavailable,
    markOutboxProcessed: unavailable,
    markOutboxRetry: unavailable,
    transaction: unavailable,
    updateDelivery: unavailable,
    upsertNotificationPreference: unavailable,
  };
}
