import { and, asc, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  addresses,
  agreements,
  agreementSignatures,
  agreementVersions,
  auditLogs,
  files,
  outboxEvents,
  paymentScheduleItems,
  platformAgreementFees,
  quoteLineItems,
  quoteRevisions,
  quotes,
  rfqs,
  rfqRequirements,
  rfqStatusHistory,
  vendorBillingSettings,
  vendors,
} from "../../db/schema/index.js";
import type { RfqStatus } from "../rfqs/rfq-state-machine.js";

type AgreementDb = Database | Transaction;
type AddressRow = typeof addresses.$inferSelect;
type AgreementRow = typeof agreements.$inferSelect;
type AgreementSignatureRow = typeof agreementSignatures.$inferSelect;
type AgreementVersionRow = typeof agreementVersions.$inferSelect;
type AuditLogRow = typeof auditLogs.$inferSelect;
type FileRow = typeof files.$inferSelect;
type OutboxEventRow = typeof outboxEvents.$inferSelect;
type PaymentScheduleItemRow = typeof paymentScheduleItems.$inferSelect;
type PlatformAgreementFeeRow = typeof platformAgreementFees.$inferSelect;
type QuoteLineItemRow = typeof quoteLineItems.$inferSelect;
type QuoteRevisionRow = typeof quoteRevisions.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;
type RfqRequirementRow = typeof rfqRequirements.$inferSelect;
type RfqRow = typeof rfqs.$inferSelect;
type RfqStatusHistoryRow = typeof rfqStatusHistory.$inferSelect;
type VendorBillingSettingsRow = typeof vendorBillingSettings.$inferSelect;
type VendorRow = typeof vendors.$inferSelect;

export type AgreementQuoteSourceRecord = {
  address: AddressRow | null;
  lineItems: QuoteLineItemRow[];
  paymentScheduleItems: PaymentScheduleItemRow[];
  quote: QuoteRow;
  requirements: RfqRequirementRow[];
  revision: QuoteRevisionRow;
  rfq: RfqRow;
  vendor: VendorRow;
};

export type AgreementDetailRecord = {
  address: AddressRow | null;
  agreement: AgreementRow;
  currentVersion: AgreementVersionRow | null;
  lineItems: QuoteLineItemRow[];
  paymentScheduleItems: PaymentScheduleItemRow[];
  platformFee: PlatformAgreementFeeRow | null;
  quote: QuoteRow;
  quoteRevision: QuoteRevisionRow;
  requirements: RfqRequirementRow[];
  rfq: RfqRow;
  signatures: AgreementSignatureRow[];
  vendor: VendorRow;
  versions: AgreementVersionRow[];
};

export type AgreementRepository = {
  createAgreement: (input: typeof agreements.$inferInsert) => Promise<AgreementRow>;
  createAuditLog: (input: typeof auditLogs.$inferInsert) => Promise<AuditLogRow>;
  createFile: (input: typeof files.$inferInsert) => Promise<FileRow>;
  createOutboxEvent: (input: typeof outboxEvents.$inferInsert) => Promise<OutboxEventRow>;
  createPlatformAgreementFee: (
    input: typeof platformAgreementFees.$inferInsert,
  ) => Promise<PlatformAgreementFeeRow>;
  createSignature: (
    input: typeof agreementSignatures.$inferInsert,
  ) => Promise<AgreementSignatureRow>;
  createStatusHistory: (
    input: typeof rfqStatusHistory.$inferInsert,
  ) => Promise<RfqStatusHistoryRow>;
  createVersion: (input: typeof agreementVersions.$inferInsert) => Promise<AgreementVersionRow>;
  findAcceptedQuoteSourceByQuoteId: (quoteId: string) => Promise<AgreementQuoteSourceRecord | null>;
  findAgreementById: (agreementId: string) => Promise<AgreementDetailRecord | null>;
  findAgreementByQuoteRevisionId: (
    quoteRevisionId: string,
  ) => Promise<AgreementDetailRecord | null>;
  findBillingSettingsByVendorId: (vendorId: string) => Promise<VendorBillingSettingsRow | null>;
  findPlatformAgreementFeeByAgreementId: (
    agreementId: string,
  ) => Promise<PlatformAgreementFeeRow | null>;
  transaction: <T>(callback: (repo: AgreementRepository) => Promise<T>) => Promise<T>;
  updateAgreement: (
    agreementId: string,
    input: Partial<
      Pick<
        AgreementRow,
        | "currentVersionId"
        | "documentFileId"
        | "generatedAt"
        | "signedAt"
        | "signedDocumentFileId"
        | "status"
      >
    >,
    updatedAt: Date,
  ) => Promise<AgreementRow | null>;
  updatePaymentScheduleAgreement: (
    quoteRevisionId: string,
    agreementId: string,
    updatedAt: Date,
  ) => Promise<void>;
  updateRfqStatus: (rfqId: string, status: RfqStatus, updatedAt: Date) => Promise<RfqRow | null>;
  updateVersionDocumentFile: (
    versionId: string,
    documentFileId: string,
  ) => Promise<AgreementVersionRow | null>;
};

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

