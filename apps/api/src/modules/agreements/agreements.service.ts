import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import { calculateAgreementFeeCents } from "../billing/billing-calculation.js";
import { assertRfqTransition, type RfqStatus } from "../rfqs/rfq-state-machine.js";
import type { StorageService } from "../storage/storage.service.js";
import type { SignAgreementDto } from "./agreements.dto.js";
import type {
  AgreementDetailRecord,
  AgreementQuoteSourceRecord,
  AgreementRepository,
} from "./agreements.repository.js";

type AgreementVersionResult = {
  createdAt: Date;
  documentFileId: string | null;
  id: string;
  termsSnapshot: Record<string, unknown>;
  versionNumber: number;
};

type AgreementSignatureResult = {
  id: string;
  signedAt: Date;
  signedDocumentFileId: string | null;
  signerRole: string;
  signerUserId: string;
  typedName: string;
};

export type AgreementServiceResult = {
  agreement: {
    currentVersionId: string | null;
    documentFileId: string | null;
    generatedAt: Date | null;
    id: string;
    rfqId: string;
    signedAt: Date | null;
    signedDocumentFileId: string | null;
    status: string;
    vendorId: string;
  };
  currentVersion: AgreementVersionResult | null;
  nextPaymentAction: {
    amountCents: number;
    dueAt: Date | null;
    label: string;
    paymentScheduleItemId: string;
    type: "deposit_required" | "payment_collection_deferred";
  } | null;
  platformFee: {
    feeAmountCents: number;
    feePercentageBasisPoints: number;
    id: string;
    status: string;
  } | null;
  quote: {
    id: string;
    revisionId: string;
    revisionNumber: number;
    totalCents: number;
  };
  rfq: {
    customerUserId: string;
    eventName: string;
    id: string;
    status: RfqStatus;
  };
  signatures: AgreementSignatureResult[];
  vendor: {
    businessName: string;
    id: string;
    slug: string;
  };
  versions: AgreementVersionResult[];
};

export type AgreementDownloadUrlResult = {
  agreementId: string;
  downloadUrl: string;
  expiresAt: Date;
  fileId: string | null;
  storageProvider: string;
};

export type AgreementService = {
  ensureDraftForAcceptedQuote: (
    ctx: RequestContext,
    quoteId: string,
  ) => Promise<AgreementServiceResult>;
  generateVersion: (ctx: RequestContext, agreementId: string) => Promise<AgreementServiceResult>;
  getAgreement: (ctx: RequestContext, agreementId: string) => Promise<AgreementServiceResult>;
  getAgreementForQuoteRevision: (
    ctx: RequestContext,
    quoteRevisionId: string,
  ) => Promise<AgreementServiceResult | null>;
  getDownloadUrl: (ctx: RequestContext, agreementId: string) => Promise<AgreementDownloadUrlResult>;
  signAgreement: (
    ctx: RequestContext,
    agreementId: string,
    input: SignAgreementDto,
  ) => Promise<AgreementServiceResult>;
};

export type AgreementServiceDeps = {
  repository: AgreementRepository;
  storageService?: StorageService;
};

function now(): Date {
  return new Date();
}

function isAdmin(ctx: RequestContext): boolean {
  return ctx.globalRoles.includes("platform_admin") || ctx.globalRoles.includes("support_admin");
}

function vendorCanRead(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) => membership.vendorId === vendorId && membership.status === "active",
  );
}

function vendorCanManage(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) =>
      membership.vendorId === vendorId &&
      membership.status === "active" &&
      (membership.role === "owner" || membership.role === "manager"),
  );
}

function assertCanRead(ctx: RequestContext, record: AgreementDetailRecord): void {
  if (
    isAdmin(ctx) ||
    record.rfq.customerUserId === ctx.userId ||
    vendorCanRead(ctx, record.vendor.id)
  ) {
    return;
  }

  throw new AuthorizationError("You are not authorized to view this agreement.");
}

function assertCanGenerateVersion(ctx: RequestContext, record: AgreementDetailRecord): void {
  if (isAdmin(ctx) || vendorCanManage(ctx, record.vendor.id)) {
    return;
  }

  throw new AuthorizationError(
    "Vendor owner or manager access is required to generate agreement versions.",
  );
}

function assertCanSignAsCustomer(ctx: RequestContext, record: AgreementDetailRecord): void {
  if (
    ctx.userId &&
    ctx.userId === record.rfq.customerUserId &&
    ctx.globalRoles.includes("customer")
  ) {
    return;
  }

  throw new AuthorizationError("Only the RFQ customer can sign this agreement.");
}

