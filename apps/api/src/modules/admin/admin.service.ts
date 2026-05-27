import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import type {
  AdminPaymentListQueryDto,
  AdminRfqListQueryDto,
  AdminVendorListQueryDto,
  AdminWebhookListQueryDto,
  MarketplaceVisibilityDto,
} from "./admin.dto.js";
import type {
  AdminRepository,
  PaymentMonitoringRecord,
  RfqReviewRecord,
  VendorReviewRecord,
} from "./admin.repository.js";

type VendorReviewResult = {
  auditLogs: unknown[];
  cuisines: { id: string; name: string; slug: string }[];
  profile: {
    businessEmail: string | null;
    businessPhone: string | null;
    headline: string | null;
    ownerContactName: string | null;
    publicDescription: string | null;
    serviceStyles: string[];
  } | null;
  serviceAreas: {
    city: string | null;
    metroArea: string;
    radiusMiles: number | null;
    state: string;
  }[];
  vendor: {
    approvalStatus: string;
    businessName: string;
    cateringMinimumCents: number | null;
    createdAt: Date;
    id: string;
    isPublished: boolean;
    pricingSummary: string | null;
    slug: string;
    status: string;
    stripe: {
      accountId: string | null;
      chargesEnabled: boolean;
      detailsSubmitted: boolean;
      disabledReason: string | null;
      payoutsEnabled: boolean;
    };
    updatedAt: Date;
  };
};

type RfqReviewResult = {
  address: RfqReviewRecord["address"];
  agreements: {
    id: string;
    signedAt: Date | null;
    status: string;
    vendorId: string;
  }[];
  auditLogs: unknown[];
  messages: {
    body: string | null;
    createdAt: Date;
    id: string;
    senderUserId: string;
    threadId: string;
  }[];
  payments: {
    amountCents: number;
    id: string;
    status: string;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId: string | null;
    vendorId: string;
  }[];
  quotes: {
    id: string;
    status: string;
    totalCents: number;
    vendorId: string;
  }[];
  requirements: Record<string, Record<string, unknown>>;
  rfq: {
    budgetMaxCents: number | null;
    budgetMinCents: number | null;
    createdAt: Date;
    customerUserId: string;
    endsAt: Date;
    estimatedHeadcount: number;
    eventName: string;
    eventType: string;
    id: string;
    startsAt: Date;
    status: string;
  };
  statusHistory: {
    createdAt: Date;
    fromStatus: string | null;
    reason: string | null;
    toStatus: string;
  }[];
  targets: {
    id: string;
    rejectedReason: string | null;
    respondedAt: Date | null;
    status: string;
    vendorId: string;
  }[];
  threads: {
    id: string;
    lastMessageAt: Date | null;
    status: string;
    vendorId: string;
  }[];
};

type PaymentMonitoringResult = {
  attempts: {
    amountCents: number;
    attemptedAt: Date;
    failureCode: string | null;
    failureMessage: string | null;
    id: string;
    status: string;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId: string | null;
  }[];
  payment: {
    amountCents: number;
    createdAt: Date;
    currency: string;
    customerUserId: string;
    id: string;
    rfqId: string;
    status: string;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId: string | null;
    type: string;
    vendorId: string;
  };
  rfq: { eventName: string; id: string; status: string } | null;
  vendor: { businessName: string; id: string; slug: string } | null;
};

export type AdminDashboardResult = {
  counts: {
    activeDisputeReviews: number;
    failedPayments: number;
    failedStripeWebhooks: number;
    pendingPlatformFees: number;
    pendingVendorApplications: number;
    rfqsInReview: number;
  };
  paymentIssues: PaymentMonitoringResult[];
  pendingVendors: VendorReviewResult[];
  rfqsNeedingReview: RfqReviewResult[];
  stripeWebhookFailures: {
    eventType: string;
    id: string;
    lastError: string | null;
    receivedAt: Date;
    status: string;
    stripeEventId: string;
  }[];
};

