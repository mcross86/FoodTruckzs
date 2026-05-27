import { randomUUID } from "node:crypto";

import type {
  auditLogs,
  calendarEvents,
  cateringEvents,
  outboxEvents,
  paymentAttempts,
  payments,
  paymentScheduleItems,
  rfqStatusHistory,
  stripeWebhookEvents,
} from "../../db/schema/index.js";
import type {
  PaymentAgreementContext,
  PaymentDetailRecord,
  PaymentRepository,
  UpdateVendorStripeReadinessInput,
  VendorPaymentRecord,
} from "../../modules/payments/payments.repository.js";
import type { RfqStatus } from "../../modules/rfqs/rfq-state-machine.js";
import type { InMemoryAgreementRepository } from "./in-memory-agreement-repository.js";
import type { InMemoryQuoteRepository } from "./in-memory-quote-repository.js";
import type { InMemoryRfqRepository } from "./in-memory-rfq-repository.js";
import type { InMemorySchedulingRepository } from "./in-memory-scheduling-repository.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

type AuditLogRow = typeof auditLogs.$inferSelect;
type CalendarEventRow = typeof calendarEvents.$inferSelect;
type CateringEventRow = typeof cateringEvents.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type PaymentAttemptRow = typeof paymentAttempts.$inferSelect;
type PaymentScheduleItemRow = typeof paymentScheduleItems.$inferSelect;
type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;
type StripeWebhookEventRow = typeof stripeWebhookEvents.$inferSelect;

