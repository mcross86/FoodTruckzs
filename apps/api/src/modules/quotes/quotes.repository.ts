import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  auditLogs,
  outboxEvents,
  paymentScheduleItems,
  quoteLineItems,
  quoteRevisions,
  quotes,
  rfqs,
  rfqStatusHistory,
  rfqVendorTargets,
  vendors,
} from "../../db/schema/index.js";
import type { RfqStatus } from "../rfqs/rfq-state-machine.js";

type QuoteDb = Database | Transaction;
type AuditLogRow = typeof auditLogs.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type PaymentScheduleItemRow = typeof paymentScheduleItems.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;
type QuoteLineItemRow = typeof quoteLineItems.$inferSelect;
type QuoteRevisionRow = typeof quoteRevisions.$inferSelect;
type RfqRow = typeof rfqs.$inferSelect;
type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;
type RfqTargetRow = typeof rfqVendorTargets.$inferSelect;
type VendorRow = typeof vendors.$inferSelect;

export type QuoteRevisionBundle = {
  lineItems: QuoteLineItemRow[];
  paymentScheduleItems: PaymentScheduleItemRow[];
  revision: QuoteRevisionRow;
};

export type QuoteDetailRecord = {
  currentRevision: QuoteRevisionBundle | null;
  quote: QuoteRow;
  revisions: QuoteRevisionBundle[];
  rfq: RfqRow;
  target: RfqTargetRow | null;
  vendor: VendorRow;
};

export type QuoteRfqTargetRecord = {
  rfq: RfqRow;
  target: RfqTargetRow;
  vendor: VendorRow;
};

