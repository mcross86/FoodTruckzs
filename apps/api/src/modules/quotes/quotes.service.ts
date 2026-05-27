import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import type { AgreementService, AgreementServiceResult } from "../agreements/agreements.service.js";
import { assertRfqTransition, type RfqStatus } from "../rfqs/rfq-state-machine.js";
import {
  calculatePaymentScheduleTotals,
  calculateQuoteTotals,
  type CalculatedQuoteLineItem,
  type QuoteTotals,
} from "./quote-calculation.js";
import type {
  AcceptQuoteDto,
  CreateQuoteDto,
  CreateQuoteRevisionDto,
  DeclineQuoteDto,
  RequestQuoteRevisionDto,
} from "./quotes.dto.js";
import type {
  QuoteDetailRecord,
  QuoteRepository,
  QuoteRevisionBundle,
} from "./quotes.repository.js";

type QuoteServiceResult = {
  agreement?: AgreementServiceResult | null;
  currentRevision: QuoteRevisionResult;
  quote: {
    currentRevisionId: string;
    depositRequiredCents: number;
    expiresAt: Date;
    feesCents: number;
    id: string;
    rfqId: string;
    status: string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    vendorId: string;
  };
  revisions: QuoteRevisionResult[];
  rfq: {
    customerUserId: string;
    eventName: string;
    estimatedHeadcount: number;
    id: string;
    startsAt: Date;
    status: RfqStatus;
  };
  vendor: {
    businessName: string;
    id: string;
    slug: string;
  };
};

type QuoteRevisionResult = {
  assumptions: string[];
  cancellationPolicySummary: string | null;
  createdAt: Date;
  depositRequiredCents: number;
  exclusions: string[];
  expiresAt: Date;
  feesCents: number;
  id: string;
  lineItems: {
    description: string | null;
    id: string;
    isInternal: boolean;
    isOptional: boolean;
    name: string;
    quantity: number;
    taxable: boolean;
    totalAmountCents: number;
    type: string;
    unit: string;
    unitAmountCents: number;
  }[];
  menuSummary: string | null;
  notes: string | null;
  paymentSchedule: {
    amountCents: number;
    dueAt: Date | null;
    id: string;
    label: string;
    status: string;
    type: string;
  }[];
  revisionNumber: number;
  serviceStyle: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

export type QuoteService = {
  acceptQuote: (
    ctx: RequestContext,
    quoteId: string,
    input: AcceptQuoteDto,
  ) => Promise<QuoteServiceResult>;
  createQuote: (
    ctx: RequestContext,
    rfqId: string,
    input: CreateQuoteDto,
  ) => Promise<QuoteServiceResult>;
  createRevision: (
    ctx: RequestContext,
    quoteId: string,
    input: CreateQuoteRevisionDto,
  ) => Promise<QuoteServiceResult>;
  declineQuote: (
    ctx: RequestContext,
    quoteId: string,
    input: DeclineQuoteDto,
  ) => Promise<QuoteServiceResult>;
  getQuote: (ctx: RequestContext, quoteId: string) => Promise<QuoteServiceResult>;
  listRfqQuotes: (ctx: RequestContext, rfqId: string) => Promise<QuoteServiceResult[]>;
  requestRevision: (
    ctx: RequestContext,
    quoteId: string,
    input: RequestQuoteRevisionDto,
  ) => Promise<QuoteServiceResult>;
};

export type QuoteServiceDeps = {
  agreementService?: AgreementService;
  repository: QuoteRepository;
};

type QuoteWriteInput = CreateQuoteDto | CreateQuoteRevisionDto;

function now(): Date {
  return new Date();
}

function isAdmin(ctx: RequestContext): boolean {
  return ctx.globalRoles.includes("platform_admin") || ctx.globalRoles.includes("support_admin");
}

function vendorCanManageQuotes(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) =>
      membership.vendorId === vendorId &&
      membership.status === "active" &&
      (membership.role === "owner" || membership.role === "manager"),
  );
}

function vendorCanRead(ctx: RequestContext, vendorId: string): boolean {
  return ctx.vendorMemberships.some(
    (membership) => membership.vendorId === vendorId && membership.status === "active",
  );
}