export type AdminService = {
  addRfqAdminNote: (ctx: RequestContext, rfqId: string, note: string) => Promise<RfqReviewResult>;
  approveVendor: (
    ctx: RequestContext,
    vendorId: string,
    input: { note?: string },
  ) => Promise<VendorReviewResult>;
  getDashboard: (ctx: RequestContext) => Promise<AdminDashboardResult>;
  getRfqReview: (ctx: RequestContext, rfqId: string) => Promise<RfqReviewResult>;
  getVendorReview: (ctx: RequestContext, vendorId: string) => Promise<VendorReviewResult>;
  listPayments: (
    ctx: RequestContext,
    query: AdminPaymentListQueryDto,
  ) => Promise<PaymentMonitoringResult[]>;
  listRfqs: (ctx: RequestContext, query: AdminRfqListQueryDto) => Promise<RfqReviewResult[]>;
  listVendors: (
    ctx: RequestContext,
    query: AdminVendorListQueryDto,
  ) => Promise<VendorReviewResult[]>;
  listWebhooks: (
    ctx: RequestContext,
    query: AdminWebhookListQueryDto,
  ) => Promise<AdminDashboardResult["stripeWebhookFailures"]>;
  rejectVendor: (
    ctx: RequestContext,
    vendorId: string,
    input: { reason: string },
  ) => Promise<VendorReviewResult>;
  requestVendorChanges: (
    ctx: RequestContext,
    vendorId: string,
    input: { note: string },
  ) => Promise<VendorReviewResult>;
  setMarketplaceVisibility: (
    ctx: RequestContext,
    vendorId: string,
    input: MarketplaceVisibilityDto,
  ) => Promise<VendorReviewResult>;
  updateRfqDisputeStatus: (
    ctx: RequestContext,
    rfqId: string,
    input: { note?: string; status: string },
  ) => Promise<RfqReviewResult>;
};

export type AdminServiceDeps = {
  repository: AdminRepository;
};

function actorRole(ctx: RequestContext): string {
  if (ctx.globalRoles.includes("platform_admin")) return "platform_admin";
  if (ctx.globalRoles.includes("support_admin")) return "support_admin";
  return ctx.globalRoles[0] ?? "unknown";
}

function auditBase(ctx: RequestContext) {
  return {
    actorRole: actorRole(ctx),
    actorUserId: ctx.userId,
    ipAddress: ctx.ipAddress,
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
  };
}

function requireRecord<T>(record: T | null, message: string): T {
  if (record === null) {
    throw new NotFoundError(message);
  }

  return record;
}

function toVendorResult(record: VendorReviewRecord): VendorReviewResult {
  return {
    auditLogs: record.auditLogs,
    cuisines: record.cuisines.map((cuisine) => ({
      id: cuisine.id,
      name: cuisine.name,
      slug: cuisine.slug,
    })),
    profile: record.profile
      ? {
          businessEmail: record.profile.businessEmail,
          businessPhone: record.profile.businessPhone,
          headline: record.profile.headline,
          ownerContactName: record.profile.ownerContactName,
          publicDescription: record.profile.publicDescription,
          serviceStyles: record.profile.serviceStyles,
        }
      : null,
    serviceAreas: record.serviceAreas.map((area) => ({
      city: area.city,
      metroArea: area.metroArea,
      radiusMiles: area.radiusMiles,
      state: area.state,
    })),
    vendor: {
      approvalStatus: record.vendor.approvalStatus,
      businessName: record.vendor.businessName,
      cateringMinimumCents: record.vendor.cateringMinimumCents,
      createdAt: record.vendor.createdAt,
      id: record.vendor.id,
      isPublished: record.vendor.isPublished,
      pricingSummary: record.vendor.pricingSummary,
      slug: record.vendor.slug,
      status: record.vendor.status,
      stripe: {
        accountId: record.vendor.stripeConnectAccountId,
        chargesEnabled: record.vendor.stripeChargesEnabled,
        detailsSubmitted: record.vendor.stripeDetailsSubmitted,
        disabledReason: record.vendor.stripeDisabledReason,
        payoutsEnabled: record.vendor.stripePayoutsEnabled,
      },
      updatedAt: record.vendor.updatedAt,
    },
  };
}