export type QuoteRepository = {
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  createLineItems: (inputs: (typeof quoteLineItems.$inferInsert)[]) => Promise<QuoteLineItemRow[]>;
  createOutboxEvent: (input: typeof outboxEvents.$inferInsert) => Promise<OutboxEventRow>;
  createPaymentScheduleItems: (
    inputs: (typeof paymentScheduleItems.$inferInsert)[],
  ) => Promise<PaymentScheduleItemRow[]>;
  createQuote: (input: typeof quotes.$inferInsert) => Promise<QuoteRow>;
  createRevision: (input: typeof quoteRevisions.$inferInsert) => Promise<QuoteRevisionRow>;
  createStatusHistory: (
    input: typeof rfqStatusHistory.$inferInsert,
  ) => Promise<RfqStatusHistoryRow>;
  findQuoteById: (quoteId: string) => Promise<QuoteDetailRecord | null>;
  findQuoteByRfqVendor: (rfqId: string, vendorId: string) => Promise<QuoteDetailRecord | null>;
  findRfqTargetForVendor: (rfqId: string, vendorId: string) => Promise<QuoteRfqTargetRecord | null>;
  listQuotesForRfq: (rfqId: string) => Promise<QuoteDetailRecord[]>;
  transaction: <T>(callback: (repo: QuoteRepository) => Promise<T>) => Promise<T>;
  updateCompetingQuotesNotSelected: (
    rfqId: string,
    acceptedQuoteId: string,
    updatedAt: Date,
  ) => Promise<void>;
  updateQuote: (
    quoteId: string,
    input: Partial<
      Pick<
        QuoteRow,
        | "currentRevisionId"
        | "depositRequiredCents"
        | "expiresAt"
        | "feesCents"
        | "status"
        | "subtotalCents"
        | "taxCents"
        | "totalCents"
      >
    >,
    updatedAt: Date,
  ) => Promise<QuoteRow | null>;
  updateRfqStatus: (rfqId: string, status: RfqStatus, updatedAt: Date) => Promise<RfqRow | null>;
  updateVendorTarget: (
    targetId: string,
    input: Partial<Pick<RfqTargetRow, "respondedAt" | "status">>,
    updatedAt: Date,
  ) => Promise<RfqTargetRow | null>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

export class DrizzleQuoteRepository implements QuoteRepository {
  constructor(private readonly db: QuoteDb) {}

  async createQuote(input: typeof quotes.$inferInsert): Promise<QuoteRow> {
    const [quote] = await this.db.insert(quotes).values(input).returning();
    return requireReturnedRow(quote);
  }

  async createRevision(input: typeof quoteRevisions.$inferInsert): Promise<QuoteRevisionRow> {
    const [revision] = await this.db.insert(quoteRevisions).values(input).returning();
    return requireReturnedRow(revision);
  }

  async createLineItems(
    inputs: (typeof quoteLineItems.$inferInsert)[],
  ): Promise<QuoteLineItemRow[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.db.insert(quoteLineItems).values(inputs).returning();
  }

  async createPaymentScheduleItems(
    inputs: (typeof paymentScheduleItems.$inferInsert)[],
  ): Promise<PaymentScheduleItemRow[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.db.insert(paymentScheduleItems).values(inputs).returning();
  }

  async updateQuote(
    quoteId: string,
    input: Partial<
      Pick<
        QuoteRow,
        | "currentRevisionId"
        | "depositRequiredCents"
        | "expiresAt"
        | "feesCents"
        | "status"
        | "subtotalCents"
        | "taxCents"
        | "totalCents"
      >
    >,
    updatedAt: Date,
  ): Promise<QuoteRow | null> {
    const [quote] = await this.db
      .update(quotes)
      .set({ ...input, updatedAt })
      .where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt)))
      .returning();

    return quote ?? null;
  }

  async updateCompetingQuotesNotSelected(
    rfqId: string,
    acceptedQuoteId: string,
    updatedAt: Date,
  ): Promise<void> {
    await this.db
      .update(quotes)
      .set({ status: "not_selected", updatedAt })
      .where(
        and(
          eq(quotes.rfqId, rfqId),
          ne(quotes.id, acceptedQuoteId),
          isNull(quotes.deletedAt),
          ne(quotes.status, "cancelled"),
        ),
      );
  }

  async updateRfqStatus(rfqId: string, status: RfqStatus, updatedAt: Date): Promise<RfqRow | null> {
    const [rfq] = await this.db
      .update(rfqs)
      .set({ status, updatedAt })
      .where(and(eq(rfqs.id, rfqId), isNull(rfqs.deletedAt)))
      .returning();

    return rfq ?? null;
  }

  async updateVendorTarget(
    targetId: string,
    input: Partial<Pick<RfqTargetRow, "respondedAt" | "status">>,
    updatedAt: Date,
  ): Promise<RfqTargetRow | null> {
    const [target] = await this.db
      .update(rfqVendorTargets)
      .set({ ...input, updatedAt })
      .where(eq(rfqVendorTargets.id, targetId))
      .returning();

    return target ?? null;
  }

  async createStatusHistory(
    input: typeof rfqStatusHistory.$inferInsert,
  ): Promise<RfqStatusHistoryRow> {
    const [history] = await this.db.insert(rfqStatusHistory).values(input).returning();
    return requireReturnedRow(history);
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const [auditLog] = await this.db.insert(auditLogs).values(input).returning();
    return requireReturnedRow(auditLog);
  }

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    const [event] = await this.db.insert(outboxEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async findRfqTargetForVendor(
    rfqId: string,
    vendorId: string,
  ): Promise<QuoteRfqTargetRecord | null> {
    const [row] = await this.db
      .select({
        rfq: rfqs,
        target: rfqVendorTargets,
        vendor: vendors,
      })
      .from(rfqVendorTargets)
      .innerJoin(rfqs, eq(rfqVendorTargets.rfqId, rfqs.id))
      .innerJoin(vendors, eq(rfqVendorTargets.vendorId, vendors.id))
      .where(
        and(
          eq(rfqVendorTargets.rfqId, rfqId),
          eq(rfqVendorTargets.vendorId, vendorId),
          isNull(rfqs.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async findQuoteById(quoteId: string): Promise<QuoteDetailRecord | null> {
    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt)))
      .limit(1);

    return quote ? this.loadDetail(quote) : null;
  }

  async findQuoteByRfqVendor(rfqId: string, vendorId: string): Promise<QuoteDetailRecord | null> {
    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.rfqId, rfqId), eq(quotes.vendorId, vendorId), isNull(quotes.deletedAt)))
      .limit(1);

    return quote ? this.loadDetail(quote) : null;
  }

  async listQuotesForRfq(rfqId: string): Promise<QuoteDetailRecord[]> {
    const quoteRows = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.rfqId, rfqId), isNull(quotes.deletedAt)))
      .orderBy(asc(quotes.createdAt));

    const records = await Promise.all(quoteRows.map((quote) => this.loadDetail(quote)));
    return records.filter((record): record is QuoteDetailRecord => record !== null);
  }

  async transaction<T>(callback: (repo: QuoteRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleQuoteRepository(tx)));
    }

    return callback(this);
  }

  private async loadDetail(quote: QuoteRow): Promise<QuoteDetailRecord | null> {
    const [rfqRows, vendorRows, targetRows, revisionRows] = await Promise.all([
      this.db
        .select()
        .from(rfqs)
        .where(and(eq(rfqs.id, quote.rfqId), isNull(rfqs.deletedAt)))
        .limit(1),
      this.db.select().from(vendors).where(eq(vendors.id, quote.vendorId)).limit(1),
      this.db
        .select()
        .from(rfqVendorTargets)
        .where(
          and(
            eq(rfqVendorTargets.rfqId, quote.rfqId),
            eq(rfqVendorTargets.vendorId, quote.vendorId),
          ),
        )
        .limit(1),
      this.db
        .select()
        .from(quoteRevisions)
        .where(eq(quoteRevisions.quoteId, quote.id))
        .orderBy(asc(quoteRevisions.revisionNumber)),
    ]);
    const rfq = rfqRows[0];
    const vendor = vendorRows[0];

    if (!rfq || !vendor) {
      return null;
    }

    const revisionIds = revisionRows.map((revision) => revision.id);
    const [lineItemRows, scheduleRows] =
      revisionIds.length > 0
        ? await Promise.all([
            this.db
              .select()
              .from(quoteLineItems)
              .where(inArray(quoteLineItems.quoteRevisionId, revisionIds))
              .orderBy(asc(quoteLineItems.sortOrder), asc(quoteLineItems.createdAt)),
            this.db
              .select()
              .from(paymentScheduleItems)
              .where(inArray(paymentScheduleItems.quoteRevisionId, revisionIds))
              .orderBy(asc(paymentScheduleItems.sortOrder), asc(paymentScheduleItems.createdAt)),
          ])
        : [[], []];
    const revisions = revisionRows.map((revision) => ({
      lineItems: lineItemRows.filter((lineItem) => lineItem.quoteRevisionId === revision.id),
      paymentScheduleItems: scheduleRows.filter(
        (scheduleItem) => scheduleItem.quoteRevisionId === revision.id,
      ),
      revision,
    }));

    return {
      currentRevision:
        revisions.find((revision) => revision.revision.id === quote.currentRevisionId) ?? null,
      quote,
      revisions,
      rfq,
      target: targetRows[0] ?? null,
      vendor,
    };
  }
}

export function createUnavailableQuoteRepository(): QuoteRepository {
  const unavailable = async () => {
    throw new Error("Quote repository is unavailable because no database client was provided.");
  };

  return {
    createAuditLog: unavailable,
    createLineItems: unavailable,
    createOutboxEvent: unavailable,
    createPaymentScheduleItems: unavailable,
    createQuote: unavailable,
    createRevision: unavailable,
    createStatusHistory: unavailable,
    findQuoteById: unavailable,
    findQuoteByRfqVendor: unavailable,
    findRfqTargetForVendor: unavailable,
    listQuotesForRfq: unavailable,
    transaction: unavailable,
    updateCompetingQuotesNotSelected: unavailable,
    updateQuote: unavailable,
    updateRfqStatus: unavailable,
    updateVendorTarget: unavailable,
  };
}
