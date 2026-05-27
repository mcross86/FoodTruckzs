import { and, asc, eq, gt, isNull, lt } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  agreements,
  auditLogs,
  calendarEvents,
  cateringEvents,
  outboxEvents,
  paymentAttempts,
  payments,
  paymentScheduleItems,
  quotes,
  rfqs,
  rfqStatusHistory,
  stripeWebhookEvents,
  vendorOperatingSettings,
  vendors,
} from "../../db/schema/index.js";
import type { RfqStatus } from "../rfqs/rfq-state-machine.js";

type PaymentDb = Database | Transaction;
type AgreementRow = typeof agreements.$inferSelect;
type AuditLogRow = typeof auditLogs.$inferSelect;
type CalendarEventRow = typeof calendarEvents.$inferSelect;
type CateringEventRow = typeof cateringEvents.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type PaymentAttemptRow = typeof paymentAttempts.$inferSelect;
type PaymentScheduleItemRow = typeof paymentScheduleItems.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;
type RfqRow = typeof rfqs.$inferSelect;
type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;
type StripeWebhookEventRow = typeof stripeWebhookEvents.$inferSelect;
type VendorOperatingSettingsRow = typeof vendorOperatingSettings.$inferSelect;
type VendorRow = typeof vendors.$inferSelect;

export type PaymentAgreementContext = {
  agreement: AgreementRow;
  payments: PaymentRow[];
  quote: QuoteRow;
  rfq: RfqRow;
  scheduleItems: PaymentScheduleItemRow[];
  vendor: VendorRow;
};

export type PaymentDetailRecord = {
  attempts: PaymentAttemptRow[];
  payment: PaymentRow;
  scheduleItem: PaymentScheduleItemRow | null;
};

export type VendorPaymentRecord = PaymentDetailRecord & {
  agreement: AgreementRow;
  rfq: RfqRow;
};

export type ConfirmedCateringEventRecord = {
  calendarEvent: CalendarEventRow;
  cateringEvent: CateringEventRow;
};

export type UpdateVendorStripeReadinessInput = {
  accountId: string;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  payoutsEnabled: boolean;
};

