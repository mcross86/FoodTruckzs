import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  addresses,
  agreements,
  auditLogs,
  cuisines,
  messages,
  messageThreads,
  paymentAttempts,
  payments,
  platformAgreementFees,
  quotes,
  rfqs,
  rfqRequirements,
  rfqStatusHistory,
  rfqVendorTargets,
  stripeWebhookEvents,
  vendorCuisines,
  vendorProfiles,
  vendors,
  vendorServiceAreas,
} from "../../db/schema/index.js";

type AdminDb = Database | Transaction;
type AddressRow = typeof addresses.$inferSelect;
type AgreementRow = typeof agreements.$inferSelect;
type AuditLogRow = typeof auditLogs.$inferSelect;
type CuisineRow = typeof cuisines.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type MessageThreadRow = typeof messageThreads.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type PaymentAttemptRow = typeof paymentAttempts.$inferSelect;
type PlatformAgreementFeeRow = typeof platformAgreementFees.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;
type RfqRow = typeof rfqs.$inferSelect;
type RfqRequirementRow = typeof rfqRequirements.$inferSelect;
type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;
type RfqTargetRow = typeof rfqVendorTargets.$inferSelect;
type StripeWebhookEventRow = typeof stripeWebhookEvents.$inferSelect;
type VendorRow = typeof vendors.$inferSelect;
type VendorProfileRow = typeof vendorProfiles.$inferSelect;
type VendorServiceAreaRow = typeof vendorServiceAreas.$inferSelect;

export type VendorReviewRecord = {
  auditLogs: AuditLogRow[];
  cuisines: CuisineRow[];
  profile: VendorProfileRow | null;
  serviceAreas: VendorServiceAreaRow[];
  vendor: VendorRow;
};

export type RfqReviewRecord = {
  address: AddressRow | null;
  agreements: AgreementRow[];
  auditLogs: AuditLogRow[];
  messages: MessageRow[];
  payments: PaymentRow[];
  quotes: QuoteRow[];
  requirements: RfqRequirementRow[];
  rfq: RfqRow;
  statusHistory: RfqStatusHistoryRow[];
  targets: RfqTargetRow[];
  threads: MessageThreadRow[];
};

export type PaymentMonitoringRecord = {
  attempts: PaymentAttemptRow[];
  payment: PaymentRow;
  rfq: RfqRow | null;
  vendor: VendorRow | null;
};

export type AdminPaymentQuery = {
  dateFrom?: Date;
  dateTo?: Date;
  status?: PaymentRow["status"];
  vendorId?: string;
};

