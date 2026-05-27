import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  EmailDeliveryProvider,
  SendEmailInput,
  SendEmailResult,
} from "../../modules/notifications/email-provider.js";
import { createNotificationService } from "../../modules/notifications/notifications.service.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryNotificationRepository } from "../fakes/in-memory-notification-repository.js";
import { InMemoryRfqRepository } from "../fakes/in-memory-rfq-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";

class FakeEmailProvider implements EmailDeliveryProvider {
  readonly sent: SendEmailInput[] = [];

  constructor(private failuresRemaining = 0) {}

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("Email provider timeout.");
    }

    this.sent.push(input);
    return {
      providerMessageId: `fake-email-${this.sent.length}`,
    };
  }
}

function futureDate(daysFromNow: number): Date {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  date.setUTCHours(16, 0, 0, 0);
  return date;
}

async function seedNotificationContext() {
  const authRepository = new InMemoryAuthRepository();
  const vendorRepository = new InMemoryVendorRepository();
  const rfqRepository = new InMemoryRfqRepository(vendorRepository);
  const notificationRepository = new InMemoryNotificationRepository(
    authRepository,
    rfqRepository,
    vendorRepository,
  );
  const customer = await authRepository.createUser({
    email: "customer@example.com",
    firstName: "Casey",
    globalRoles: ["customer"],
    lastName: "Customer",
    passwordHash: "hash",
    phone: null,
    status: "active",
  });
  const vendorUser = await authRepository.createUser({
    email: "vendor@example.com",
    firstName: "Vera",
    globalRoles: ["vendor_user"],
    lastName: "Vendor",
    passwordHash: "hash",
    phone: null,
    status: "active",
  });
  const vendor = await vendorRepository.createVendor({
    businessName: "Taco Truck",
    cateringMinimumCents: 100_000,
    description: "Taco catering.",
    pricingSummary: "Packages available.",
    slug: "taco-truck",
    status: "active",
  });
  await vendorRepository.createMembership({
    role: "owner",
    status: "active",
    userId: vendorUser.id,
    vendorId: vendor.id,
  });
  const address = await rfqRepository.createAddress({
    city: "Atlanta",
    country: "US",
    line1: "100 Event Way",
    state: "GA",
    timezone: "America/New_York",
  });
  const rfq = await rfqRepository.createRfq({
    budgetMaxCents: 250_000,
    budgetMinCents: 150_000,
    customerUserId: customer.id,
    endsAt: futureDate(20),
    estimatedHeadcount: 120,
    eventName: "Notification Test Lunch",
    eventType: "Corporate lunch",
    indoorOutdoor: "outdoor",
    quoteResponseDeadline: futureDate(10),
    startsAt: futureDate(19),
    status: "submitted",
    timezone: "America/New_York",
    venueAddressId: address.id,
  });

  return {
    authRepository,
    customer,
    notificationRepository,
    rfq,
    vendor,
    vendorUser,
  };
}