function sectionsFor(requirements: AgreementQuoteSourceRecord["requirements"]) {
  return Object.fromEntries(
    requirements.map((requirement) => [requirement.label, requirement.details]),
  );
}

function buildAgreementTermsSnapshot(source: AgreementQuoteSourceRecord): Record<string, unknown> {
  const sections = sectionsFor(source.requirements);
  const venue = sections.venue_logistics ?? {};
  const service = sections.service_style ?? {};
  const food = sections.food_requirements ?? {};
  const budget = sections.budget ?? {};
  const visibleLineItems = source.lineItems
    .filter((lineItem) => !lineItem.isInternal)
    .map((lineItem) => ({
      description: lineItem.description,
      isOptional: lineItem.isOptional,
      name: lineItem.name,
      quantity: lineItem.quantity,
      taxable: lineItem.taxable,
      totalAmountCents: lineItem.totalAmountCents,
      type: lineItem.type,
      unit: lineItem.unit,
      unitAmountCents: lineItem.unitAmountCents,
    }));

  return {
    cancellationPolicy: {
      summary:
        source.revision.cancellationPolicySummary ??
        "Cancellation terms are governed by the accepted quote and any written amendments.",
    },
    customerResponsibilities: {
      budgetPreferences: budget,
      responsibilities: [
        "Provide accurate event, guest count, and service timing information.",
        "Ensure vendor access, parking, power/generator permission, permits, and venue approvals described in the RFQ.",
        "Pay required deposit and balances according to the accepted payment schedule.",
        "Communicate material event or menu changes before the vendor's stated deadlines.",
      ],
    },
    eventDetails: {
      address: source.address
        ? {
            city: source.address.city,
            country: source.address.country,
            line1: source.address.line1,
            line2: source.address.line2,
            postalCode: source.address.postalCode,
            state: source.address.state,
          }
        : null,
      endsAt: source.rfq.endsAt.toISOString(),
      estimatedHeadcount: source.rfq.estimatedHeadcount,
      eventName: source.rfq.eventName,
      eventType: source.rfq.eventType,
      indoorOutdoor: source.rfq.indoorOutdoor,
      startsAt: source.rfq.startsAt.toISOString(),
      timezone: source.rfq.timezone,
      venue,
    },
    menuSelections: {
      foodRequirements: food,
      lineItems: visibleLineItems.filter((lineItem) => lineItem.type === "food"),
      menuSummary: source.revision.menuSummary,
      serviceStyle: source.revision.serviceStyle ?? service,
    },
    paymentTerms: {
      depositRequiredCents: source.revision.depositRequiredCents,
      paymentSchedule: source.paymentScheduleItems.map((item) => ({
        amountCents: item.amountCents,
        dueAt: item.dueAt?.toISOString() ?? null,
        id: item.id,
        label: item.label,
        status: item.status,
        type: item.type,
      })),
    },
    pricing: {
      currency: "usd",
      feesCents: source.revision.feesCents,
      lineItems: visibleLineItems,
      subtotalCents: source.revision.subtotalCents,
      taxCents: source.revision.taxCents,
      totalCents: source.revision.totalCents,
    },
    quoteRevision: {
      acceptedQuoteId: source.quote.id,
      quoteRevisionId: source.revision.id,
      revisionNumber: source.revision.revisionNumber,
    },
    vendorRequirements: {
      assumptions: source.revision.assumptions,
      exclusions: source.revision.exclusions,
      venueRequirements: {
        generatorAllowed: (venue as Record<string, unknown>).generatorAllowed,
        parkingNotes: (venue as Record<string, unknown>).parkingNotes,
        permitResponsibility: (venue as Record<string, unknown>).permitResponsibility,
        powerAvailable: (venue as Record<string, unknown>).powerAvailable,
        truckParkingLocation: (venue as Record<string, unknown>).truckParkingLocation,
      },
    },
  };
}

function versionToResult(
  version: AgreementDetailRecord["versions"][number],
): AgreementVersionResult {
  return {
    createdAt: version.createdAt,
    documentFileId: version.documentFileId,
    id: version.id,
    termsSnapshot: version.termsSnapshot,
    versionNumber: version.versionNumber,
  };
}