export type AdminRepository = {
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  findRfqReview: (rfqId: string) => Promise<RfqReviewRecord | null>;
  findVendorReview: (vendorId: string) => Promise<VendorReviewRecord | null>;
  listAuditLogsForEntity: (entityType: string, entityId: string) => Promise<AuditLogRow[]>;
  listPaymentRecords: (query: AdminPaymentQuery) => Promise<PaymentMonitoringRecord[]>;
  listPendingPlatformFees: () => Promise<PlatformAgreementFeeRow[]>;
  listRfqReviews: (query: {
    search?: string;
    status?: RfqRow["status"];
  }) => Promise<RfqReviewRecord[]>;
  listVendorReviews: (query: {
    approvalStatus?: VendorRow["approvalStatus"];
    search?: string;
  }) => Promise<VendorReviewRecord[]>;
  listWebhookEvents: (query: {
    failedOnly?: boolean;
    status?: StripeWebhookEventRow["status"];
  }) => Promise<StripeWebhookEventRow[]>;
  transaction: <T>(callback: (repo: AdminRepository) => Promise<T>) => Promise<T>;
  updateVendorState: (
    vendorId: string,
    input: Partial<Pick<VendorRow, "approvalStatus" | "isPublished" | "status">>,
    updatedAt: Date,
  ) => Promise<VendorRow | null>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

export class DrizzleAdminRepository implements AdminRepository {
  constructor(private readonly db: AdminDb) {}

  async listVendorReviews(query: {
    approvalStatus?: VendorRow["approvalStatus"];
    search?: string;
  }): Promise<VendorReviewRecord[]> {
    const conditions = [isNull(vendors.deletedAt)];

    if (query.approvalStatus) {
      conditions.push(eq(vendors.approvalStatus, query.approvalStatus));
    }

    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(or(ilike(vendors.businessName, pattern), ilike(vendors.slug, pattern))!);
    }

    const rows = await this.db
      .select()
      .from(vendors)
      .where(and(...conditions))
      .orderBy(desc(vendors.createdAt));

    return Promise.all(rows.map((vendor) => this.loadVendorReview(vendor)));
  }

  async findVendorReview(vendorId: string): Promise<VendorReviewRecord | null> {
    const [vendor] = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)))
      .limit(1);

    return vendor ? this.loadVendorReview(vendor) : null;
  }

  async updateVendorState(
    vendorId: string,
    input: Partial<Pick<VendorRow, "approvalStatus" | "isPublished" | "status">>,
    updatedAt: Date,
  ): Promise<VendorRow | null> {
    const [vendor] = await this.db
      .update(vendors)
      .set({ ...input, updatedAt })
      .where(and(eq(vendors.id, vendorId), isNull(vendors.deletedAt)))
      .returning();

    return vendor ?? null;
  }

  async listRfqReviews(query: {
    search?: string;
    status?: RfqRow["status"];
  }): Promise<RfqReviewRecord[]> {
    const conditions = [isNull(rfqs.deletedAt)];

    if (query.status) {
      conditions.push(eq(rfqs.status, query.status));
    }

    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(or(ilike(rfqs.eventName, pattern), ilike(rfqs.eventType, pattern))!);
    }

    const rows = await this.db
      .select()
      .from(rfqs)
      .where(and(...conditions))
      .orderBy(desc(rfqs.createdAt));

    return Promise.all(rows.map((rfq) => this.loadRfqReview(rfq)));
  }

  async findRfqReview(rfqId: string): Promise<RfqReviewRecord | null> {
    const [rfq] = await this.db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.id, rfqId), isNull(rfqs.deletedAt)))
      .limit(1);

    return rfq ? this.loadRfqReview(rfq) : null;
  }

  async listPaymentRecords(query: AdminPaymentQuery): Promise<PaymentMonitoringRecord[]> {
    const conditions = [];

    if (query.status) {
      conditions.push(eq(payments.status, query.status));
    }

    if (query.vendorId) {
      conditions.push(eq(payments.vendorId, query.vendorId));
    }

    if (query.dateFrom) {
      conditions.push(gte(payments.createdAt, query.dateFrom));
    }

    if (query.dateTo) {
      conditions.push(lte(payments.createdAt, query.dateTo));
    }

    const queryBuilder = this.db.select().from(payments);
    const rows =
      conditions.length > 0
        ? await queryBuilder.where(and(...conditions)).orderBy(desc(payments.createdAt))
        : await queryBuilder.orderBy(desc(payments.createdAt));

    return Promise.all(rows.map((payment) => this.loadPaymentMonitoringRecord(payment)));
  }

  async listWebhookEvents(query: {
    failedOnly?: boolean;
    status?: StripeWebhookEventRow["status"];
  }): Promise<StripeWebhookEventRow[]> {
    const conditions = [];

    if (query.failedOnly) {
      conditions.push(eq(stripeWebhookEvents.status, "failed"));
    } else if (query.status) {
      conditions.push(eq(stripeWebhookEvents.status, query.status));
    }

    const queryBuilder = this.db.select().from(stripeWebhookEvents);
    return conditions.length > 0
      ? queryBuilder.where(and(...conditions)).orderBy(desc(stripeWebhookEvents.receivedAt))
      : queryBuilder.orderBy(desc(stripeWebhookEvents.receivedAt));
  }

  async listPendingPlatformFees(): Promise<PlatformAgreementFeeRow[]> {
    return this.db
      .select()
      .from(platformAgreementFees)
      .where(eq(platformAgreementFees.status, "pending_invoice"))
      .orderBy(asc(platformAgreementFees.calculatedAt));
  }

  async listAuditLogsForEntity(entityType: string, entityId: string): Promise<AuditLogRow[]> {
    return this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const [auditLog] = await this.db.insert(auditLogs).values(input).returning();
    return requireReturnedRow(auditLog);
  }

  async transaction<T>(callback: (repo: AdminRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleAdminRepository(tx)));
    }

    return callback(this);
  }

  private async loadVendorReview(vendor: VendorRow): Promise<VendorReviewRecord> {
    const [profileRows, serviceAreas, cuisineLinks, auditRows] = await Promise.all([
      this.db.select().from(vendorProfiles).where(eq(vendorProfiles.vendorId, vendor.id)).limit(1),
      this.db
        .select()
        .from(vendorServiceAreas)
        .where(eq(vendorServiceAreas.vendorId, vendor.id))
        .orderBy(asc(vendorServiceAreas.metroArea), asc(vendorServiceAreas.city)),
      this.db.select().from(vendorCuisines).where(eq(vendorCuisines.vendorId, vendor.id)),
      this.listAuditLogsForEntity("vendor", vendor.id),
    ]);
    const cuisineIds = cuisineLinks.map((link) => link.cuisineId);
    const cuisineRows =
      cuisineIds.length > 0
        ? await this.db.select().from(cuisines).where(inArray(cuisines.id, cuisineIds))
        : [];

    return {
      auditLogs: auditRows,
      cuisines: cuisineRows,
      profile: profileRows[0] ?? null,
      serviceAreas,
      vendor,
    };
  }

  private async loadRfqReview(rfq: RfqRow): Promise<RfqReviewRecord> {
    const [addressRows, requirements, statusHistory, targets, threads, auditRows, quoteRows] =
      await Promise.all([
        rfq.venueAddressId
          ? this.db.select().from(addresses).where(eq(addresses.id, rfq.venueAddressId)).limit(1)
          : [],
        this.db.select().from(rfqRequirements).where(eq(rfqRequirements.rfqId, rfq.id)),
        this.db
          .select()
          .from(rfqStatusHistory)
          .where(eq(rfqStatusHistory.rfqId, rfq.id))
          .orderBy(asc(rfqStatusHistory.createdAt)),
        this.db.select().from(rfqVendorTargets).where(eq(rfqVendorTargets.rfqId, rfq.id)),
        this.db.select().from(messageThreads).where(eq(messageThreads.rfqId, rfq.id)),
        this.listAuditLogsForEntity("rfq", rfq.id),
        this.db.select().from(quotes).where(eq(quotes.rfqId, rfq.id)),
      ]);
    const threadIds = threads.map((thread) => thread.id);
    const [messageRows, agreementRows, paymentRows] = await Promise.all([
      threadIds.length > 0
        ? this.db
            .select()
            .from(messages)
            .where(inArray(messages.threadId, threadIds))
            .orderBy(asc(messages.createdAt))
        : [],
      this.db.select().from(agreements).where(eq(agreements.rfqId, rfq.id)),
      this.db.select().from(payments).where(eq(payments.rfqId, rfq.id)),
    ]);

    return {
      address: addressRows[0] ?? null,
      agreements: agreementRows,
      auditLogs: auditRows,
      messages: messageRows,
      payments: paymentRows,
      quotes: quoteRows,
      requirements,
      rfq,
      statusHistory,
      targets,
      threads,
    };
  }

  private async loadPaymentMonitoringRecord(payment: PaymentRow): Promise<PaymentMonitoringRecord> {
    const [attemptRows, vendorRows, rfqRows] = await Promise.all([
      this.db
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.paymentId, payment.id))
        .orderBy(asc(paymentAttempts.attemptedAt)),
      this.db.select().from(vendors).where(eq(vendors.id, payment.vendorId)).limit(1),
      this.db.select().from(rfqs).where(eq(rfqs.id, payment.rfqId)).limit(1),
    ]);

    return {
      attempts: attemptRows,
      payment,
      rfq: rfqRows[0] ?? null,
      vendor: vendorRows[0] ?? null,
    };
  }
}

export function createUnavailableAdminRepository(): AdminRepository {
  const unavailable = async () => {
    throw new Error("Admin repository is unavailable because no database client was provided.");
  };

  return {
    createAuditLog: unavailable,
    findRfqReview: unavailable,
    findVendorReview: unavailable,
    listAuditLogsForEntity: unavailable,
    listPaymentRecords: unavailable,
    listPendingPlatformFees: unavailable,
    listRfqReviews: unavailable,
    listVendorReviews: unavailable,
    listWebhookEvents: unavailable,
    transaction: unavailable,
    updateVendorState: unavailable,
  };
}
