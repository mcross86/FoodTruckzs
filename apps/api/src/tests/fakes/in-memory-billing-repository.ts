import { randomUUID } from "node:crypto";

import type {
  auditLogs,
  outboxEvents,
  vendorInvoiceLineItems,
  vendorInvoices,
} from "../../db/schema/index.js";
import type {
  BillingRepository,
  VendorInvoiceDetailRecord,
} from "../../modules/billing/billing.repository.js";
import type { InMemoryAgreementRepository } from "./in-memory-agreement-repository.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

type AuditLogRow = typeof auditLogs.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type VendorInvoiceRow = typeof vendorInvoices.$inferSelect;
type VendorInvoiceLineItemRow = typeof vendorInvoiceLineItems.$inferSelect;

function now(): Date {
  return new Date();
}

export class InMemoryBillingRepository implements BillingRepository {
  readonly auditLogs = new Map<string, AuditLogRow>();
  readonly invoiceLineItems = new Map<string, VendorInvoiceLineItemRow>();
  readonly invoices = new Map<string, VendorInvoiceRow>();
  readonly outboxEvents = new Map<string, OutboxEventRow>();

  constructor(
    private readonly agreementRepository: InMemoryAgreementRepository,
    private readonly vendorRepository: InMemoryVendorRepository,
  ) {}

  async findVendorById(vendorId: string) {
    return this.vendorRepository.findVendorById(vendorId);
  }

  async findBillingSettingsByVendorId(vendorId: string) {
    return this.vendorRepository.findBillingSettingsByVendorId(vendorId);
  }

  async listPendingAgreementFees(vendorId?: string) {
    return [...this.agreementRepository.platformAgreementFees.values()]
      .filter(
        (fee) =>
          fee.status === "pending_invoice" && (vendorId === undefined || fee.vendorId === vendorId),
      )
      .sort((left, right) => left.calculatedAt.getTime() - right.calculatedAt.getTime());
  }

  async listPendingAgreementFeesForPeriod(vendorId: string, startsAt: Date, endsAt: Date) {
    return [...this.agreementRepository.platformAgreementFees.values()]
      .filter(
        (fee) =>
          fee.vendorId === vendorId &&
          fee.status === "pending_invoice" &&
          fee.calculatedAt.getTime() >= startsAt.getTime() &&
          fee.calculatedAt.getTime() <= endsAt.getTime(),
      )
      .sort((left, right) => left.calculatedAt.getTime() - right.calculatedAt.getTime());
  }

  async findInvoiceByVendorAndPeriod(
    vendorId: string,
    billingPeriodStart: string,
    billingPeriodEnd: string,
  ): Promise<VendorInvoiceDetailRecord | null> {
    const invoice = [...this.invoices.values()].find(
      (candidate) =>
        candidate.vendorId === vendorId &&
        candidate.billingPeriodStart === billingPeriodStart &&
        candidate.billingPeriodEnd === billingPeriodEnd,
    );

    return invoice ? this.loadInvoiceDetail(invoice) : null;
  }

  async listInvoices(vendorId?: string): Promise<VendorInvoiceDetailRecord[]> {
    return Promise.all(
      [...this.invoices.values()]
        .filter((invoice) => vendorId === undefined || invoice.vendorId === vendorId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .map((invoice) => this.loadInvoiceDetail(invoice)),
    );
  }

  async createVendorInvoice(input: typeof vendorInvoices.$inferInsert): Promise<VendorInvoiceRow> {
    const createdAt = now();
    const invoice: VendorInvoiceRow = {
      billingPeriodEnd: input.billingPeriodEnd ?? null,
      billingPeriodStart: input.billingPeriodStart ?? null,
      createdAt,
      currency: input.currency ?? "usd",
      dueAt: input.dueAt ?? null,
      id: randomUUID(),
      invoiceNumber: input.invoiceNumber,
      issuedAt: input.issuedAt ?? null,
      paidAt: input.paidAt ?? null,
      status: input.status ?? "draft",
      subtotalCents: input.subtotalCents ?? 0,
      totalCents: input.totalCents ?? 0,
      updatedAt: createdAt,
      vendorId: input.vendorId,
    };

    this.invoices.set(invoice.id, invoice);
    return invoice;
  }

  async createVendorInvoiceLineItems(
    input: (typeof vendorInvoiceLineItems.$inferInsert)[],
  ): Promise<VendorInvoiceLineItemRow[]> {
    const rows = input.map((lineItem): VendorInvoiceLineItemRow => {
      const row = {
        amountCents: lineItem.amountCents,
        createdAt: now(),
        currency: lineItem.currency ?? "usd",
        description: lineItem.description,
        id: randomUUID(),
        metadata: lineItem.metadata ?? {},
        platformAgreementFeeId: lineItem.platformAgreementFeeId ?? null,
        type: lineItem.type,
        vendorInvoiceId: lineItem.vendorInvoiceId,
      };
      this.invoiceLineItems.set(row.id, row);
      return row;
    });

    return rows;
  }

  async markFeesInvoiced(feeIds: string[], vendorInvoiceId: string): Promise<void> {
    for (const feeId of feeIds) {
      const fee = this.agreementRepository.platformAgreementFees.get(feeId);

      if (fee) {
        this.agreementRepository.platformAgreementFees.set(feeId, {
          ...fee,
          status: "invoiced",
          vendorInvoiceId,
        });
      }
    }
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

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    const createdAt = now();
    const event: OutboxEventRow = {
      aggregateId: input.aggregateId,
      aggregateType: input.aggregateType,
      attempts: input.attempts ?? 0,
      availableAt: input.availableAt ?? createdAt,
      createdAt,
      eventType: input.eventType,
      id: randomUUID(),
      lastError: input.lastError ?? null,
      payload: input.payload,
      processedAt: input.processedAt ?? null,
      requestId: input.requestId ?? null,
      status: input.status ?? "pending",
      updatedAt: createdAt,
    };

    this.outboxEvents.set(event.id, event);
    return event;
  }

  async transaction<T>(callback: (repo: BillingRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private loadInvoiceDetail(invoice: VendorInvoiceRow): VendorInvoiceDetailRecord {
    return {
      invoice,
      lineItems: [...this.invoiceLineItems.values()].filter(
        (lineItem) => lineItem.vendorInvoiceId === invoice.id,
      ),
    };
  }
}