function nextPaymentActionFor(
  record: AgreementDetailRecord,
): AgreementServiceResult["nextPaymentAction"] {
  if (record.agreement.status !== "signed") {
    return null;
  }

  const dueDeposit = record.paymentScheduleItems.find(
    (item) => item.type === "deposit" && item.status !== "paid" && item.amountCents > 0,
  );

  if (!dueDeposit) {
    return null;
  }

  return {
    amountCents: dueDeposit.amountCents,
    dueAt: dueDeposit.dueAt,
    label: dueDeposit.label,
    paymentScheduleItemId: dueDeposit.id,
    type: "deposit_required",
  };
}

function toResult(record: AgreementDetailRecord): AgreementServiceResult {
  return {
    agreement: {
      currentVersionId: record.agreement.currentVersionId,
      documentFileId: record.agreement.documentFileId,
      generatedAt: record.agreement.generatedAt,
      id: record.agreement.id,
      rfqId: record.agreement.rfqId,
      signedAt: record.agreement.signedAt,
      signedDocumentFileId: record.agreement.signedDocumentFileId,
      status: record.agreement.status,
      vendorId: record.agreement.vendorId,
    },
    currentVersion: record.currentVersion ? versionToResult(record.currentVersion) : null,
    nextPaymentAction: nextPaymentActionFor(record),
    platformFee: record.platformFee
      ? {
          feeAmountCents: record.platformFee.feeAmountCents,
          feePercentageBasisPoints: record.platformFee.feePercentageBasisPoints,
          id: record.platformFee.id,
          status: record.platformFee.status,
        }
      : null,
    quote: {
      id: record.quote.id,
      revisionId: record.quoteRevision.id,
      revisionNumber: record.quoteRevision.revisionNumber,
      totalCents: record.quoteRevision.totalCents,
    },
    rfq: {
      customerUserId: record.rfq.customerUserId,
      eventName: record.rfq.eventName,
      id: record.rfq.id,
      status: record.rfq.status,
    },
    signatures: record.signatures.map((signature) => ({
      id: signature.id,
      signedAt: signature.signedAt,
      signedDocumentFileId: signature.signedDocumentFileId,
      signerRole: signature.signerRole,
      signerUserId: signature.signerUserId,
      typedName: signature.typedName,
    })),
    vendor: {
      businessName: record.vendor.businessName,
      id: record.vendor.id,
      slug: record.vendor.slug,
    },
    versions: record.versions.map(versionToResult),
  };
}

async function reloadAgreement(
  repository: AgreementRepository,
  agreementId: string,
): Promise<AgreementDetailRecord> {
  const record = await repository.findAgreementById(agreementId);

  if (!record) {
    throw new NotFoundError("Agreement was not found.");
  }

  return record;
}

async function transitionRfq(
  repository: AgreementRepository,
  rfqId: string,
  fromStatus: RfqStatus,
  toStatus: RfqStatus,
  ctx: RequestContext,
  reason: string,
): Promise<RfqStatus> {
  if (fromStatus === toStatus) {
    return fromStatus;
  }

  assertRfqTransition(fromStatus, toStatus);
  const changedAt = now();
  await repository.updateRfqStatus(rfqId, toStatus, changedAt);
  await repository.createStatusHistory({
    actorUserId: ctx.userId,
    fromStatus,
    metadata: {},
    reason,
    rfqId,
    toStatus,
  });

  return toStatus;
}

function draftFileInput(
  source: AgreementQuoteSourceRecord,
  agreementId: string,
  versionId: string,
) {
  return {
    bucket: "agreements",
    contentType: "application/json",
    metadata: {
      agreementId,
      documentKind: "agreement_draft",
      quoteRevisionId: source.revision.id,
      versionId,
    },
    objectKey: `agreements/${agreementId}/versions/${versionId}/draft.json`,
    ownerUserId: source.rfq.customerUserId,
    sizeBytes: 1,
    status: "ready" as const,
    storageProvider: "stub",
    vendorId: source.vendor.id,
    visibility: "private" as const,
  };
}

function signedFileInput(record: AgreementDetailRecord, versionId: string) {
  return {
    bucket: "agreements",
    contentType: "application/pdf",
    metadata: {
      agreementId: record.agreement.id,
      documentKind: "signed_agreement_stub",
      quoteRevisionId: record.quoteRevision.id,
      versionId,
    },
    objectKey: `agreements/${record.agreement.id}/versions/${versionId}/signed.pdf`,
    ownerUserId: record.rfq.customerUserId,
    sizeBytes: 1,
    status: "ready" as const,
    storageProvider: "stub",
    vendorId: record.vendor.id,
    visibility: "private" as const,
  };
}

