import { randomUUID } from "node:crypto";

import type {
  agreements,
  agreementSignatures,
  agreementVersions,
  files,
  platformAgreementFees,
} from "../../db/schema/index.js";
import type {
  AgreementDetailRecord,
  AgreementQuoteSourceRecord,
  AgreementRepository,
} from "../../modules/agreements/agreements.repository.js";
import type { RfqStatus } from "../../modules/rfqs/rfq-state-machine.js";
import type { InMemoryQuoteRepository } from "./in-memory-quote-repository.js";
import type { InMemoryRfqRepository } from "./in-memory-rfq-repository.js";
import type { InMemoryVendorRepository } from "./in-memory-vendor-repository.js";

type AgreementRow = typeof agreements.$inferSelect;
type AgreementSignatureRow = typeof agreementSignatures.$inferSelect;
type AgreementVersionRow = typeof agreementVersions.$inferSelect;
type FileRow = typeof files.$inferSelect;
type PlatformAgreementFeeRow = typeof platformAgreementFees.$inferSelect;

function now(): Date {
  return new Date();
}

export class InMemoryAgreementRepository implements AgreementRepository {
  readonly agreements = new Map<string, AgreementRow>();
  readonly files = new Map<string, FileRow>();
  readonly platformAgreementFees = new Map<string, PlatformAgreementFeeRow>();
  readonly signatures = new Map<string, AgreementSignatureRow>();
  readonly versions = new Map<string, AgreementVersionRow>();

  constructor(
    private readonly quoteRepository: InMemoryQuoteRepository,
    private readonly rfqRepository: InMemoryRfqRepository,
    private readonly vendorRepository: InMemoryVendorRepository,
  ) {}

  async createAgreement(input: typeof agreements.$inferInsert): Promise<AgreementRow> {
    const createdAt = now();
    const agreement: AgreementRow = {
      createdAt,
      currentVersionId: input.currentVersionId ?? null,
      customerUserId: input.customerUserId,
      deletedAt: null,
      documentFileId: input.documentFileId ?? null,
      generatedAt: input.generatedAt ?? null,
      id: randomUUID(),
      quoteId: input.quoteId,
      quoteRevisionId: input.quoteRevisionId,
      rfqId: input.rfqId,
      signedAt: input.signedAt ?? null,
      signedDocumentFileId: input.signedDocumentFileId ?? null,
      status: input.status ?? "draft",
      updatedAt: createdAt,
      vendorId: input.vendorId,
    };
    this.agreements.set(agreement.id, agreement);
    return agreement;
  }

  async createVersion(input: typeof agreementVersions.$inferInsert): Promise<AgreementVersionRow> {
    const version: AgreementVersionRow = {
      agreementId: input.agreementId,
      createdAt: now(),
      createdByUserId: input.createdByUserId ?? null,
      documentFileId: input.documentFileId ?? null,
      id: randomUUID(),
      termsSnapshot: input.termsSnapshot ?? {},
      versionNumber: input.versionNumber,
    };
    this.versions.set(version.id, version);
    return version;
  }

  async updateVersionDocumentFile(
    versionId: string,
    documentFileId: string,
  ): Promise<AgreementVersionRow | null> {
    const version = this.versions.get(versionId);

    if (!version) {
      return null;
    }

    const updatedVersion = { ...version, documentFileId };
    this.versions.set(versionId, updatedVersion);
    return updatedVersion;
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
    const agreement = this.agreements.get(agreementId);

    if (!agreement || agreement.deletedAt !== null) {
      return null;
    }

    const updatedAgreement = { ...agreement, ...input, updatedAt };
    this.agreements.set(agreementId, updatedAgreement);
    return updatedAgreement;
  }

  async updatePaymentScheduleAgreement(
    quoteRevisionId: string,
    agreementId: string,
    updatedAt: Date,
  ): Promise<void> {
    for (const item of this.quoteRepository.paymentScheduleItems.values()) {
      if (item.quoteRevisionId === quoteRevisionId) {
        this.quoteRepository.paymentScheduleItems.set(item.id, { ...item, agreementId, updatedAt });
      }
    }
  }

  async createSignature(
    input: typeof agreementSignatures.$inferInsert,
  ): Promise<AgreementSignatureRow> {
    const signature: AgreementSignatureRow = {
      agreementId: input.agreementId,
      agreementVersionId: input.agreementVersionId,
      id: randomUUID(),
      signatureMetadata: input.signatureMetadata ?? {},
      signedAt: input.signedAt ?? now(),
      signedDocumentFileId: input.signedDocumentFileId ?? null,
      signerRole: input.signerRole,
      signerUserId: input.signerUserId,
      typedName: input.typedName,
    };
    this.signatures.set(signature.id, signature);
    return signature;
  }

  async createFile(input: typeof files.$inferInsert): Promise<FileRow> {
    const createdAt = now();
    const file: FileRow = {
      bucket: input.bucket,
      checksum: input.checksum ?? null,
      contentType: input.contentType,
      createdAt,
      deletedAt: null,
      id: randomUUID(),
      metadata: input.metadata ?? {},
      objectKey: input.objectKey,
      ownerUserId: input.ownerUserId ?? null,
      sizeBytes: input.sizeBytes,
      status: input.status ?? "pending",
      storageProvider: input.storageProvider,
      updatedAt: createdAt,
      vendorId: input.vendorId ?? null,
      visibility: input.visibility ?? "private",
    };
    this.files.set(file.id, file);
    return file;
  }

