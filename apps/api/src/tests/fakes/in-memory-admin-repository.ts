import { randomUUID } from "node:crypto";

import type { auditLogs, payments, stripeWebhookEvents } from "../../db/schema/index.js";
import type {
  AdminPaymentQuery,
  AdminRepository,
  PaymentMonitoringRecord,
  RfqReviewRecord,
  VendorReviewRecord,
} from "../../modules/admin/admin.repository.js";
import type { InMemoryAgreementRepository } from "./in-memory-agreement-repository.js";
import type { InMemoryPaymentRepository } from "./in-memory-payment-repository.js";
import type { InMemoryQuoteRepository } from "./in-memory-quote-repository.js";
import type { InMemoryRfqRepository } from "./in-memory-rfq-repository.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

type AuditLogRow = typeof auditLogs.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type StripeWebhookEventRow = typeof stripeWebhookEvents.$inferSelect;

function now(): Date {
  return new Date();
}

export class InMemoryAdminRepository implements AdminRepository {
  readonly auditLogs = new Map<string, AuditLogRow>();

  constructor(
    private readonly agreementRepository: InMemoryAgreementRepository,
    private readonly paymentRepository: InMemoryPaymentRepository,
    private readonly quoteRepository: InMemoryQuoteRepository,
    private readonly rfqRepository: InMemoryRfqRepository,
    private readonly vendorRepository: InMemoryVendorRepository,
  ) {}

  async listVendorReviews(query: {
    approvalStatus?: VendorReviewRecord["vendor"]["approvalStatus"];
    search?: string;
  }): Promise<VendorReviewRecord[]> {
    const normalizedSearch = query.search?.toLowerCase();
    return Promise.all(
      [...this.vendorRepository.vendors.values()]
        .filter((vendor) => vendor.deletedAt === null)
        .filter((vendor) => !query.approvalStatus || vendor.approvalStatus === query.approvalStatus)
        .filter(
          (vendor) =>
            !normalizedSearch ||
            vendor.businessName.toLowerCase().includes(normalizedSearch) ||
            vendor.slug.toLowerCase().includes(normalizedSearch),
        )
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .map((vendor) => this.loadVendorReview(vendor.id)),
    );
  }

  async findVendorReview(vendorId: string): Promise<VendorReviewRecord | null> {
    const vendor = this.vendorRepository.vendors.get(vendorId);
    return vendor && vendor.deletedAt === null ? this.loadVendorReview(vendorId) : null;
  }

  async updateVendorState(
    vendorId: string,
    input: Parameters<AdminRepository["updateVendorState"]>[1],
    updatedAt: Date,
  ) {
    const vendor = this.vendorRepository.vendors.get(vendorId);
    if (!vendor || vendor.deletedAt !== null) return null;

    const updated = { ...vendor, ...input, updatedAt };
    this.vendorRepository.vendors.set(vendorId, updated);
    return updated;
  }

  async listRfqReviews(query: {
    search?: string;
    status?: RfqReviewRecord["rfq"]["status"];
  }): Promise<RfqReviewRecord[]> {
    const normalizedSearch = query.search?.toLowerCase();
    return Promise.all(
      [...this.rfqRepository.rfqs.values()]
        .filter((rfq) => rfq.deletedAt === null)
        .filter((rfq) => !query.status || rfq.status === query.status)
        .filter(
          (rfq) =>
            !normalizedSearch ||
            rfq.eventName.toLowerCase().includes(normalizedSearch) ||
            rfq.eventType.toLowerCase().includes(normalizedSearch),
        )
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .map((rfq) => this.loadRfqReview(rfq.id)),
    );
  }

  async findRfqReview(rfqId: string): Promise<RfqReviewRecord | null> {
    const rfq = this.rfqRepository.rfqs.get(rfqId);
    return rfq && rfq.deletedAt === null ? this.loadRfqReview(rfqId) : null;
  }

  async listPaymentRecords(query: AdminPaymentQuery): Promise<PaymentMonitoringRecord[]> {
    return [...this.paymentRepository.payments.values()]
      .filter((payment) => !query.status || payment.status === query.status)
      .filter((payment) => !query.vendorId || payment.vendorId === query.vendorId)
      .filter(
        (payment) => !query.dateFrom || payment.createdAt.getTime() >= query.dateFrom.getTime(),
      )
      .filter((payment) => !query.dateTo || payment.createdAt.getTime() <= query.dateTo.getTime())
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((payment) => this.loadPaymentRecord(payment));
  }