function agreementDraftBody(snapshot: Record<string, unknown>): Buffer {
  return Buffer.from(JSON.stringify(snapshot, null, 2), "utf8");
}

function simplePdfBody(record: AgreementDetailRecord, versionId: string, signedAt: Date): Buffer {
  const title = `foodtruckzs signed agreement ${record.agreement.id}`;
  const text = [
    title,
    `Event: ${record.rfq.eventName}`,
    `Vendor: ${record.vendor.businessName}`,
    `Quote revision: ${record.quoteRevision.revisionNumber}`,
    `Version ID: ${versionId}`,
    `Signed at: ${signedAt.toISOString()}`,
  ]
    .join(" | ")
    .replace(/[()\\]/g, "");

  return Buffer.from(
    `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >> endobj
4 0 obj << /Length ${text.length + 31} >> stream
BT /F1 12 Tf 72 720 Td (${text}) Tj ET
endstream endobj
trailer << /Root 1 0 R >>
%%EOF
`,
    "utf8",
  );
}

async function createDraftVersion(
  repo: AgreementRepository,
  source: AgreementQuoteSourceRecord,
  agreementId: string,
  versionNumber: number,
  ctx: RequestContext,
  storageService?: StorageService,
) {
  const termsSnapshot = buildAgreementTermsSnapshot(source);
  const version = await repo.createVersion({
    agreementId,
    createdByUserId: ctx.userId,
    termsSnapshot,
    versionNumber,
  });
  const documentFile = storageService
    ? await storageService.createSystemFile({
        agreementId,
        body: agreementDraftBody(termsSnapshot),
        contentType: "application/json",
        fileName: `agreement-${agreementId}-version-${versionNumber}.json`,
        metadata: {
          documentKind: "agreement_draft",
          quoteRevisionId: source.revision.id,
          versionId: version.id,
        },
        ownerUserId: source.rfq.customerUserId,
        purpose: "agreement_document",
        vendorId: source.vendor.id,
      })
    : await repo.createFile(draftFileInput(source, agreementId, version.id));
  await repo.updateVersionDocumentFile(version.id, documentFile.id);

  return { documentFile, version };
}

async function createSignedDocumentFile(
  repo: AgreementRepository,
  record: AgreementDetailRecord,
  versionId: string,
  signedAt: Date,
  storageService?: StorageService,
) {
  if (!storageService) {
    return repo.createFile(signedFileInput(record, versionId));
  }

  return storageService.createSystemFile({
    agreementId: record.agreement.id,
    body: simplePdfBody(record, versionId, signedAt),
    contentType: "application/pdf",
    fileName: `signed-agreement-${record.agreement.id}.pdf`,
    metadata: {
      documentKind: "signed_agreement",
      quoteRevisionId: record.quoteRevision.id,
      versionId,
    },
    ownerUserId: record.rfq.customerUserId,
    purpose: "signed_agreement_document",
    vendorId: record.vendor.id,
  });
}