export class DrizzleAgreementRepository implements AgreementRepository {
  constructor(private readonly db: AgreementDb) {}

  async createAgreement(input: typeof agreements.$inferInsert): Promise<AgreementRow> {
    const [agreement] = await this.db.insert(agreements).values(input).returning();
    return requireReturnedRow(agreement);
  }

  async createVersion(input: typeof agreementVersions.$inferInsert): Promise<AgreementVersionRow> {
    const [version] = await this.db.insert(agreementVersions).values(input).returning();
    return requireReturnedRow(version);
  }

  async updateVersionDocumentFile(
    versionId: string,
    documentFileId: string,
  ): Promise<AgreementVersionRow | null> {
    const [version] = await this.db
      .update(agreementVersions)
      .set({ documentFileId })
      .where(eq(agreementVersions.id, versionId))
      .returning();

    return version ?? null;
  }

  async updateAgreement(
    agreementId: string,
    input: Partial<
      Pick<
        AgreementRow,
        | "currentVersionId"
        | "documentFileId"
        | "generatedAt"
        | "signedAt"
        | "signedDocumentFileId"
        | "status"
      >
    >,
    updatedAt: Date,
  ): Promise<AgreementRow | null> {
    const [agreement] = await this.db
      .update(agreements)
      .set({ ...input, updatedAt })
      .where(and(eq(agreements.id, agreementId), isNull(agreements.deletedAt)))
      .returning();

    return agreement ?? null;
  }

  async updatePaymentScheduleAgreement(
    quoteRevisionId: string,
    agreementId: string,
    updatedAt: Date,
  ): Promise<void> {
    await this.db
      .update(paymentScheduleItems)
      .set({ agreementId, updatedAt })
      .where(eq(paymentScheduleItems.quoteRevisionId, quoteRevisionId));
  }

  async createSignature(
    input: typeof agreementSignatures.$inferInsert,
  ): Promise<AgreementSignatureRow> {
    const [signature] = await this.db.insert(agreementSignatures).values(input).returning();
    return requireReturnedRow(signature);
  }

  async createFile(input: typeof files.$inferInsert): Promise<FileRow> {
    const [file] = await this.db.insert(files).values(input).returning();
    return requireReturnedRow(file);
  }

  async createAuditLog(input: typeof auditLogs.$inferInsert): Promise<AuditLogRow> {
    const [auditLog] = await this.db.insert(auditLogs).values(input).returning();
    return requireReturnedRow(auditLog);
  }

  async createOutboxEvent(input: typeof outboxEvents.$inferInsert): Promise<OutboxEventRow> {
    const [event] = await this.db.insert(outboxEvents).values(input).returning();
    return requireReturnedRow(event);
  }

  async createStatusHistory(
    input: typeof rfqStatusHistory.$inferInsert,
  ): Promise<RfqStatusHistoryRow> {
    const [history] = await this.db.insert(rfqStatusHistory).values(input).returning();
    return requireReturnedRow(history);
  }

  async updateRfqStatus(rfqId: string, status: RfqStatus, updatedAt: Date): Promise<RfqRow | null> {
    const [rfq] = await this.db
      .update(rfqs)
      .set({ status, updatedAt })
      .where(and(eq(rfqs.id, rfqId), isNull(rfqs.deletedAt)))
      .returning();

    return rfq ?? null;
  }

  async createPlatformAgreementFee(
    input: typeof platformAgreementFees.$inferInsert,
  ): Promise<PlatformAgreementFeeRow> {
    const [fee] = await this.db.insert(platformAgreementFees).values(input).returning();
    return requireReturnedRow(fee);
  }

  async findPlatformAgreementFeeByAgreementId(
    agreementId: string,
  ): Promise<PlatformAgreementFeeRow | null> {
    const [fee] = await this.db
      .select()
      .from(platformAgreementFees)
      .where(eq(platformAgreementFees.agreementId, agreementId))
      .limit(1);

    return fee ?? null;
  }

  async findBillingSettingsByVendorId(vendorId: string): Promise<VendorBillingSettingsRow | null> {
    const [settings] = await this.db
      .select()
      .from(vendorBillingSettings)
      .where(eq(vendorBillingSettings.vendorId, vendorId))
      .limit(1);

    return settings ?? null;
  }