function assertVendorQuoteAccess(ctx: RequestContext, vendorId: string): void {
  if (!ctx.userId) {
    throw new AuthorizationError("Authentication is required.");
  }

  if (!vendorCanManageQuotes(ctx, vendorId)) {
    throw new AuthorizationError("Vendor owner or manager access is required to manage quotes.");
  }
}

function assertCustomerOwner(ctx: RequestContext, record: QuoteDetailRecord): void {
  if (
    !ctx.userId ||
    ctx.userId !== record.rfq.customerUserId ||
    !ctx.globalRoles.includes("customer")
  ) {
    throw new AuthorizationError("Only the RFQ customer can perform this quote action.");
  }
}

function assertCanReadQuote(ctx: RequestContext, record: QuoteDetailRecord): void {
  if (
    isAdmin(ctx) ||
    record.rfq.customerUserId === ctx.userId ||
    vendorCanRead(ctx, record.vendor.id)
  ) {
    return;
  }

  throw new AuthorizationError("You are not authorized to view this quote.");
}

function assertPositiveQuoteTotal(totals: QuoteTotals): void {
  if (totals.totalCents <= 0) {
    throw new BusinessRuleError("Quote must contain at least one positive customer-facing charge.");
  }
}

function validateMoneyRules(input: QuoteWriteInput, totals: QuoteTotals): void {
  assertPositiveQuoteTotal(totals);

  if (input.depositRequiredCents > totals.totalCents) {
    throw new BusinessRuleError("Deposit cannot exceed quote total.");
  }

  const scheduleTotals = calculatePaymentScheduleTotals(input.paymentSchedule);

  if (scheduleTotals.totalCents !== totals.totalCents) {
    throw new BusinessRuleError("Payment schedule must sum to the quote total.", {
      paymentScheduleTotalCents: scheduleTotals.totalCents,
      quoteTotalCents: totals.totalCents,
    });
  }

  if (
    input.depositRequiredCents > 0 &&
    scheduleTotals.depositCents !== input.depositRequiredCents
  ) {
    throw new BusinessRuleError("Deposit schedule items must match the required deposit amount.", {
      depositRequiredCents: input.depositRequiredCents,
      depositScheduleTotalCents: scheduleTotals.depositCents,
    });
  }
}

function validateExpiration(
  input: QuoteWriteInput,
  eventStartsAt: Date,
  currentTime = now(),
): Date {
  const expiresAt = new Date(input.expiresAt);

  if (expiresAt.getTime() <= currentTime.getTime()) {
    throw new BusinessRuleError("Quote expiration must be in the future.");
  }

  if (expiresAt.getTime() >= eventStartsAt.getTime()) {
    throw new BusinessRuleError("Quote expiration must be before the event starts.");
  }

  return expiresAt;
}

function quoteTermsSnapshot(input: QuoteWriteInput, totals: QuoteTotals) {
  return {
    assumptions: input.assumptions,
    cancellationPolicySummary: input.cancellationPolicySummary ?? null,
    depositRequiredCents: input.depositRequiredCents,
    exclusions: input.exclusions,
    expiresAt: input.expiresAt,
    lineItems: totals.lineItems.map((lineItem, index) => ({
      description: input.lineItems[index]?.description ?? null,
      isInternal: input.lineItems[index]?.isInternal ?? false,
      isOptional: input.lineItems[index]?.isOptional ?? false,
      name: input.lineItems[index]?.name,
      quantity: lineItem.quantity,
      taxable: input.lineItems[index]?.taxable ?? false,
      totalAmountCents: lineItem.totalAmountCents,
      type: lineItem.type,
      unit: input.lineItems[index]?.unit ?? "each",
      unitAmountCents: lineItem.unitAmountCents,
    })),
    menuSummary: input.menuSummary,
    paymentSchedule: input.paymentSchedule,
    serviceStyle: input.serviceStyle,
    totals: {
      depositRequiredCents: input.depositRequiredCents,
      feesCents: totals.feesCents,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
    },
  };
}

