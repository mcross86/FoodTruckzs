import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  auditLogs,
  outboxEvents,
  platformAgreementFees,
  vendorBillingSettings,
  vendorInvoiceLineItems,
  vendorInvoices,
  vendors,
} from "../../db/schema/index.js";

type BillingDb = Database | Transaction;
type AuditLogRow = typeof auditLogs.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type PlatformAgreementFeeRow = typeof platformAgreementFees.$inferSelect;
type VendorBillingSettingsRow = typeof vendorBillingSettings.$inferSelect;
type VendorInvoiceRow = typeof vendorInvoices.$inferSelect;
type VendorInvoiceLineItemRow = typeof vendorInvoiceLineItems.$inferSelect;
type VendorRow = typeof vendors.$inferSelect;

export type VendorInvoiceDetailRecord = {
  invoice: VendorInvoiceRow;
  lineItems: VendorInvoiceLineItemRow[];
};

export type BillingRepository = {
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  createOutboxEvent: (input: typeof outboxEvents.$inferInsert) => Promise<OutboxEventRow>;
  createVendorInvoice: (input: typeof vendorInvoices.$inferInsert) => Promise<VendorInvoiceRow>;
  createVendorInvoiceLineItems: (
    input: (typeof vendorInvoiceLineItems.$inferInsert)[],
  ) => Promise<VendorInvoiceLineItemRow[]>;
  findBillingSettingsByVendorId: (vendorId: string) => Promise<VendorBillingSettingsRow | null>;
  findInvoiceByVendorAndPeriod: (
    vendorId: string,
    billingPeriodStart: string,
    billingPeriodEnd: string,
  ) => Promise<VendorInvoiceDetailRecord | null>;
  findVendorById: (vendorId: string) => Promise<VendorRow | null>;
  listInvoices: (vendorId?: string) => Promise<VendorInvoiceDetailRecord[]>;
  listPendingAgreementFees: (vendorId?: string) => Promise<PlatformAgreementFeeRow[]>;
  listPendingAgreementFeesForPeriod: (
    vendorId: string,
    startsAt: Date,
    endsAt: Date,
  ) => Promise<PlatformAgreementFeeRow[]>;
  markFeesInvoiced: (feeIds: string[], vendorInvoiceId: string) => Promise<void>;
  transaction: <T>(callback: (repo: BillingRepository) => Promise<T>) => Promise<T>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

export class DrizzleBillingRepository implements BillingRepository {
  constructor(private readonly db: BillingDb) {}

  async findVendorById(vendorId: string): Promise<VendorRow | null> {
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    return vendor ?? null;
  }

  async findBillingSettingsByVendorId(vendorId: string): Promise<VendorBillingSettingsRow | null> {
    const [settings] = await this.db
      .select()
      .from(vendorBillingSettings)
      .where(eq(vendorBillingSettings.vendorId, vendorId))
      .limit(1);

    return settings ?? null;
  }

  async listPendingAgreementFees(vendorId?: string): Promise<PlatformAgreementFeeRow[]> {
    const condition = vendorId
      ? and(
          eq(platformAgreementFees.status, "pending_invoice"),
          eq(platformAgreementFees.vendorId, vendorId),
        )
      : eq(platformAgreementFees.status, "pending_invoice");

    return this.db
      .select()
      .from(platformAgreementFees)
      .where(condition)
      .orderBy(asc(platformAgreementFees.calculatedAt), asc(platformAgreementFees.createdAt));
  }

  async listPendingAgreementFeesForPeriod(
    vendorId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<PlatformAgreementFeeRow[]> {
    return this.db
      .select()
      .from(platformAgreementFees)
      .where(
        and(
          eq(platformAgreementFees.vendorId, vendorId),
          eq(platformAgreementFees.status, "pending_invoice"),
          gte(platformAgreementFees.calculatedAt, startsAt),
          lte(platformAgreementFees.calculatedAt, endsAt),
        ),
      )
      .orderBy(asc(platformAgreementFees.calculatedAt), asc(platformAgreementFees.createdAt));
  }

  async findInvoiceByVendorAndPeriod(
    vendorId: string,
    billingPeriodStart: string,
    billingPeriodEnd: string,
  ): Promise<VendorInvoiceDetailRecord | null> {
    const [invoice] = await this.db
      .select()
      .from(vendorInvoices)
      .where(
        and(
          eq(vendorInvoices.vendorId, vendorId),
          eq(vendorInvoices.billingPeriodStart, billingPeriodStart),
          eq(vendorInvoices.billingPeriodEnd, billingPeriodEnd),
        ),
      )
      .limit(1);

    return invoice ? this.loadInvoiceDetail(invoice) : null;
  }

  async listInvoices(vendorId?: string): Promise<VendorInvoiceDetailRecord[]> {
    const invoiceRows = vendorId
      ? await this.db
          .select()
          .from(vendorInvoices)
          .where(eq(vendorInvoices.vendorId, vendorId))
          .orderBy(desc(vendorInvoices.createdAt))
      : await this.db.select().from(vendorInvoices).orderBy(desc(vendorInvoices.createdAt));

    return Promise.all(invoiceRows.map((invoice) => this.loadInvoiceDetail(invoice)));
  }

  async createVendorInvoice(input: typeof vendorInvoices.$inferInsert): Promise<VendorInvoiceRow> {
    const [invoice] = await this.db.insert(vendorInvoices).values(input).returning();
    return requireReturnedRow(invoice);
  }

  async createVendorInvoiceLineItems(
    input: (typeof vendorInvoiceLineItems.$inferInsert)[],
  ): Promise<VendorInvoiceLineItemRow[]> {
    if (input.length === 0) {
      return [];
    }

    return this.db.insert(vendorInvoiceLineItems).values(input).returning();
  }

  async markFeesInvoiced(feeIds: string[], vendorInvoiceId: string): Promise<void> {
    if (feeIds.length === 0) {
      return;
    }

    await this.db
      .update(platformAgreementFees)
      .set({
        status: "invoiced",
        vendorInvoiceId,
      })
      .where(inArray(platformAgreementFees.id, feeIds));
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const [auditLog] = await this.db.insert(auditLogs).values(input).returning();
    return requireReturnedRow(auditLog);
  }

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    const [event] = await this.db.insert(outboxEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async transaction<T>(callback: (repo: BillingRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleBillingRepository(tx)));
    }

    return callback(this);
  }

  private async loadInvoiceDetail(invoice: VendorInvoiceRow): Promise<VendorInvoiceDetailRecord> {
    const lineItems = await this.db
      .select()
      .from(vendorInvoiceLineItems)
      .where(eq(vendorInvoiceLineItems.vendorInvoiceId, invoice.id))
      .orderBy(asc(vendorInvoiceLineItems.createdAt));

    return { invoice, lineItems };
  }
}

export function createUnavailableBillingRepository(): BillingRepository {
  const unavailable = async () => {
    throw new Error("Billing repository is unavailable because no database client was provided.");
  };

  return {
    createAuditLog: unavailable,
    createOutboxEvent: unavailable,
    createVendorInvoice: unavailable,
    createVendorInvoiceLineItems: unavailable,
    findBillingSettingsByVendorId: unavailable,
    findInvoiceByVendorAndPeriod: unavailable,
    findVendorById: unavailable,
    listInvoices: unavailable,
    listPendingAgreementFees: unavailable,
    listPendingAgreementFeesForPeriod: unavailable,
    markFeesInvoiced: unavailable,
    transaction: async (callback) => callback(createUnavailableBillingRepository()),
  };
}