export type PaymentRepository = {
  createAttempt: (input: typeof paymentAttempts.$inferInsert) => Promise<PaymentAttemptRow>;
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  createCalendarEvent: (input: typeof calendarEvents.$inferInsert) => Promise<CalendarEventRow>;
  createCateringEvent: (input: typeof cateringEvents.$inferInsert) => Promise<CateringEventRow>;
  createOutboxEvent: (input: typeof outboxEvents.$inferInsert) => Promise<OutboxEventRow>;
  createPayment: (input: typeof payments.$inferInsert) => Promise<PaymentRow>;
  createStatusHistory: (
    input: typeof rfqStatusHistory.$inferInsert,
  ) => Promise<RfqStatusHistoryRow>;
  createWebhookEvent: (
    input: typeof stripeWebhookEvents.$inferInsert,
  ) => Promise<StripeWebhookEventRow>;
  findAgreementPaymentContext: (agreementId: string) => Promise<PaymentAgreementContext | null>;
  findAttemptByIdempotencyKey: (idempotencyKey: string) => Promise<PaymentAttemptRow | null>;
  findConfirmedCateringEventByAgreementId: (
    agreementId: string,
  ) => Promise<ConfirmedCateringEventRecord | null>;
  findOperatingSettingsByVendorId: (vendorId: string) => Promise<VendorOperatingSettingsRow | null>;
  findPaymentById: (paymentId: string) => Promise<PaymentDetailRecord | null>;
  findPaymentByStripeCheckoutSessionId: (sessionId: string) => Promise<PaymentDetailRecord | null>;
  findPaymentByStripePaymentIntentId: (
    paymentIntentId: string,
  ) => Promise<PaymentDetailRecord | null>;
  findVendorById: (vendorId: string) => Promise<VendorRow | null>;
  findWebhookEventByStripeEventId: (stripeEventId: string) => Promise<StripeWebhookEventRow | null>;
  listRangeEventsForConflict: (
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
  ) => Promise<CalendarEventRow[]>;
  listVendorPayments: (vendorId: string, status?: string) => Promise<VendorPaymentRecord[]>;
  transaction: <T>(callback: (repo: PaymentRepository) => Promise<T>) => Promise<T>;
  updateAttempt: (
    attemptId: string,
    input: Partial<
      Pick<
        PaymentAttemptRow,
        | "completedAt"
        | "failureCode"
        | "failureMessage"
        | "metadata"
        | "status"
        | "stripeCheckoutSessionId"
        | "stripePaymentIntentId"
      >
    >,
  ) => Promise<PaymentAttemptRow | null>;
  updatePayment: (
    paymentId: string,
    input: Partial<
      Pick<
        PaymentRow,
        "processingFeeCents" | "status" | "stripeCheckoutSessionId" | "stripePaymentIntentId"
      >
    >,
    updatedAt: Date,
  ) => Promise<PaymentRow | null>;
  updatePaymentScheduleItem: (
    scheduleItemId: string,
    input: Partial<Pick<PaymentScheduleItemRow, "paidAt" | "status">>,
    updatedAt: Date,
  ) => Promise<PaymentScheduleItemRow | null>;
  updateRfqStatus: (rfqId: string, status: RfqStatus, updatedAt: Date) => Promise<RfqRow | null>;
  updateVendorStripeReadiness: (
    vendorId: string,
    input: UpdateVendorStripeReadinessInput,
    updatedAt: Date,
  ) => Promise<VendorRow | null>;
  updateVendorStripeReadinessByAccountId: (
    input: UpdateVendorStripeReadinessInput,
    updatedAt: Date,
  ) => Promise<VendorRow | null>;
  updateWebhookEvent: (
    stripeEventId: string,
    input: Partial<Pick<StripeWebhookEventRow, "lastError" | "processedAt" | "status">>,
    updatedAt: Date,
  ) => Promise<StripeWebhookEventRow | null>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private readonly db: PaymentDb) {}

  async findVendorById(vendorId: string): Promise<VendorRow | null> {
    const [vendor] = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)))
      .limit(1);
    return vendor ?? null;
  }

  async updateVendorStripeReadiness(
    vendorId: string,
    input: UpdateVendorStripeReadinessInput,
    updatedAt: Date,
  ): Promise<VendorRow | null> {
    const [vendor] = await this.db
      .update(vendors)
      .set({
        stripeChargesEnabled: input.chargesEnabled,
        stripeConnectAccountId: input.accountId,
        stripeDetailsSubmitted: input.detailsSubmitted,
        stripeDisabledReason: input.disabledReason,
        stripePayoutsEnabled: input.payoutsEnabled,
        updatedAt,
      })
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)))
      .returning();
    return vendor ?? null;
  }

  async updateVendorStripeReadinessByAccountId(
    input: UpdateVendorStripeReadinessInput,
    updatedAt: Date,
  ): Promise<VendorRow | null> {
    const [vendor] = await this.db
      .update(vendors)
      .set({
        stripeChargesEnabled: input.chargesEnabled,
        stripeDetailsSubmitted: input.detailsSubmitted,
        stripeDisabledReason: input.disabledReason,
        stripePayoutsEnabled: input.payoutsEnabled,
        updatedAt,
      })
      .where(eq(vendors.stripeConnectAccountId, input.accountId))
      .returning();
    return vendor ?? null;
  }

  async findAgreementPaymentContext(agreementId: string): Promise<PaymentAgreementContext | null> {
    const [agreement] = await this.db
      .select()
      .from(agreements)
      .where(and(eq(agreements.id, agreementId), isNull(agreements.deletedAt)))
      .limit(1);

    if (!agreement) return null;

    const [rfqRows, quoteRows, vendorRows, scheduleItems, paymentRows] = await Promise.all([
      this.db
        .select()
        .from(rfqs)
        .where(and(eq(rfqs.id, agreement.rfqId), isNull(rfqs.deletedAt)))
        .limit(1),
      this.db
        .select()
        .from(quotes)
        .where(and(eq(quotes.id, agreement.quoteId), isNull(quotes.deletedAt)))
        .limit(1),
      this.db.select().from(vendors).where(eq(vendors.id, agreement.vendorId)).limit(1),
      this.db
        .select()
        .from(paymentScheduleItems)
        .where(eq(paymentScheduleItems.agreementId, agreement.id))
        .orderBy(asc(paymentScheduleItems.sortOrder), asc(paymentScheduleItems.createdAt)),
      this.db.select().from(payments).where(eq(payments.agreementId, agreement.id)),
    ]);

    const rfq = rfqRows[0];
    const quote = quoteRows[0];
    const vendor = vendorRows[0];

    if (!rfq || !quote || !vendor) return null;

    return {
      agreement,
      payments: paymentRows,
      quote,
      rfq,
      scheduleItems,
      vendor,
    };
  }

  async createPayment(input: typeof payments.$inferInsert): Promise<PaymentRow> {
    const [payment] = await this.db.insert(payments).values(input).returning();
    return requireReturnedRow(payment);
  }

  async findOperatingSettingsByVendorId(
    vendorId: string,
  ): Promise<VendorOperatingSettingsRow | null> {
    const [settings] = await this.db
      .select()
      .from(vendorOperatingSettings)
      .where(eq(vendorOperatingSettings.vendorId, vendorId))
      .limit(1);
    return settings ?? null;
  }

  async listRangeEventsForConflict(
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
  ): Promise<CalendarEventRow[]> {
    return this.db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.vendorId, vendorId),
          isNull(calendarEvents.deletedAt),
          lt(calendarEvents.startsAt, startsTo),
          gt(calendarEvents.endsAt, startsFrom),
        ),
      )
      .orderBy(asc(calendarEvents.startsAt), asc(calendarEvents.endsAt));
  }

  async findConfirmedCateringEventByAgreementId(
    agreementId: string,
  ): Promise<ConfirmedCateringEventRecord | null> {
    const [cateringEvent] = await this.db
      .select()
      .from(cateringEvents)
      .where(and(eq(cateringEvents.agreementId, agreementId), isNull(cateringEvents.deletedAt)))
      .limit(1);

    if (!cateringEvent) return null;

    const [calendarEvent] = await this.db
      .select()
      .from(calendarEvents)
      .where(
        and(eq(calendarEvents.cateringEventId, cateringEvent.id), isNull(calendarEvents.deletedAt)),
      )
      .limit(1);

    return calendarEvent ? { calendarEvent, cateringEvent } : null;
  }

  async createCateringEvent(input: typeof cateringEvents.$inferInsert): Promise<CateringEventRow> {
    const [event] = await this.db.insert(cateringEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async createCalendarEvent(input: typeof calendarEvents.$inferInsert): Promise<CalendarEventRow> {
    const [event] = await this.db.insert(calendarEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async updatePayment(
    paymentId: string,
    input: Partial<
      Pick<
        PaymentRow,
        "processingFeeCents" | "status" | "stripeCheckoutSessionId" | "stripePaymentIntentId"
      >
    >,
    updatedAt: Date,
  ): Promise<PaymentRow | null> {
    const [payment] = await this.db
      .update(payments)
      .set({ ...input, updatedAt })
      .where(eq(payments.id, paymentId))
      .returning();
    return payment ?? null;
  }

  async createAttempt(input: typeof paymentAttempts.$inferInsert): Promise<PaymentAttemptRow> {
    const [attempt] = await this.db.insert(paymentAttempts).values(input).returning();
    return requireReturnedRow(attempt);
  }

  async updateAttempt(
    attemptId: string,
    input: Partial<
      Pick<
        PaymentAttemptRow,
        | "completedAt"
        | "failureCode"
        | "failureMessage"
        | "metadata"
        | "status"
        | "stripeCheckoutSessionId"
        | "stripePaymentIntentId"
      >
    >,
  ): Promise<PaymentAttemptRow | null> {
    const [attempt] = await this.db
      .update(paymentAttempts)
      .set(input)
      .where(eq(paymentAttempts.id, attemptId))
      .returning();
    return attempt ?? null;
  }

  async findAttemptByIdempotencyKey(idempotencyKey: string): Promise<PaymentAttemptRow | null> {
    const [attempt] = await this.db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.idempotencyKey, idempotencyKey))
      .limit(1);
    return attempt ?? null;
  }

  async findPaymentById(paymentId: string): Promise<PaymentDetailRecord | null> {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, paymentId));
    return payment ? this.loadPaymentDetail(payment) : null;
  }

  async findPaymentByStripeCheckoutSessionId(
    sessionId: string,
  ): Promise<PaymentDetailRecord | null> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.stripeCheckoutSessionId, sessionId))
      .limit(1);
    return payment ? this.loadPaymentDetail(payment) : null;
  }

  async findPaymentByStripePaymentIntentId(
    paymentIntentId: string,
  ): Promise<PaymentDetailRecord | null> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    return payment ? this.loadPaymentDetail(payment) : null;
  }

  async updatePaymentScheduleItem(
    scheduleItemId: string,
    input: Partial<Pick<PaymentScheduleItemRow, "paidAt" | "status">>,
    updatedAt: Date,
  ): Promise<PaymentScheduleItemRow | null> {
    const [item] = await this.db
      .update(paymentScheduleItems)
      .set({ ...input, updatedAt })
      .where(eq(paymentScheduleItems.id, scheduleItemId))
      .returning();
    return item ?? null;
  }

  async updateRfqStatus(rfqId: string, status: RfqStatus, updatedAt: Date): Promise<RfqRow | null> {
    const [rfq] = await this.db
      .update(rfqs)
      .set({ status, updatedAt })
      .where(and(eq(rfqs.id, rfqId), isNull(rfqs.deletedAt)))
      .returning();
    return rfq ?? null;
  }

  async createStatusHistory(
    input: typeof rfqStatusHistory.$inferInsert,
  ): Promise<RfqStatusHistoryRow> {
    const [history] = await this.db.insert(rfqStatusHistory).values(input).returning();
    return requireReturnedRow(history);
  }

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    const [event] = await this.db.insert(outboxEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const [auditLog] = await this.db.insert(auditLogs).values(input).returning();
    return requireReturnedRow(auditLog);
  }

  async createWebhookEvent(
    input: typeof stripeWebhookEvents.$inferInsert,
  ): Promise<StripeWebhookEventRow> {
    const [event] = await this.db.insert(stripeWebhookEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async findWebhookEventByStripeEventId(
    stripeEventId: string,
  ): Promise<StripeWebhookEventRow | null> {
    const [event] = await this.db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId))
      .limit(1);
    return event ?? null;
  }

  async updateWebhookEvent(
    stripeEventId: string,
    input: Partial<Pick<StripeWebhookEventRow, "lastError" | "processedAt" | "status">>,
    updatedAt: Date,
  ): Promise<StripeWebhookEventRow | null> {
    const [event] = await this.db
      .update(stripeWebhookEvents)
      .set({ ...input, updatedAt })
      .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId))
      .returning();
    return event ?? null;
  }

  async listVendorPayments(vendorId: string, status?: string): Promise<VendorPaymentRecord[]> {
    const conditions = [eq(payments.vendorId, vendorId)];
    if (status && isPaymentStatus(status)) {
      conditions.push(eq(payments.status, status));
    }

    const rows = await this.db
      .select()
      .from(payments)
      .where(and(...conditions))
      .orderBy(asc(payments.createdAt));
    const records = await Promise.all(rows.map((payment) => this.loadVendorPayment(payment)));
    return records.filter((record): record is VendorPaymentRecord => record !== null);
  }

  async transaction<T>(callback: (repo: PaymentRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzlePaymentRepository(tx)));
    }

    return callback(this);
  }

  private async loadPaymentDetail(payment: PaymentRow): Promise<PaymentDetailRecord> {
    const [attempts, scheduleRows] = await Promise.all([
      this.db
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.paymentId, payment.id))
        .orderBy(asc(paymentAttempts.attemptedAt)),
      payment.paymentScheduleItemId
        ? this.db
            .select()
            .from(paymentScheduleItems)
            .where(eq(paymentScheduleItems.id, payment.paymentScheduleItemId))
            .limit(1)
        : [],
    ]);

    return {
      attempts,
      payment,
      scheduleItem: scheduleRows[0] ?? null,
    };
  }

  private async loadVendorPayment(payment: PaymentRow): Promise<VendorPaymentRecord | null> {
    const [agreementRows, rfqRows, detail] = await Promise.all([
      this.db.select().from(agreements).where(eq(agreements.id, payment.agreementId)).limit(1),
      this.db.select().from(rfqs).where(eq(rfqs.id, payment.rfqId)).limit(1),
      this.loadPaymentDetail(payment),
    ]);
    const agreement = agreementRows[0];
    const rfq = rfqRows[0];

    if (!agreement || !rfq) return null;

    return {
      ...detail,
      agreement,
      rfq,
    };
  }
}