  async findAcceptedQuoteSourceByQuoteId(
    quoteId: string,
  ): Promise<AgreementQuoteSourceRecord | null> {
    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt)))
      .limit(1);

    if (!quote || quote.status !== "accepted" || !quote.currentRevisionId) {
      return null;
    }

    const [revision] = await this.db
      .select()
      .from(quoteRevisions)
      .where(eq(quoteRevisions.id, quote.currentRevisionId))
      .limit(1);

    if (!revision) {
      return null;
    }

    return this.loadQuoteSource(quote, revision);
  }

  async findAgreementById(agreementId: string): Promise<AgreementDetailRecord | null> {
    const [agreement] = await this.db
      .select()
      .from(agreements)
      .where(and(eq(agreements.id, agreementId), isNull(agreements.deletedAt)))
      .limit(1);

    return agreement ? this.loadAgreementDetail(agreement) : null;
  }

  async findAgreementByQuoteRevisionId(
    quoteRevisionId: string,
  ): Promise<AgreementDetailRecord | null> {
    const [agreement] = await this.db
      .select()
      .from(agreements)
      .where(and(eq(agreements.quoteRevisionId, quoteRevisionId), isNull(agreements.deletedAt)))
      .limit(1);

    return agreement ? this.loadAgreementDetail(agreement) : null;
  }

  async transaction<T>(callback: (repo: AgreementRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleAgreementRepository(tx)));
    }

    return callback(this);
  }

  private async loadQuoteSource(
    quote: QuoteRow,
    revision: QuoteRevisionRow,
  ): Promise<AgreementQuoteSourceRecord | null> {
    const [rfqRows, vendorRows, lineItems, scheduleItems, requirements] = await Promise.all([
      this.db
        .select()
        .from(rfqs)
        .where(and(eq(rfqs.id, quote.rfqId), isNull(rfqs.deletedAt)))
        .limit(1),
      this.db.select().from(vendors).where(eq(vendors.id, quote.vendorId)).limit(1),
      this.db
        .select()
        .from(quoteLineItems)
        .where(eq(quoteLineItems.quoteRevisionId, revision.id))
        .orderBy(asc(quoteLineItems.sortOrder), asc(quoteLineItems.createdAt)),
      this.db
        .select()
        .from(paymentScheduleItems)
        .where(eq(paymentScheduleItems.quoteRevisionId, revision.id))
        .orderBy(asc(paymentScheduleItems.sortOrder), asc(paymentScheduleItems.createdAt)),
      this.db
        .select()
        .from(rfqRequirements)
        .where(eq(rfqRequirements.rfqId, quote.rfqId))
        .orderBy(asc(rfqRequirements.createdAt)),
    ]);
    const rfq = rfqRows[0];
    const vendor = vendorRows[0];

    if (!rfq || !vendor) {
      return null;
    }

    const addressRows = rfq.venueAddressId
      ? await this.db.select().from(addresses).where(eq(addresses.id, rfq.venueAddressId)).limit(1)
      : [];

    return {
      address: addressRows[0] ?? null,
      lineItems,
      paymentScheduleItems: scheduleItems,
      quote,
      requirements,
      revision,
      rfq,
      vendor,
    };
  }

  private async loadAgreementDetail(
    agreement: AgreementRow,
  ): Promise<AgreementDetailRecord | null> {
    const [quoteRows, revisionRows, versions, signatures, platformFees] = await Promise.all([
      this.db
        .select()
        .from(quotes)
        .where(and(eq(quotes.id, agreement.quoteId), isNull(quotes.deletedAt)))
        .limit(1),
      this.db
        .select()
        .from(quoteRevisions)
        .where(eq(quoteRevisions.id, agreement.quoteRevisionId))
        .limit(1),
      this.db
        .select()
        .from(agreementVersions)
        .where(eq(agreementVersions.agreementId, agreement.id))
        .orderBy(asc(agreementVersions.versionNumber)),
      this.db
        .select()
        .from(agreementSignatures)
        .where(eq(agreementSignatures.agreementId, agreement.id))
        .orderBy(asc(agreementSignatures.signedAt)),
      this.db
        .select()
        .from(platformAgreementFees)
        .where(eq(platformAgreementFees.agreementId, agreement.id))
        .limit(1),
    ]);
    const quote = quoteRows[0];
    const revision = revisionRows[0];

    if (!quote || !revision) {
      return null;
    }

    const source = await this.loadQuoteSource(quote, revision);

    if (!source) {
      return null;
    }

    return {
      address: source.address,
      agreement,
      currentVersion: versions.find((version) => version.id === agreement.currentVersionId) ?? null,
      lineItems: source.lineItems,
      paymentScheduleItems: source.paymentScheduleItems,
      platformFee: platformFees[0] ?? null,
      quote,
      quoteRevision: revision,
      requirements: source.requirements,
      rfq: source.rfq,
      signatures,
      vendor: source.vendor,
      versions,
    };
  }
}

export function createUnavailableAgreementRepository(): AgreementRepository {
  const unavailable = async () => {
    throw new Error("Agreement repository is unavailable because no database client was provided.");
  };

  return {
    createAgreement: unavailable,
    createAuditLog: unavailable,
    createFile: unavailable,
    createOutboxEvent: unavailable,
    createPlatformAgreementFee: unavailable,
    createSignature: unavailable,
    createStatusHistory: unavailable,
    createVersion: unavailable,
    findAcceptedQuoteSourceByQuoteId: unavailable,
    findAgreementById: unavailable,
    findAgreementByQuoteRevisionId: unavailable,
    findBillingSettingsByVendorId: unavailable,
    findPlatformAgreementFeeByAgreementId: unavailable,
    transaction: unavailable,
    updateAgreement: unavailable,
    updatePaymentScheduleAgreement: unavailable,
    updateRfqStatus: unavailable,
    updateVersionDocumentFile: unavailable,
  };
}