describe("notifications", () => {
  it("claims available outbox events in created order and marks them processing", async () => {
    const { notificationRepository } = await seedNotificationContext();
    const future = new Date(Date.now() + 60_000);
    const first = notificationRepository.seedOutboxEvent({ eventType: "quote.sent" });
    notificationRepository.seedOutboxEvent({
      availableAt: future,
      eventType: "agreement.ready",
    });
    const second = notificationRepository.seedOutboxEvent({
      attempts: 1,
      eventType: "payment.deposit_paid",
      status: "failed",
    });

    const claimed = await notificationRepository.claimOutboxEvents(5, new Date());

    expect(claimed.map((event) => event.id)).toEqual([first.id, second.id]);
    expect(notificationRepository.outboxEvents.get(first.id)?.status).toBe("processing");
    expect(notificationRepository.outboxEvents.get(second.id)?.status).toBe("processing");
  });

  it("retries transient email failures and then processes the outbox event", async () => {
    const { customer, notificationRepository, rfq, vendor } = await seedNotificationContext();
    const emailProvider = new FakeEmailProvider(1);
    const service = createNotificationService({
      emailProvider,
      repository: notificationRepository,
    });
    const event = notificationRepository.seedOutboxEvent({
      eventType: "quote.sent",
      payload: {
        quoteId: randomUUID(),
        quoteRevisionId: randomUUID(),
        rfqId: rfq.id,
        vendorId: vendor.id,
      },
    });

    const firstResult = await service.processOutboxBatch(10);
    const failedEvent = notificationRepository.outboxEvents.get(event.id);

    expect(firstResult).toMatchObject({ claimed: 1, processed: 0, retried: 1 });
    expect(failedEvent?.status).toBe("failed");
    expect(failedEvent?.attempts).toBe(1);
    expect(failedEvent?.availableAt.getTime()).toBeGreaterThan(Date.now());

    notificationRepository.outboxEvents.set(event.id, {
      ...failedEvent!,
      availableAt: new Date(Date.now() - 1_000),
    });

    const secondResult = await service.processOutboxBatch(10);
    const processedEvent = notificationRepository.outboxEvents.get(event.id);
    const notification = [...notificationRepository.notifications.values()].find(
      (candidate) => candidate.userId === customer.id,
    );
    const emailDelivery = [...notificationRepository.deliveries.values()].find(
      (delivery) => delivery.notificationId === notification?.id && delivery.channel === "email",
    );

    expect(secondResult).toMatchObject({ claimed: 1, processed: 1, retried: 0 });
    expect(processedEvent?.status).toBe("processed");
    expect(emailDelivery?.attemptCount).toBe(2);
    expect(emailDelivery?.status).toBe("sent");
  });

  it("dead-letters outbox events after the maximum retry attempt", async () => {
    const { notificationRepository, rfq, vendor } = await seedNotificationContext();
    const emailProvider = new FakeEmailProvider(10);
    const service = createNotificationService({
      emailProvider,
      repository: notificationRepository,
    });
    const event = notificationRepository.seedOutboxEvent({
      attempts: 4,
      eventType: "quote.sent",
      payload: {
        quoteId: randomUUID(),
        quoteRevisionId: randomUUID(),
        rfqId: rfq.id,
        vendorId: vendor.id,
      },
    });

    const result = await service.processOutboxBatch(10);
    const deadLetteredEvent = notificationRepository.outboxEvents.get(event.id);

    expect(result).toMatchObject({ claimed: 1, deadLettered: 1, processed: 0 });
    expect(deadLetteredEvent?.status).toBe("dead_letter");
    expect(deadLetteredEvent?.attempts).toBe(5);
    expect(deadLetteredEvent?.lastError).toContain("Email provider timeout");
  });

  it("creates notifications idempotently for the same outbox event", async () => {
    const { customer, notificationRepository, rfq, vendor } = await seedNotificationContext();
    const emailProvider = new FakeEmailProvider();
    const service = createNotificationService({
      emailProvider,
      repository: notificationRepository,
    });
    const event = notificationRepository.seedOutboxEvent({
      eventType: "quote.sent",
      payload: {
        quoteId: randomUUID(),
        quoteRevisionId: randomUUID(),
        rfqId: rfq.id,
        vendorId: vendor.id,
      },
    });

    await service.processOutboxEvent(event);
    await service.processOutboxEvent(event);

    const customerNotifications = [...notificationRepository.notifications.values()].filter(
      (notification) => notification.userId === customer.id,
    );
    const customerDeliveries = [...notificationRepository.deliveries.values()].filter((delivery) =>
      customerNotifications.some((notification) => notification.id === delivery.notificationId),
    );

    expect(customerNotifications).toHaveLength(1);
    expect(customerDeliveries).toHaveLength(2);
    expect(emailProvider.sent).toHaveLength(1);
  });

  it("honors email preferences while keeping required in-app notifications enabled", async () => {
    const { customer, notificationRepository, rfq, vendor } = await seedNotificationContext();
    const emailProvider = new FakeEmailProvider();
    const service = createNotificationService({
      emailProvider,
      repository: notificationRepository,
    });
    await service.updatePreferences(
      { globalRoles: ["customer"], requestId: "test", userId: customer.id, vendorMemberships: [] },
      {
        preferences: [
          { channel: "email", isEnabled: false, notificationType: "quote.sent" },
          { channel: "in_app", isEnabled: false, notificationType: "quote.sent" },
        ],
      },
    );
    const event = notificationRepository.seedOutboxEvent({
      eventType: "quote.sent",
      payload: {
        quoteId: randomUUID(),
        quoteRevisionId: randomUUID(),
        rfqId: rfq.id,
        vendorId: vendor.id,
      },
    });

    await service.processOutboxEvent(event);

    const preferences = await service.listPreferences({
      globalRoles: ["customer"],
      requestId: "test",
      userId: customer.id,
      vendorMemberships: [],
    });
    const notification = [...notificationRepository.notifications.values()].find(
      (candidate) => candidate.userId === customer.id,
    );
    const inAppDelivery = [...notificationRepository.deliveries.values()].find(
      (delivery) => delivery.notificationId === notification?.id && delivery.channel === "in_app",
    );
    const emailDelivery = [...notificationRepository.deliveries.values()].find(
      (delivery) => delivery.notificationId === notification?.id && delivery.channel === "email",
    );

    expect(
      preferences.find(
        (preference) =>
          preference.notificationType === "quote.sent" && preference.channel === "in_app",
      )?.isEnabled,
    ).toBe(true);
    expect(notification).toBeDefined();
    expect(inAppDelivery?.status).toBe("sent");
    expect(emailDelivery?.status).toBe("skipped");
    expect(emailProvider.sent).toHaveLength(0);
  });
});