const paymentStatuses = [
  "requires_payment",
  "checkout_created",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "refund_pending",
  "partially_refunded",
  "refunded",
] as const;

function isPaymentStatus(value: string): value is PaymentRow["status"] {
  return (paymentStatuses as readonly string[]).includes(value);
}

export function createUnavailablePaymentRepository(): PaymentRepository {
  const unavailable = async () => {
    throw new Error("Payment repository is unavailable because no database client was provided.");
  };

  return {
    createAttempt: unavailable,
    createAuditLog: unavailable,
    createCalendarEvent: unavailable,
    createCateringEvent: unavailable,
    createOutboxEvent: unavailable,
    createPayment: unavailable,
    createStatusHistory: unavailable,
    createWebhookEvent: unavailable,
    findAgreementPaymentContext: unavailable,
    findAttemptByIdempotencyKey: unavailable,
    findConfirmedCateringEventByAgreementId: unavailable,
    findOperatingSettingsByVendorId: unavailable,
    findPaymentById: unavailable,
    findPaymentByStripeCheckoutSessionId: unavailable,
    findPaymentByStripePaymentIntentId: unavailable,
    findVendorById: unavailable,
    findWebhookEventByStripeEventId: unavailable,
    listRangeEventsForConflict: unavailable,
    listVendorPayments: unavailable,
    transaction: unavailable,
    updateAttempt: unavailable,
    updatePayment: unavailable,
    updatePaymentScheduleItem: unavailable,
    updateRfqStatus: unavailable,
    updateVendorStripeReadiness: unavailable,
    updateVendorStripeReadinessByAccountId: unavailable,
    updateWebhookEvent: unavailable,
  };
}