function currentTermsSnapshot(record: QuoteDetailRecord) {
  const revision = record.currentRevision;

  if (!revision) {
    return null;
  }

  return {
    assumptions: revision.revision.assumptions,
    cancellationPolicySummary: revision.revision.cancellationPolicySummary,
    depositRequiredCents: revision.revision.depositRequiredCents,
    exclusions: revision.revision.exclusions,
    expiresAt: revision.revision.expiresAt?.toISOString() ?? null,
    lineItems: revision.lineItems.map((lineItem) => ({
      description: lineItem.description,
      isInternal: lineItem.isInternal,
      isOptional: lineItem.isOptional,
      name: lineItem.name,
      quantity: lineItem.quantity,
      taxable: lineItem.taxable,
      totalAmountCents: lineItem.totalAmountCents,
      type: lineItem.type,
      unit: lineItem.unit,
      unitAmountCents: lineItem.unitAmountCents,
    })),
    menuSummary: revision.revision.menuSummary,
    paymentSchedule: revision.paymentScheduleItems.map((item) => ({
      amountCents: item.amountCents,
      dueAt: item.dueAt?.toISOString(),
      label: item.label,
      type: item.type,
    })),
    serviceStyle: revision.revision.serviceStyle,
    totals: {
      depositRequiredCents: revision.revision.depositRequiredCents,
      feesCents: revision.revision.feesCents,
      subtotalCents: revision.revision.subtotalCents,
      taxCents: revision.revision.taxCents,
      totalCents: revision.revision.totalCents,
    },
  };
}

function assertMaterialChange(
  record: QuoteDetailRecord,
  input: QuoteWriteInput,
  totals: QuoteTotals,
) {
  const currentSnapshot = currentTermsSnapshot(record);
  const nextSnapshot = quoteTermsSnapshot(input, totals);

  if (currentSnapshot && JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
    throw new BusinessRuleError("Revision must change at least one material quote term.");
  }
}

function revisionToResult(bundle: QuoteRevisionBundle): QuoteRevisionResult {
  return {
    assumptions: bundle.revision.assumptions,
    cancellationPolicySummary: bundle.revision.cancellationPolicySummary,
    createdAt: bundle.revision.createdAt,
    depositRequiredCents: bundle.revision.depositRequiredCents,
    exclusions: bundle.revision.exclusions,
    expiresAt: bundle.revision.expiresAt ?? bundle.revision.createdAt,
    feesCents: bundle.revision.feesCents,
    id: bundle.revision.id,
    lineItems: bundle.lineItems.map((lineItem) => ({
      description: lineItem.description,
      id: lineItem.id,
      isInternal: lineItem.isInternal,
      isOptional: lineItem.isOptional,
      name: lineItem.name,
      quantity: lineItem.quantity,
      taxable: lineItem.taxable,
      totalAmountCents: lineItem.totalAmountCents,
      type: lineItem.type,
      unit: lineItem.unit,
      unitAmountCents: lineItem.unitAmountCents,
    })),
    menuSummary: bundle.revision.menuSummary,
    notes: bundle.revision.notes,
    paymentSchedule: bundle.paymentScheduleItems.map((item) => ({
      amountCents: item.amountCents,
      dueAt: item.dueAt,
      id: item.id,
      label: item.label,
      status: item.status,
      type: item.type,
    })),
    revisionNumber: bundle.revision.revisionNumber,
    serviceStyle: bundle.revision.serviceStyle,
    subtotalCents: bundle.revision.subtotalCents,
    taxCents: bundle.revision.taxCents,
    totalCents: bundle.revision.totalCents,
  };
}