function toRfqResult(record: RfqReviewRecord): RfqReviewResult {
  const requirements: Record<string, Record<string, unknown>> = {};
  for (const requirement of record.requirements) {
    requirements[requirement.label] = requirement.details;
  }

  return {
    address: record.address,
    agreements: record.agreements.map((agreement) => ({
      id: agreement.id,
      signedAt: agreement.signedAt,
      status: agreement.status,
      vendorId: agreement.vendorId,
    })),
    auditLogs: record.auditLogs,
    messages: record.messages.map((message) => ({
      body: message.body,
      createdAt: message.createdAt,
      id: message.id,
      senderUserId: message.senderUserId,
      threadId: message.threadId,
    })),
    payments: record.payments.map((payment) => ({
      amountCents: payment.amountCents,
      id: payment.id,
      status: payment.status,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      vendorId: payment.vendorId,
    })),
    quotes: record.quotes.map((quote) => ({
      id: quote.id,
      status: quote.status,
      totalCents: quote.totalCents,
      vendorId: quote.vendorId,
    })),
    requirements,
    rfq: {
      budgetMaxCents: record.rfq.budgetMaxCents,
      budgetMinCents: record.rfq.budgetMinCents,
      createdAt: record.rfq.createdAt,
      customerUserId: record.rfq.customerUserId,
      endsAt: record.rfq.endsAt,
      estimatedHeadcount: record.rfq.estimatedHeadcount,
      eventName: record.rfq.eventName,
      eventType: record.rfq.eventType,
      id: record.rfq.id,
      startsAt: record.rfq.startsAt,
      status: record.rfq.status,
    },
    statusHistory: record.statusHistory.map((history) => ({
      createdAt: history.createdAt,
      fromStatus: history.fromStatus,
      reason: history.reason,
      toStatus: history.toStatus,
    })),
    targets: record.targets.map((target) => ({
      id: target.id,
      rejectedReason: target.rejectedReason,
      respondedAt: target.respondedAt,
      status: target.status,
      vendorId: target.vendorId,
    })),
    threads: record.threads.map((thread) => ({
      id: thread.id,
      lastMessageAt: thread.lastMessageAt,
      status: thread.status,
      vendorId: thread.vendorId,
    })),
  };
}

function toPaymentResult(record: PaymentMonitoringRecord): PaymentMonitoringResult {
  return {
    attempts: record.attempts.map((attempt) => ({
      amountCents: attempt.amountCents,
      attemptedAt: attempt.attemptedAt,
      failureCode: attempt.failureCode,
      failureMessage: attempt.failureMessage,
      id: attempt.id,
      status: attempt.status,
      stripeCheckoutSessionId: attempt.stripeCheckoutSessionId,
      stripePaymentIntentId: attempt.stripePaymentIntentId,
    })),
    payment: {
      amountCents: record.payment.amountCents,
      createdAt: record.payment.createdAt,
      currency: record.payment.currency,
      customerUserId: record.payment.customerUserId,
      id: record.payment.id,
      rfqId: record.payment.rfqId,
      status: record.payment.status,
      stripeCheckoutSessionId: record.payment.stripeCheckoutSessionId,
      stripePaymentIntentId: record.payment.stripePaymentIntentId,
      type: record.payment.type,
      vendorId: record.payment.vendorId,
    },
    rfq: record.rfq
      ? {
          eventName: record.rfq.eventName,
          id: record.rfq.id,
          status: record.rfq.status,
        }
      : null,
    vendor: record.vendor
      ? {
          businessName: record.vendor.businessName,
          id: record.vendor.id,
          slug: record.vendor.slug,
        }
      : null,
  };
}

function disputeAuditLogs(record: RfqReviewRecord): unknown[] {
  return record.auditLogs.filter((auditLog) => auditLog.action.startsWith("admin.rfq_dispute."));
}

function parseOptionalDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