  async createAuditLog(input: Parameters<AgreementRepository["createAuditLog"]>[0]) {
    return this.rfqRepository.createAuditLog(input);
  }

  async createOutboxEvent(input: Parameters<AgreementRepository["createOutboxEvent"]>[0]) {
    return this.rfqRepository.createOutboxEvent(input);
  }

  async createStatusHistory(input: Parameters<AgreementRepository["createStatusHistory"]>[0]) {
    return this.rfqRepository.createStatusHistory(input);
  }

  async updateRfqStatus(rfqId: string, status: RfqStatus, updatedAt: Date) {
    return this.rfqRepository.updateRfqStatus(rfqId, status, updatedAt);
  }

  async createPlatformAgreementFee(
    input: typeof platformAgreementFees.$inferInsert,
  ): Promise<PlatformAgreementFeeRow> {
    const createdAt = now();
    const fee: PlatformAgreementFeeRow = {
      agreementId: input.agreementId,
      calculatedAt: input.calculatedAt ?? createdAt,
      createdAt,
      currency: input.currency ?? "usd",
      feeAmountCents: input.feeAmountCents,
      feePercentageBasisPoints: input.feePercentageBasisPoints,
      id: randomUUID(),
      signedAgreementTotalCents: input.signedAgreementTotalCents,
      status: input.status ?? "pending_invoice",
      vendorId: input.vendorId,
      vendorInvoiceId: input.vendorInvoiceId ?? null,
    };
    this.platformAgreementFees.set(fee.id, fee);
    return fee;
  }

  async findPlatformAgreementFeeByAgreementId(
    agreementId: string,
  ): Promise<PlatformAgreementFeeRow | null> {
    return (
      [...this.platformAgreementFees.values()].find((fee) => fee.agreementId === agreementId) ??
      null
    );
  }

  async findBillingSettingsByVendorId(vendorId: string) {
    return this.vendorRepository.billingSettings.get(vendorId) ?? null;
  }

  async findAcceptedQuoteSourceByQuoteId(
    quoteId: string,
  ): Promise<AgreementQuoteSourceRecord | null> {
    const quote = this.quoteRepository.quotes.get(quoteId);

    if (
      !quote ||
      quote.deletedAt !== null ||
      quote.status !== "accepted" ||
      !quote.currentRevisionId
    ) {
      return null;
    }

    const revision = this.quoteRepository.revisions.get(quote.currentRevisionId);

    if (!revision) {
      return null;
    }

    return this.loadQuoteSource(quote, revision);
  }

  async findAgreementById(agreementId: string): Promise<AgreementDetailRecord | null> {
    const agreement = this.agreements.get(agreementId);
    return agreement && agreement.deletedAt === null ? this.loadAgreementDetail(agreement) : null;
  }

  async findAgreementByQuoteRevisionId(
    quoteRevisionId: string,
  ): Promise<AgreementDetailRecord | null> {
    const agreement = [...this.agreements.values()].find(
      (candidate) => candidate.quoteRevisionId === quoteRevisionId && candidate.deletedAt === null,
    );
    return agreement ? this.loadAgreementDetail(agreement) : null;
  }

  async transaction<T>(callback: (repo: AgreementRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private loadQuoteSource(
    quote: AgreementQuoteSourceRecord["quote"],
    revision: AgreementQuoteSourceRecord["revision"],
  ): AgreementQuoteSourceRecord | null {
    const rfq = this.rfqRepository.rfqs.get(quote.rfqId);
    const vendor = this.vendorRepository.vendors.get(quote.vendorId);

    if (!rfq || !vendor) {
      return null;
    }

    return {
      address: rfq.venueAddressId
        ? (this.rfqRepository.addresses.get(rfq.venueAddressId) ?? null)
        : null,
      lineItems: [...this.quoteRepository.lineItems.values()]
        .filter((lineItem) => lineItem.quoteRevisionId === revision.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      paymentScheduleItems: [...this.quoteRepository.paymentScheduleItems.values()]
        .filter((item) => item.quoteRevisionId === revision.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      quote,
      requirements: [...this.rfqRepository.requirements.values()]
        .filter((requirement) => requirement.rfqId === rfq.id)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
      revision,
      rfq,
      vendor,
    };
  }

  private loadAgreementDetail(agreement: AgreementRow): AgreementDetailRecord | null {
    const quote = this.quoteRepository.quotes.get(agreement.quoteId);
    const revision = this.quoteRepository.revisions.get(agreement.quoteRevisionId);

    if (!quote || !revision) {
      return null;
    }

    const source = this.loadQuoteSource(quote, revision);

    if (!source) {
      return null;
    }

    const versions = [...this.versions.values()]
      .filter((version) => version.agreementId === agreement.id)
      .sort((left, right) => left.versionNumber - right.versionNumber);

    return {
      address: source.address,
      agreement,
      currentVersion: versions.find((version) => version.id === agreement.currentVersionId) ?? null,
      lineItems: source.lineItems,
      paymentScheduleItems: source.paymentScheduleItems,
      platformFee:
        [...this.platformAgreementFees.values()].find((fee) => fee.agreementId === agreement.id) ??
        null,
      quote,
      quoteRevision: revision,
      requirements: source.requirements,
      rfq: source.rfq,
      signatures: [...this.signatures.values()]
        .filter((signature) => signature.agreementId === agreement.id)
        .sort((left, right) => left.signedAt.getTime() - right.signedAt.getTime()),
      vendor: source.vendor,
      versions,
    };
  }
}