function toServiceResult(record: QuoteDetailRecord): QuoteServiceResult {
  if (!record.currentRevision) {
    throw new Error("Expected quote current revision to be loaded.");
  }

  const currentRevision = revisionToResult(record.currentRevision);

  return {
    currentRevision,
    quote: {
      currentRevisionId: record.quote.currentRevisionId ?? currentRevision.id,
      depositRequiredCents: record.quote.depositRequiredCents,
      expiresAt: record.quote.expiresAt ?? currentRevision.expiresAt,
      feesCents: record.quote.feesCents,
      id: record.quote.id,
      rfqId: record.quote.rfqId,
      status: record.quote.status,
      subtotalCents: record.quote.subtotalCents,
      taxCents: record.quote.taxCents,
      totalCents: record.quote.totalCents,
      vendorId: record.quote.vendorId,
    },
    revisions: record.revisions.map(revisionToResult),
    rfq: {
      customerUserId: record.rfq.customerUserId,
      eventName: record.rfq.eventName,
      estimatedHeadcount: record.rfq.estimatedHeadcount,
      id: record.rfq.id,
      startsAt: record.rfq.startsAt,
      status: record.rfq.status,
    },
    vendor: {
      businessName: record.vendor.businessName,
      id: record.vendor.id,
      slug: record.vendor.slug,
    },
  };
}

async function reloadQuote(
  repository: QuoteRepository,
  quoteId: string,
): Promise<QuoteDetailRecord> {
  const record = await repository.findQuoteById(quoteId);

  if (!record) {
    throw new NotFoundError("Quote was not found.");
  }

  return record;
}