export function createAdminService(deps: AdminServiceDeps): AdminService {
  const { repository } = deps;

  async function auditRead(
    ctx: RequestContext,
    action: string,
    entityType: string,
    entityId?: string,
  ) {
    await repository.createAuditLog({
      ...auditBase(ctx),
      action,
      entityId,
      entityType,
    });
  }

  return {
    async getDashboard(_ctx) {
      const [pendingVendors, rfqs, failedPayments, failedWebhooks, pendingPlatformFees] =
        await Promise.all([
          repository.listVendorReviews({ approvalStatus: "pending" }),
          repository.listRfqReviews({}),
          repository.listPaymentRecords({ status: "failed" }),
          repository.listWebhookEvents({ failedOnly: true }),
          repository.listPendingPlatformFees(),
        ]);
      const rfqsNeedingReview = rfqs.filter((record) =>
        ["submitted", "vendor_reviewing", "clarification_requested"].includes(record.rfq.status),
      );
      const activeDisputeReviews = rfqs.filter(
        (record) =>
          disputeAuditLogs(record).length > 0 &&
          !record.auditLogs.some(
            (auditLog) =>
              auditLog.action === "admin.rfq_dispute.status_changed" &&
              auditLog.newState?.status === "resolved",
          ),
      );

      return {
        counts: {
          activeDisputeReviews: activeDisputeReviews.length,
          failedPayments: failedPayments.length,
          failedStripeWebhooks: failedWebhooks.length,
          pendingPlatformFees: pendingPlatformFees.length,
          pendingVendorApplications: pendingVendors.length,
          rfqsInReview: rfqsNeedingReview.length,
        },
        paymentIssues: failedPayments.slice(0, 10).map(toPaymentResult),
        pendingVendors: pendingVendors.slice(0, 10).map(toVendorResult),
        rfqsNeedingReview: rfqsNeedingReview.slice(0, 10).map(toRfqResult),
        stripeWebhookFailures: failedWebhooks.slice(0, 10).map((event) => ({
          eventType: event.eventType,
          id: event.id,
          lastError: event.lastError,
          receivedAt: event.receivedAt,
          status: event.status,
          stripeEventId: event.stripeEventId,
        })),
      };
    },

    async listVendors(_ctx, query) {
      return (await repository.listVendorReviews(query)).map(toVendorResult);
    },

    async getVendorReview(ctx, vendorId) {
      await auditRead(ctx, "admin.vendor.viewed", "vendor", vendorId);
      return toVendorResult(
        requireRecord(await repository.findVendorReview(vendorId), "Vendor was not found."),
      );
    },

    async approveVendor(ctx, vendorId, input) {
      return repository.transaction(async (repo) => {
        const previous = requireRecord(
          await repo.findVendorReview(vendorId),
          "Vendor was not found.",
        );
        const updated = requireRecord(
          await repo.updateVendorState(
            vendorId,
            { approvalStatus: "approved", isPublished: true, status: "active" },
            new Date(),
          ),
          "Vendor was not found.",
        );
        await repo.createAuditLog({
          ...auditBase(ctx),
          action: "admin.vendor.approved",
          entityId: vendorId,
          entityType: "vendor",
          newState: {
            approvalStatus: updated.approvalStatus,
            isPublished: updated.isPublished,
            note: input.note ?? null,
            status: updated.status,
          },
          previousState: {
            approvalStatus: previous.vendor.approvalStatus,
            isPublished: previous.vendor.isPublished,
            status: previous.vendor.status,
          },
          vendorId,
        });
        return toVendorResult(
          requireRecord(await repo.findVendorReview(vendorId), "Vendor was not found."),
        );
      });
    },

    async rejectVendor(ctx, vendorId, input) {
      return repository.transaction(async (repo) => {
        const previous = requireRecord(
          await repo.findVendorReview(vendorId),
          "Vendor was not found.",
        );
        const updated = requireRecord(
          await repo.updateVendorState(
            vendorId,
            { approvalStatus: "rejected", isPublished: false },
            new Date(),
          ),
          "Vendor was not found.",
        );
        await repo.createAuditLog({
          ...auditBase(ctx),
          action: "admin.vendor.rejected",
          entityId: vendorId,
          entityType: "vendor",
          newState: {
            approvalStatus: updated.approvalStatus,
            isPublished: updated.isPublished,
            reason: input.reason,
          },
          previousState: {
            approvalStatus: previous.vendor.approvalStatus,
            isPublished: previous.vendor.isPublished,
          },
          vendorId,
        });
        return toVendorResult(
          requireRecord(await repo.findVendorReview(vendorId), "Vendor was not found."),
        );
      });
    },

    async requestVendorChanges(ctx, vendorId, input) {
      return repository.transaction(async (repo) => {
        const previous = requireRecord(
          await repo.findVendorReview(vendorId),
          "Vendor was not found.",
        );
        const updated = requireRecord(
          await repo.updateVendorState(
            vendorId,
            { approvalStatus: "pending", isPublished: false },
            new Date(),
          ),
          "Vendor was not found.",
        );
        await repo.createAuditLog({
          ...auditBase(ctx),
          action: "admin.vendor.changes_requested",
          entityId: vendorId,
          entityType: "vendor",
          newState: {
            approvalStatus: updated.approvalStatus,
            isPublished: updated.isPublished,
            note: input.note,
            reviewStatus: "changes_requested",
          },
          previousState: {
            approvalStatus: previous.vendor.approvalStatus,
            isPublished: previous.vendor.isPublished,
          },
          vendorId,
        });
        return toVendorResult(
          requireRecord(await repo.findVendorReview(vendorId), "Vendor was not found."),
        );
      });
    },

    async setMarketplaceVisibility(ctx, vendorId, input) {
      return repository.transaction(async (repo) => {
        const previous = requireRecord(
          await repo.findVendorReview(vendorId),
          "Vendor was not found.",
        );
        const nextIsPublished = input.status === "suspended" ? false : input.isPublished;

        if (nextIsPublished && previous.vendor.approvalStatus !== "approved") {
          throw new BusinessRuleError("Only approved vendors can be published in the marketplace.");
        }

        const updated = requireRecord(
          await repo.updateVendorState(
            vendorId,
            {
              isPublished: nextIsPublished,
              status: input.status,
            },
            new Date(),
          ),
          "Vendor was not found.",
        );
        await repo.createAuditLog({
          ...auditBase(ctx),
          action: "admin.marketplace_visibility.updated",
          entityId: vendorId,
          entityType: "vendor",
          newState: {
            isPublished: updated.isPublished,
            reason: input.reason ?? null,
            status: updated.status,
          },
          previousState: {
            isPublished: previous.vendor.isPublished,
            status: previous.vendor.status,
          },
          vendorId,
        });
        return toVendorResult(
          requireRecord(await repo.findVendorReview(vendorId), "Vendor was not found."),
        );
      });
    },

    async listRfqs(_ctx, query) {
      return (await repository.listRfqReviews(query)).map(toRfqResult);
    },

    async getRfqReview(ctx, rfqId) {
      await auditRead(ctx, "admin.rfq_review.viewed", "rfq", rfqId);
      return toRfqResult(
        requireRecord(await repository.findRfqReview(rfqId), "RFQ was not found."),
      );
    },

    async addRfqAdminNote(ctx, rfqId, note) {
      if (!note.trim()) {
        throw new ValidationError("Admin note cannot be empty.");
      }

      await repository.createAuditLog({
        ...auditBase(ctx),
        action: "admin.rfq_review.note_added",
        entityId: rfqId,
        entityType: "rfq",
        newState: { note },
      });
      return toRfqResult(
        requireRecord(await repository.findRfqReview(rfqId), "RFQ was not found."),
      );
    },

    async updateRfqDisputeStatus(ctx, rfqId, input) {
      await repository.createAuditLog({
        ...auditBase(ctx),
        action: "admin.rfq_dispute.status_changed",
        entityId: rfqId,
        entityType: "rfq",
        newState: {
          note: input.note ?? null,
          status: input.status,
        },
      });
      return toRfqResult(
        requireRecord(await repository.findRfqReview(rfqId), "RFQ was not found."),
      );
    },

    async listPayments(ctx, query) {
      await auditRead(ctx, "admin.payment_monitoring.viewed", "payment_monitoring");
      return (
        await repository.listPaymentRecords({
          dateFrom: parseOptionalDate(query.dateFrom),
          dateTo: parseOptionalDate(query.dateTo),
          status: query.status,
          vendorId: query.vendorId,
        })
      ).map(toPaymentResult);
    },

    async listWebhooks(ctx, query) {
      await auditRead(ctx, "admin.stripe_webhooks.viewed", "stripe_webhook_events");
      return (await repository.listWebhookEvents(query)).map((event) => ({
        eventType: event.eventType,
        id: event.id,
        lastError: event.lastError,
        receivedAt: event.receivedAt,
        status: event.status,
        stripeEventId: event.stripeEventId,
      }));
    },
  };
}