export function createAgreementService(deps: AgreementServiceDeps): AgreementService {
  const { repository, storageService } = deps;

  return {
    async ensureDraftForAcceptedQuote(ctx, quoteId) {
      const record = await repository.transaction(async (repo) => {
        const source = await repo.findAcceptedQuoteSourceByQuoteId(quoteId);

        if (!source) {
          throw new ConflictError("Quote must be accepted before generating an agreement.");
        }

        const existing = await repo.findAgreementByQuoteRevisionId(source.revision.id);

        if (existing) {
          return existing;
        }

        const generatedAt = now();
        const agreement = await repo.createAgreement({
          customerUserId: source.rfq.customerUserId,
          generatedAt,
          quoteId: source.quote.id,
          quoteRevisionId: source.revision.id,
          rfqId: source.rfq.id,
          status: "pending_signature",
          vendorId: source.vendor.id,
        });
        const { documentFile, version } = await createDraftVersion(
          repo,
          source,
          agreement.id,
          1,
          ctx,
          storageService,
        );
        await repo.updateAgreement(
          agreement.id,
          {
            currentVersionId: version.id,
            documentFileId: documentFile.id,
            generatedAt,
            status: "pending_signature",
          },
          generatedAt,
        );
        await repo.updatePaymentScheduleAgreement(source.revision.id, agreement.id, generatedAt);

        if (source.rfq.status === "accepted") {
          await transitionRfq(
            repo,
            source.rfq.id,
            "accepted",
            "agreement_pending",
            ctx,
            "Agreement draft generated.",
          );
        }

        await repo.createAuditLog({
          action: "agreement.generated",
          actorRole: ctx.userId === source.rfq.customerUserId ? "customer" : "system",
          actorUserId: ctx.userId,
          entityId: agreement.id,
          entityType: "agreement",
          newState: { quoteRevisionId: source.revision.id, versionId: version.id },
          previousState: null,
          requestId: ctx.requestId,
          vendorId: source.vendor.id,
        });
        await repo.createOutboxEvent({
          aggregateId: agreement.id,
          aggregateType: "agreement",
          eventType: "agreement.ready",
          payload: {
            agreementId: agreement.id,
            quoteId: source.quote.id,
            quoteRevisionId: source.revision.id,
            rfqId: source.rfq.id,
            vendorId: source.vendor.id,
          },
          requestId: ctx.requestId,
        });

        return reloadAgreement(repo, agreement.id);
      });

      return toResult(record);
    },

    async generateVersion(ctx, agreementId) {
      const record = await repository.transaction(async (repo) => {
        const existing = await reloadAgreement(repo, agreementId);
        assertCanGenerateVersion(ctx, existing);

        if (existing.agreement.status === "signed") {
          throw new ConflictError("Signed agreements are immutable and cannot be regenerated.");
        }

        if (
          existing.agreement.status !== "pending_signature" &&
          existing.agreement.status !== "draft"
        ) {
          throw new ConflictError("Agreement is not open for version generation.", {
            status: existing.agreement.status,
          });
        }

        const source = await repo.findAcceptedQuoteSourceByQuoteId(existing.quote.id);

        if (!source) {
          throw new ConflictError("Accepted quote source was not found for this agreement.");
        }

        const nextVersionNumber =
          Math.max(0, ...existing.versions.map((version) => version.versionNumber)) + 1;
        const generatedAt = now();
        const { documentFile, version } = await createDraftVersion(
          repo,
          source,
          existing.agreement.id,
          nextVersionNumber,
          ctx,
          storageService,
        );
        await repo.updateAgreement(
          existing.agreement.id,
          {
            currentVersionId: version.id,
            documentFileId: documentFile.id,
            generatedAt,
            status: "pending_signature",
          },
          generatedAt,
        );
        await repo.createAuditLog({
          action: "agreement.version_generated",
          actorRole: "vendor_user",
          actorUserId: ctx.userId,
          entityId: existing.agreement.id,
          entityType: "agreement",
          newState: { versionId: version.id, versionNumber: nextVersionNumber },
          previousState: { currentVersionId: existing.agreement.currentVersionId },
          requestId: ctx.requestId,
          vendorId: existing.vendor.id,
        });

        return reloadAgreement(repo, existing.agreement.id);
      });

      return toResult(record);
    },

    async getAgreement(ctx, agreementId) {
      const record = await reloadAgreement(repository, agreementId);
      assertCanRead(ctx, record);
      return toResult(record);
    },

    async getAgreementForQuoteRevision(ctx, quoteRevisionId) {
      const record = await repository.findAgreementByQuoteRevisionId(quoteRevisionId);

      if (!record) {
        return null;
      }

      assertCanRead(ctx, record);
      return toResult(record);
    },

    async getDownloadUrl(ctx, agreementId) {
      const record = await reloadAgreement(repository, agreementId);
      assertCanRead(ctx, record);
      const fileId = record.agreement.signedDocumentFileId ?? record.agreement.documentFileId;

      if (!fileId) {
        throw new BusinessRuleError("Agreement document is not available yet.");
      }

      const expiresAt = new Date(now().getTime() + 15 * 60 * 1000);
      if (storageService) {
        const download = await storageService.getDownloadUrl(ctx, fileId);
        return {
          agreementId: record.agreement.id,
          downloadUrl: download.downloadUrl,
          expiresAt: download.expiresAt,
          fileId,
          storageProvider: download.file.storageProvider,
        };
      }

      return {
        agreementId: record.agreement.id,
        downloadUrl: `stub://agreements/${record.agreement.id}/download?fileId=${fileId}`,
        expiresAt,
        fileId,
        storageProvider: "stub",
      };
    },

    async signAgreement(ctx, agreementId, input) {
      const record = await repository.transaction(async (repo) => {
        const existing = await reloadAgreement(repo, agreementId);
        assertCanSignAsCustomer(ctx, existing);

        if (existing.agreement.status === "signed") {
          throw new ConflictError("Agreement has already been signed.");
        }

        if (existing.agreement.status !== "pending_signature") {
          throw new ConflictError("Agreement is not pending customer signature.", {
            status: existing.agreement.status,
          });
        }

        if (!existing.currentVersion) {
          throw new ConflictError("Agreement does not have a current version.");
        }

        if (existing.currentVersion.id !== input.acceptedTermsVersion) {
          throw new ConflictError("Agreement version is no longer current.", {
            acceptedTermsVersion: input.acceptedTermsVersion,
            currentVersionId: existing.currentVersion.id,
          });
        }

        const signedAt = now();
        const signedFile = await createSignedDocumentFile(
          repo,
          existing,
          existing.currentVersion.id,
          signedAt,
          storageService,
        );
        await repo.createSignature({
          agreementId: existing.agreement.id,
          agreementVersionId: existing.currentVersion.id,
          signatureMetadata: {
            ...input.signatureMetadata,
            acknowledgements: input.acknowledgements,
            ipAddress: ctx.ipAddress,
            requestId: ctx.requestId,
            userAgent: ctx.userAgent,
          },
          signedAt,
          signedDocumentFileId: signedFile.id,
          signerRole: "customer",
          signerUserId: ctx.userId as string,
          typedName: input.typedName,
        });
        await repo.updateAgreement(
          existing.agreement.id,
          {
            signedAt,
            signedDocumentFileId: signedFile.id,
            status: "signed",
          },
          signedAt,
        );

        if (existing.rfq.status === "accepted") {
          await transitionRfq(
            repo,
            existing.rfq.id,
            "accepted",
            "agreement_pending",
            ctx,
            "Agreement moved to pending signature before signing.",
          );
        }

        if (existing.rfq.status === "agreement_pending" || existing.rfq.status === "accepted") {
          await transitionRfq(
            repo,
            existing.rfq.id,
            "agreement_pending",
            "agreement_signed",
            ctx,
            "Customer signed agreement.",
          );
        }

        const existingFee = await repo.findPlatformAgreementFeeByAgreementId(existing.agreement.id);

        if (!existingFee) {
          const billingSettings = await repo.findBillingSettingsByVendorId(existing.vendor.id);
          const feePercentageBasisPoints = billingSettings?.agreementFeeBasisPoints ?? 0;
          const feeAmountCents = calculateAgreementFeeCents(
            existing.quoteRevision.totalCents,
            feePercentageBasisPoints,
          );
          const platformFee = await repo.createPlatformAgreementFee({
            agreementId: existing.agreement.id,
            feeAmountCents,
            feePercentageBasisPoints,
            signedAgreementTotalCents: existing.quoteRevision.totalCents,
            vendorId: existing.vendor.id,
          });
          await repo.createOutboxEvent({
            aggregateId: platformFee.id,
            aggregateType: "platform_agreement_fee",
            eventType: "platform_fee.created",
            payload: {
              agreementId: existing.agreement.id,
              feeAmountCents,
              feePercentageBasisPoints,
              vendorId: existing.vendor.id,
            },
            requestId: ctx.requestId,
          });
        }

        await repo.createAuditLog({
          action: "agreement.signed",
          actorRole: "customer",
          actorUserId: ctx.userId,
          entityId: existing.agreement.id,
          entityType: "agreement",
          ipAddress: ctx.ipAddress,
          newState: {
            signedAt: signedAt.toISOString(),
            signedDocumentFileId: signedFile.id,
            versionId: existing.currentVersion.id,
          },
          previousState: { status: existing.agreement.status },
          requestId: ctx.requestId,
          userAgent: ctx.userAgent,
          vendorId: existing.vendor.id,
        });
        await repo.createOutboxEvent({
          aggregateId: existing.agreement.id,
          aggregateType: "agreement",
          eventType: "agreement.signed",
          payload: {
            agreementId: existing.agreement.id,
            quoteId: existing.quote.id,
            quoteRevisionId: existing.quoteRevision.id,
            rfqId: existing.rfq.id,
            vendorId: existing.vendor.id,
          },
          requestId: ctx.requestId,
        });

        return reloadAgreement(repo, existing.agreement.id);
      });

      return toResult(record);
    },
  };
}