function now(): Date {
  return new Date();
}

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly attempts = new Map<string, PaymentAttemptRow>();
  readonly payments = new Map<string, PaymentRow>();
  readonly webhookEvents = new Map<string, StripeWebhookEventRow>();

  constructor(
    private readonly agreementRepository: InMemoryAgreementRepository,
    private readonly quoteRepository: InMemoryQuoteRepository,
    private readonly rfqRepository: InMemoryRfqRepository,
    private readonly vendorRepository: InMemoryVendorRepository,
    private readonly schedulingRepository?: InMemorySchedulingRepository,
  ) {}

  async findVendorById(vendorId: string) {
    return this.vendorRepository.findVendorById(vendorId);
  }

  async updateVendorStripeReadiness(
    vendorId: string,
    input: UpdateVendorStripeReadinessInput,
    updatedAt: Date,
  ) {
    const vendor = this.vendorRepository.vendors.get(vendorId);
    if (!vendor) return null;

    const updated = {
      ...vendor,
      stripeChargesEnabled: input.chargesEnabled,
      stripeConnectAccountId: input.accountId,
      stripeDetailsSubmitted: input.detailsSubmitted,
      stripeDisabledReason: input.disabledReason,
      stripePayoutsEnabled: input.payoutsEnabled,
      updatedAt,
    };
    this.vendorRepository.vendors.set(vendorId, updated);
    return updated;
  }

  async updateVendorStripeReadinessByAccountId(
    input: UpdateVendorStripeReadinessInput,
    updatedAt: Date,
  ) {
    const vendor = [...this.vendorRepository.vendors.values()].find(
      (candidate) => candidate.stripeConnectAccountId === input.accountId,
    );
    return vendor ? this.updateVendorStripeReadiness(vendor.id, input, updatedAt) : null;
  }

  async findAgreementPaymentContext(agreementId: string): Promise<PaymentAgreementContext | null> {
    const agreement = this.agreementRepository.agreements.get(agreementId);
    if (!agreement || agreement.deletedAt !== null) return null;

    const rfq = this.rfqRepository.rfqs.get(agreement.rfqId);
    const quote = this.quoteRepository.quotes.get(agreement.quoteId);
    const vendor = this.vendorRepository.vendors.get(agreement.vendorId);
    if (!rfq || !quote || !vendor) return null;

    return {
      agreement,
      payments: [...this.payments.values()].filter(
        (payment) => payment.agreementId === agreementId,
      ),
      quote,
      rfq,
      scheduleItems: [...this.quoteRepository.paymentScheduleItems.values()]
        .filter((item) => item.agreementId === agreementId)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      vendor,
    };
  }

  async createPayment(input: typeof payments.$inferInsert): Promise<PaymentRow> {
    const createdAt = now();
    const payment: PaymentRow = {
      agreementId: input.agreementId,
      amountCents: input.amountCents,
      createdAt,
      currency: input.currency ?? "usd",
      customerUserId: input.customerUserId,
      id: randomUUID(),
      paymentScheduleItemId: input.paymentScheduleItemId ?? null,
      processingFeeCents: input.processingFeeCents ?? 0,
      quoteId: input.quoteId,
      rfqId: input.rfqId,
      status: input.status ?? "requires_payment",
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      type: input.type,
      updatedAt: createdAt,
      vendorId: input.vendorId,
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  async updatePayment(
    paymentId: string,
    input: Parameters<PaymentRepository["updatePayment"]>[1],
    updatedAt: Date,
  ): Promise<PaymentRow | null> {
    const payment = this.payments.get(paymentId);
    if (!payment) return null;

    const updated = { ...payment, ...input, updatedAt };
    this.payments.set(paymentId, updated);
    return updated;
  }

  async createAttempt(input: typeof paymentAttempts.$inferInsert): Promise<PaymentAttemptRow> {
    const attempt: PaymentAttemptRow = {
      amountCents: input.amountCents,
      attemptedAt: input.attemptedAt ?? now(),
      completedAt: input.completedAt ?? null,
      currency: input.currency ?? "usd",
      failureCode: input.failureCode ?? null,
      failureMessage: input.failureMessage ?? null,
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: input.metadata ?? {},
      paymentId: input.paymentId,
      status: input.status ?? "checkout_pending",
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    };
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async updateAttempt(
    attemptId: string,
    input: Parameters<PaymentRepository["updateAttempt"]>[1],
  ): Promise<PaymentAttemptRow | null> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) return null;

    const updated = { ...attempt, ...input };
    this.attempts.set(attemptId, updated);
    return updated;
  }

  async findAttemptByIdempotencyKey(idempotencyKey: string): Promise<PaymentAttemptRow | null> {
    return (
      [...this.attempts.values()].find((attempt) => attempt.idempotencyKey === idempotencyKey) ??
      null
    );
  }

  async findPaymentById(paymentId: string): Promise<PaymentDetailRecord | null> {
    const payment = this.payments.get(paymentId);
    return payment ? this.loadDetail(payment) : null;
  }

  async findPaymentByStripeCheckoutSessionId(
    sessionId: string,
  ): Promise<PaymentDetailRecord | null> {
    const payment = [...this.payments.values()].find(
      (candidate) => candidate.stripeCheckoutSessionId === sessionId,
    );
    return payment ? this.loadDetail(payment) : null;
  }

  async findPaymentByStripePaymentIntentId(
    paymentIntentId: string,
  ): Promise<PaymentDetailRecord | null> {
    const payment = [...this.payments.values()].find(
      (candidate) => candidate.stripePaymentIntentId === paymentIntentId,
    );
    return payment ? this.loadDetail(payment) : null;
  }

  async updatePaymentScheduleItem(
    scheduleItemId: string,
    input: Partial<Pick<PaymentScheduleItemRow, "paidAt" | "status">>,
    updatedAt: Date,
  ) {
    const item = this.quoteRepository.paymentScheduleItems.get(scheduleItemId);
    if (!item) return null;

    const updated = { ...item, ...input, updatedAt };
    this.quoteRepository.paymentScheduleItems.set(scheduleItemId, updated);
    return updated;
  }

  async updateRfqStatus(rfqId: string, status: RfqStatus, updatedAt: Date) {
    return this.rfqRepository.updateRfqStatus(rfqId, status, updatedAt);
  }

  async findOperatingSettingsByVendorId(vendorId: string) {
    return this.vendorRepository.operatingSettings.get(vendorId) ?? null;
  }

  async listRangeEventsForConflict(
    vendorId: string,
    startsFrom: Date,
    startsTo: Date,
  ): Promise<CalendarEventRow[]> {
    return this.requireSchedulingRepository().listRangeEventsForConflict(
      vendorId,
      startsFrom,
      startsTo,
    );
  }

  async findConfirmedCateringEventByAgreementId(agreementId: string) {
    return this.requireSchedulingRepository().findConfirmedCateringEventByAgreementId(agreementId);
  }

  async createCateringEvent(input: typeof cateringEvents.$inferInsert): Promise<CateringEventRow> {
    return this.requireSchedulingRepository().createCateringEvent(input);
  }

  async createCalendarEvent(input: typeof calendarEvents.$inferInsert): Promise<CalendarEventRow> {
    return this.requireSchedulingRepository().createCalendarEvent(input);
  }

  async createStatusHistory(
    input: typeof rfqStatusHistory.$inferInsert,
  ): Promise<RfqStatusHistoryRow> {
    return this.rfqRepository.createStatusHistory(input);
  }

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    return this.rfqRepository.createOutboxEvent(input);
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    return this.rfqRepository.createAuditLog(input);
  }

  async createWebhookEvent(
    input: typeof stripeWebhookEvents.$inferInsert,
  ): Promise<StripeWebhookEventRow> {
    const createdAt = now();
    const event: StripeWebhookEventRow = {
      eventType: input.eventType,
      id: randomUUID(),
      lastError: input.lastError ?? null,
      payload: input.payload,
      processedAt: input.processedAt ?? null,
      receivedAt: input.receivedAt ?? createdAt,
      status: input.status ?? "received",
      stripeEventId: input.stripeEventId,
      updatedAt: createdAt,
    };
    this.webhookEvents.set(event.stripeEventId, event);
    return event;
  }

  async findWebhookEventByStripeEventId(stripeEventId: string) {
    return this.webhookEvents.get(stripeEventId) ?? null;
  }

  async updateWebhookEvent(
    stripeEventId: string,
    input: Parameters<PaymentRepository["updateWebhookEvent"]>[1],
    updatedAt: Date,
  ) {
    const event = this.webhookEvents.get(stripeEventId);
    if (!event) return null;

    const updated = { ...event, ...input, updatedAt };
    this.webhookEvents.set(stripeEventId, updated);
    return updated;
  }

  async listVendorPayments(vendorId: string, status?: string): Promise<VendorPaymentRecord[]> {
    const rows = [...this.payments.values()].filter(
      (payment) => payment.vendorId === vendorId && (!status || payment.status === status),
    );
    const records = rows.map((payment) => this.loadVendorPayment(payment));
    return records.filter((record): record is VendorPaymentRecord => record !== null);
  }

  async transaction<T>(callback: (repo: PaymentRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private requireSchedulingRepository(): InMemorySchedulingRepository {
    if (!this.schedulingRepository) {
      throw new Error("In-memory scheduling repository is required for calendar confirmation.");
    }

    return this.schedulingRepository;
  }

  private loadDetail(payment: PaymentRow): PaymentDetailRecord {
    return {
      attempts: [...this.attempts.values()]
        .filter((attempt) => attempt.paymentId === payment.id)
        .sort((left, right) => left.attemptedAt.getTime() - right.attemptedAt.getTime()),
      payment,
      scheduleItem: payment.paymentScheduleItemId
        ? (this.quoteRepository.paymentScheduleItems.get(payment.paymentScheduleItemId) ?? null)
        : null,
    };
  }

  private loadVendorPayment(payment: PaymentRow): VendorPaymentRecord | null {
    const agreement = this.agreementRepository.agreements.get(payment.agreementId);
    const rfq = this.rfqRepository.rfqs.get(payment.rfqId);
    if (!agreement || !rfq) return null;

    return {
      ...this.loadDetail(payment),
      agreement,
      rfq,
    };
  }
}