  async listWebhookEvents(query: {
    failedOnly?: boolean;
    status?: StripeWebhookEventRow["status"];
  }) {
    return [...this.paymentRepository.webhookEvents.values()]
      .filter((event) => {
        if (query.failedOnly) return event.status === "failed";
        return !query.status || event.status === query.status;
      })
      .sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime());
  }

  async listPendingPlatformFees() {
    return [...this.agreementRepository.platformAgreementFees.values()]
      .filter((fee) => fee.status === "pending_invoice")
      .sort((left, right) => left.calculatedAt.getTime() - right.calculatedAt.getTime());
  }

  async listAuditLogsForEntity(entityType: string, entityId: string) {
    return this.allAuditLogs()
      .filter((auditLog) => auditLog.entityType === entityType && auditLog.entityId === entityId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const auditLog: AuditLogRow = {
      action: input.action,
      actorRole: input.actorRole ?? null,
      actorUserId: input.actorUserId ?? null,
      createdAt: now(),
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      id: randomUUID(),
      ipAddress: input.ipAddress ?? null,
      newState: input.newState ?? null,
      previousState: input.previousState ?? null,
      requestId: input.requestId ?? null,
      userAgent: input.userAgent ?? null,
      vendorId: input.vendorId ?? null,
    };
    this.auditLogs.set(auditLog.id, auditLog);
    return auditLog;
  }

  async transaction<T>(callback: (repo: AdminRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private allAuditLogs(): AuditLogRow[] {
    return [
      ...this.auditLogs.values(),
      ...this.vendorRepository.auditLogs.values(),
      ...this.rfqRepository.auditLogs.values(),
    ];
  }

  private async loadVendorReview(vendorId: string): Promise<VendorReviewRecord> {
    const vendor = this.vendorRepository.vendors.get(vendorId);
    if (!vendor) throw new Error("Expected vendor.");

    const cuisineIds = this.vendorRepository.vendorCuisineIds.get(vendorId) ?? new Set<string>();
    const cuisines = [...cuisineIds]
      .map((cuisineId) => this.vendorRepository.cuisines.get(cuisineId))
      .filter((cuisine) => cuisine !== undefined);

    return {
      auditLogs: await this.listAuditLogsForEntity("vendor", vendorId),
      cuisines,
      profile: this.vendorRepository.profiles.get(vendorId) ?? null,
      serviceAreas: [...this.vendorRepository.serviceAreas.values()].filter(
        (area) => area.vendorId === vendorId,
      ),
      vendor,
    };
  }

  private async loadRfqReview(rfqId: string): Promise<RfqReviewRecord> {
    const rfq = this.rfqRepository.rfqs.get(rfqId);
    if (!rfq) throw new Error("Expected RFQ.");
    const threads = [...this.rfqRepository.threads.values()].filter(
      (thread) => thread.rfqId === rfqId,
    );
    const threadIds = new Set(threads.map((thread) => thread.id));

    return {
      address: rfq.venueAddressId
        ? (this.rfqRepository.addresses.get(rfq.venueAddressId) ?? null)
        : null,
      agreements: [...this.agreementRepository.agreements.values()].filter(
        (agreement) => agreement.rfqId === rfqId,
      ),
      auditLogs: await this.listAuditLogsForEntity("rfq", rfqId),
      messages: [...this.rfqRepository.messages.values()].filter((message) =>
        threadIds.has(message.threadId),
      ),
      payments: [...this.paymentRepository.payments.values()].filter(
        (payment) => payment.rfqId === rfqId,
      ),
      quotes: [...this.quoteRepository.quotes.values()].filter((quote) => quote.rfqId === rfqId),
      requirements: [...this.rfqRepository.requirements.values()].filter(
        (requirement) => requirement.rfqId === rfqId,
      ),
      rfq,
      statusHistory: [...this.rfqRepository.statusHistory.values()].filter(
        (history) => history.rfqId === rfqId,
      ),
      targets: [...this.rfqRepository.targets.values()].filter((target) => target.rfqId === rfqId),
      threads,
    };
  }

  private loadPaymentRecord(payment: PaymentRow): PaymentMonitoringRecord {
    return {
      attempts: [...this.paymentRepository.attempts.values()].filter(
        (attempt) => attempt.paymentId === payment.id,
      ),
      payment,
      rfq: this.rfqRepository.rfqs.get(payment.rfqId) ?? null,
      vendor: this.vendorRepository.vendors.get(payment.vendorId) ?? null,
    };
  }
}