async function transitionRfq(
  repository: QuoteRepository,
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

async function transitionForSentQuote(
  repository: QuoteRepository,
  rfqId: string,
  status: RfqStatus,
  ctx: RequestContext,
): Promise<RfqStatus> {
  let currentStatus = status;

  if (currentStatus === "submitted") {
    currentStatus = await transitionRfq(
      repository,
      rfqId,
      currentStatus,
      "vendor_reviewing",
      ctx,
      "Vendor began quote review.",
    );
  }

  if (currentStatus === "vendor_reviewing") {
    currentStatus = await transitionRfq(
      repository,
      rfqId,
      currentStatus,
      "quote_in_progress",
      ctx,
      "Vendor started quote.",
    );
  }

  if (currentStatus === "quote_in_progress" || currentStatus === "negotiation") {
    currentStatus = await transitionRfq(
      repository,
      rfqId,
      currentStatus,
      "quote_sent",
      ctx,
      "Vendor sent quote.",
    );
  }

  if (currentStatus !== "quote_sent") {
    throw new ConflictError("RFQ is not open for quote sending.", { status: currentStatus });
  }

  return currentStatus;
}

async function writeRevision(
  repository: QuoteRepository,
  quoteId: string,
  revisionNumber: number,
  input: QuoteWriteInput,
  totals: QuoteTotals,
  expiresAt: Date,
  ctx: RequestContext,
) {
  const revision = await repository.createRevision({
    assumptions: input.assumptions,
    cancellationPolicySummary: input.cancellationPolicySummary,
    createdByUserId: ctx.userId,
    depositRequiredCents: input.depositRequiredCents,
    exclusions: input.exclusions,
    expiresAt,
    feesCents: totals.feesCents,
    menuSummary: input.menuSummary,
    notes: input.notes,
    paymentSchedule: input.paymentSchedule,
    quoteId,
    revisionNumber,
    serviceStyle: input.serviceStyle,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
  });

  await repository.createLineItems(
    input.lineItems.map((lineItem, index) => {
      const calculated = totals.lineItems[index] as CalculatedQuoteLineItem;

      return {
        description: lineItem.description,
        isInternal: lineItem.isInternal,
        isOptional: lineItem.isOptional,
        name: lineItem.name,
        quantity: lineItem.quantity,
        quoteId,
        quoteRevisionId: revision.id,
        sortOrder: index,
        taxable: lineItem.taxable,
        totalAmountCents: calculated.totalAmountCents,
        type: lineItem.type,
        unit: lineItem.unit,
        unitAmountCents: calculated.unitAmountCents,
      };
    }),
  );
  await repository.createPaymentScheduleItems(
    input.paymentSchedule.map((item, index) => ({
      amountCents: item.amountCents,
      dueAt: item.dueAt ? new Date(item.dueAt) : undefined,
      label: item.label,
      quoteRevisionId: revision.id,
      sortOrder: index,
      status: index === 0 ? "due" : "pending",
      type: item.type,
    })),
  );

  return revision;
}

function validateWriteInput(input: QuoteWriteInput, eventStartsAt: Date) {
  const totals = calculateQuoteTotals(input.lineItems);
  validateMoneyRules(input, totals);
  const expiresAt = validateExpiration(input, eventStartsAt);

  return { expiresAt, totals };
}

export function createQuoteService(deps: QuoteServiceDeps): QuoteService {
  const { agreementService, repository } = deps;

  async function attachAgreement(
    ctx: RequestContext,
    result: QuoteServiceResult,
  ): Promise<QuoteServiceResult> {
    if (!agreementService) {
      return result;
    }

    const agreement = await agreementService.getAgreementForQuoteRevision(
      ctx,
      result.quote.currentRevisionId,
    );

    if (!agreement) {
      return result;
    }

    return {
      ...result,
      agreement,
      rfq: {
        ...result.rfq,
        status: agreement.rfq.status,
      },
    };
  }

  return {
    async acceptQuote(ctx, quoteId, input) {
      const result = await repository.transaction(async (repo) => {
        const record = await reloadQuote(repo, quoteId);
        assertCustomerOwner(ctx, record);

        if (record.quote.status === "accepted") {
          return record;
        }

        if (
          !record.currentRevision ||
          record.quote.currentRevisionId !== input.acceptedRevisionId
        ) {
          throw new ConflictError("Customer can accept only the current quote revision.", {
            acceptedRevisionId: input.acceptedRevisionId,
            currentRevisionId: record.quote.currentRevisionId,
          });
        }

        if (record.quote.status !== "sent") {
          throw new ConflictError("Quote is not open for acceptance.", {
            status: record.quote.status,
          });
        }

        const expiresAt = record.quote.expiresAt ?? record.currentRevision.revision.expiresAt;

        if (!expiresAt || expiresAt.getTime() <= now().getTime()) {
          throw new BusinessRuleError("Quote is expired and must be revised before acceptance.");
        }

        if (record.rfq.status !== "quote_sent" && record.rfq.status !== "negotiation") {
          throw new ConflictError("RFQ is not open for quote acceptance.", {
            status: record.rfq.status,
          });
        }

        const changedAt = now();
        await repo.updateQuote(record.quote.id, { status: "accepted" }, changedAt);
        await repo.updateCompetingQuotesNotSelected(record.rfq.id, record.quote.id, changedAt);
        await transitionRfq(
          repo,
          record.rfq.id,
          record.rfq.status,
          "accepted",
          ctx,
          "Customer accepted quote.",
        );
        await repo.createAuditLog({
          action: "quote.accepted",
          actorRole: "customer",
          actorUserId: ctx.userId,
          entityId: record.quote.id,
          entityType: "quote",
          newState: { acceptedRevisionId: input.acceptedRevisionId },
          previousState: { status: record.quote.status },
          requestId: ctx.requestId,
          vendorId: record.vendor.id,
        });
        await repo.createOutboxEvent({
          aggregateId: record.quote.id,
          aggregateType: "quote",
          eventType: "quote.accepted",
          payload: {
            quoteId: record.quote.id,
            quoteRevisionId: input.acceptedRevisionId,
            rfqId: record.rfq.id,
            vendorId: record.vendor.id,
          },
          requestId: ctx.requestId,
        });

        return reloadQuote(repo, quoteId);
      });

      const quoteResult = toServiceResult(result);

      if (!agreementService) {
        return quoteResult;
      }

      const agreement = await agreementService.ensureDraftForAcceptedQuote(ctx, quoteId);

      return {
        ...quoteResult,
        agreement,
        rfq: {
          ...quoteResult.rfq,
          status: agreement.rfq.status,
        },
      };
    },

    async createQuote(ctx, rfqId, input) {
      const result = await repository.transaction(async (repo) => {
        assertVendorQuoteAccess(ctx, input.vendorId);
        const targetRecord = await repo.findRfqTargetForVendor(rfqId, input.vendorId);

        if (!targetRecord) {
          throw new NotFoundError("RFQ target was not found for this vendor.");
        }

        if (targetRecord.target.status !== "accepted") {
          throw new ConflictError("Vendor must accept the RFQ before creating a quote.", {
            targetStatus: targetRecord.target.status,
          });
        }

        const existingQuote = await repo.findQuoteByRfqVendor(rfqId, input.vendorId);

        if (existingQuote) {
          throw new ConflictError("A quote already exists for this RFQ and vendor.");
        }

        const { expiresAt, totals } = validateWriteInput(input, targetRecord.rfq.startsAt);
        let status = targetRecord.rfq.status;
        status = await transitionForSentQuote(repo, targetRecord.rfq.id, status, ctx);
        const createdAt = now();
        const quote = await repo.createQuote({
          depositRequiredCents: input.depositRequiredCents,
          expiresAt,
          feesCents: totals.feesCents,
          rfqId,
          status: "sent",
          subtotalCents: totals.subtotalCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          vendorId: input.vendorId,
        });
        const revision = await writeRevision(repo, quote.id, 1, input, totals, expiresAt, ctx);
        await repo.updateQuote(
          quote.id,
          {
            currentRevisionId: revision.id,
            depositRequiredCents: input.depositRequiredCents,
            expiresAt,
            feesCents: totals.feesCents,
            status: "sent",
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
          },
          createdAt,
        );
        await repo.updateVendorTarget(
          targetRecord.target.id,
          { respondedAt: createdAt, status: "quote_sent" },
          createdAt,
        );
        await repo.createAuditLog({
          action: "quote.sent",
          actorRole: "vendor_user",
          actorUserId: ctx.userId,
          entityId: quote.id,
          entityType: "quote",
          newState: { quoteRevisionId: revision.id, status },
          previousState: null,
          requestId: ctx.requestId,
          vendorId: input.vendorId,
        });
        await repo.createOutboxEvent({
          aggregateId: quote.id,
          aggregateType: "quote",
          eventType: "quote.sent",
          payload: {
            quoteId: quote.id,
            quoteRevisionId: revision.id,
            rfqId,
            vendorId: input.vendorId,
          },
          requestId: ctx.requestId,
        });

        return reloadQuote(repo, quote.id);
      });

      return toServiceResult(result);
    },

    async createRevision(ctx, quoteId, input) {
      const result = await repository.transaction(async (repo) => {
        const record = await reloadQuote(repo, quoteId);
        assertVendorQuoteAccess(ctx, record.vendor.id);

        if (record.quote.status === "accepted" || record.quote.status === "cancelled") {
          throw new ConflictError("Accepted or cancelled quotes cannot be revised.", {
            status: record.quote.status,
          });
        }

        if (record.quote.status === "declined" || record.quote.status === "not_selected") {
          throw new ConflictError("Declined or not-selected quotes cannot be revised.", {
            status: record.quote.status,
          });
        }

        const { expiresAt, totals } = validateWriteInput(input, record.rfq.startsAt);
        assertMaterialChange(record, input, totals);
        await transitionForSentQuote(repo, record.rfq.id, record.rfq.status, ctx);
        const revisionNumber =
          Math.max(0, ...record.revisions.map((revision) => revision.revision.revisionNumber)) + 1;
        const revision = await writeRevision(
          repo,
          record.quote.id,
          revisionNumber,
          input,
          totals,
          expiresAt,
          ctx,
        );
        const changedAt = now();
        await repo.updateQuote(
          record.quote.id,
          {
            currentRevisionId: revision.id,
            depositRequiredCents: input.depositRequiredCents,
            expiresAt,
            feesCents: totals.feesCents,
            status: "sent",
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
          },
          changedAt,
        );
        if (record.target) {
          await repo.updateVendorTarget(
            record.target.id,
            { respondedAt: changedAt, status: "quote_sent" },
            changedAt,
          );
        }
        await repo.createAuditLog({
          action: "quote.revised",
          actorRole: "vendor_user",
          actorUserId: ctx.userId,
          entityId: record.quote.id,
          entityType: "quote",
          newState: { quoteRevisionId: revision.id, revisionNumber },
          previousState: { currentRevisionId: record.quote.currentRevisionId },
          requestId: ctx.requestId,
          vendorId: record.vendor.id,
        });
        await repo.createOutboxEvent({
          aggregateId: record.quote.id,
          aggregateType: "quote",
          eventType: "quote.sent",
          payload: {
            quoteId: record.quote.id,
            quoteRevisionId: revision.id,
            revisionNumber,
            rfqId: record.rfq.id,
            vendorId: record.vendor.id,
          },
          requestId: ctx.requestId,
        });

        return reloadQuote(repo, record.quote.id);
      });

      return toServiceResult(result);
    },

    async declineQuote(ctx, quoteId, input) {
      const result = await repository.transaction(async (repo) => {
        const record = await reloadQuote(repo, quoteId);
        assertCustomerOwner(ctx, record);

        if (record.quote.status === "accepted") {
          throw new ConflictError("Accepted quotes cannot be declined.");
        }

        const changedAt = now();
        await repo.updateQuote(record.quote.id, { status: "declined" }, changedAt);
        if (record.rfq.status === "quote_sent") {
          await transitionRfq(
            repo,
            record.rfq.id,
            record.rfq.status,
            "negotiation",
            ctx,
            "Customer declined quote.",
          );
        }
        await repo.createAuditLog({
          action: "quote.declined",
          actorRole: "customer",
          actorUserId: ctx.userId,
          entityId: record.quote.id,
          entityType: "quote",
          newState: { reason: input.reason ?? null },
          previousState: { status: record.quote.status },
          requestId: ctx.requestId,
          vendorId: record.vendor.id,
        });

        return reloadQuote(repo, quoteId);
      });

      return toServiceResult(result);
    },

    async getQuote(ctx, quoteId) {
      const record = await reloadQuote(repository, quoteId);
      assertCanReadQuote(ctx, record);
      return attachAgreement(ctx, toServiceResult(record));
    },

    async listRfqQuotes(ctx, rfqId) {
      const records = await repository.listQuotesForRfq(rfqId);
      const results = records
        .filter((record) => {
          try {
            assertCanReadQuote(ctx, record);
            return true;
          } catch {
            return false;
          }
        })
        .map(toServiceResult);

      return Promise.all(results.map((result) => attachAgreement(ctx, result)));
    },

    async requestRevision(ctx, quoteId, input) {
      const result = await repository.transaction(async (repo) => {
        const record = await reloadQuote(repo, quoteId);
        assertCustomerOwner(ctx, record);

        if (
          !record.currentRevision ||
          record.quote.currentRevisionId !== input.requestedRevisionId
        ) {
          throw new ConflictError(
            "Customer can request changes only to the current quote revision.",
            {
              currentRevisionId: record.quote.currentRevisionId,
              requestedRevisionId: input.requestedRevisionId,
            },
          );
        }

        if (record.quote.status !== "sent") {
          throw new ConflictError("Quote is not open for revision requests.", {
            status: record.quote.status,
          });
        }

        if (record.rfq.status === "quote_sent") {
          await transitionRfq(
            repo,
            record.rfq.id,
            record.rfq.status,
            "negotiation",
            ctx,
            "Customer requested quote revision.",
          );
        }
        await repo.createAuditLog({
          action: "quote.revision_requested",
          actorRole: "customer",
          actorUserId: ctx.userId,
          entityId: record.quote.id,
          entityType: "quote",
          newState: {
            message: input.message,
            reasonCodes: input.reasonCodes,
            requestedRevisionId: input.requestedRevisionId,
          },
          previousState: { rfqStatus: record.rfq.status },
          requestId: ctx.requestId,
          vendorId: record.vendor.id,
        });
        await repo.createOutboxEvent({
          aggregateId: record.quote.id,
          aggregateType: "quote",
          eventType: "quote.revision_requested",
          payload: {
            message: input.message,
            quoteId: record.quote.id,
            quoteRevisionId: input.requestedRevisionId,
            reasonCodes: input.reasonCodes,
            rfqId: record.rfq.id,
            vendorId: record.vendor.id,
          },
          requestId: ctx.requestId,
        });

        return reloadQuote(repo, quoteId);
      });

      return toServiceResult(result);
    },
  };
}
