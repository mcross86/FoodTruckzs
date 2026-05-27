import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import type { StripeClient, StripeWebhookEvent } from "../../shared/stripe/stripe-client.js";
import { assertRfqTransition } from "../rfqs/rfq-state-machine.js";
import { confirmCateringEventFromContext } from "../scheduling/scheduling.service.js";
import type {
  CreateDepositCheckoutSessionDto,
  CreateStripeOnboardingLinkDto,
} from "./payments.dto.js";
import type {
  PaymentAgreementContext,
  PaymentDetailRecord,
  PaymentRepository,
  UpdateVendorStripeReadinessInput,
  VendorPaymentRecord,
} from "./payments.repository.js";

type PaymentAttemptResult = {
  amountCents: number;
  completedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  id: string;
  status: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
};

export type PaymentServiceResult = {
  attempts: PaymentAttemptResult[];
  checkoutUrl: string | null;
  payment: {
    amountCents: number;
    currency: string;
    id: string;
    status: string;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId: string | null;
    type: string;
  };
  scheduleItem: {
    amountCents: number;
    dueAt: Date | null;
    id: string;
    label: string;
    status: string;
    type: string;
  } | null;
};

export type VendorPaymentSummaryResult = {
  payments: (PaymentServiceResult & {
    agreementId: string;
    eventName: string;
    rfqId: string;
  })[];
  stripeAccount: {
    accountId: string | null;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    disabledReason: string | null;
    payoutsEnabled: boolean;
    readyForPayments: boolean;
  };
  vendorId: string;
};

export type StripeOnboardingLinkResult = {
  onboardingUrl: string;
  stripeAccount: VendorPaymentSummaryResult["stripeAccount"];
};

export type StripeWebhookResult = {
  duplicate: boolean;
  eventId: string;
  eventType: string;
  received: true;
  status: "ignored" | "processed" | "received";
};

export type PaymentService = {
  createDepositCheckoutSession: (
    ctx: RequestContext,
    input: CreateDepositCheckoutSessionDto,
    idempotencyKey: string | undefined,
  ) => Promise<PaymentServiceResult>;
  createStripeOnboardingLink: (
    ctx: RequestContext,
    vendorId: string,
    input: CreateStripeOnboardingLinkDto,
  ) => Promise<StripeOnboardingLinkResult>;
  getPayment: (ctx: RequestContext, paymentId: string) => Promise<PaymentServiceResult>;
  handleStripeWebhook: (
    rawBody: string | Buffer,
    signature: string | undefined,
  ) => Promise<StripeWebhookResult>;
  listVendorPayments: (
    ctx: RequestContext,
    vendorId: string,
    status?: string,
  ) => Promise<VendorPaymentSummaryResult>;
};

export type PaymentServiceDeps = {
  appBaseUrl: string;
  repository: PaymentRepository;
  stripeWebhookSecret: string;
  stripeClient: StripeClient;
};

function now(): Date {
  return new Date();
}

function isAdmin(ctx: RequestContext): boolean {
  return ctx.globalRoles.includes("platform_admin") || ctx.globalRoles.includes("support_admin");
}

function vendorMembership(ctx: RequestContext, vendorId: string) {
  return ctx.vendorMemberships.find(
    (membership) => membership.vendorId === vendorId && membership.status === "active",
  );
}

function assertVendorOwner(ctx: RequestContext, vendorId: string): void {
  const membership = vendorMembership(ctx, vendorId);

  if (isAdmin(ctx) || membership?.role === "owner") {
    return;
  }

  throw new AuthorizationError("Vendor owner access is required for Stripe onboarding.");
}

function assertVendorCanReadPayments(ctx: RequestContext, vendorId: string): void {
  const membership = vendorMembership(ctx, vendorId);

  if (isAdmin(ctx) || (membership && membership.role !== "viewer")) {
    return;
  }

  throw new AuthorizationError("Vendor owner, manager, or staff access is required.");
}

function assertCustomerCanPay(ctx: RequestContext, context: PaymentAgreementContext): void {
  if (ctx.userId === context.agreement.customerUserId && ctx.globalRoles.includes("customer")) {
    return;
  }

  throw new AuthorizationError("Only the agreement customer can pay this deposit.");
}

function assertPaymentVisible(ctx: RequestContext, detail: PaymentDetailRecord): void {
  if (
    isAdmin(ctx) ||
    ctx.userId === detail.payment.customerUserId ||
    vendorMembership(ctx, detail.payment.vendorId)
  ) {
    return;
  }

  throw new AuthorizationError("You are not authorized to view this payment.");
}

function stripeAccountSummary(
  vendor: PaymentAgreementContext["vendor"],
): VendorPaymentSummaryResult["stripeAccount"] {
  const readyForPayments =
    Boolean(vendor.stripeConnectAccountId) &&
    vendor.stripeChargesEnabled &&
    vendor.stripeDetailsSubmitted;

  return {
    accountId: vendor.stripeConnectAccountId,
    chargesEnabled: vendor.stripeChargesEnabled,
    detailsSubmitted: vendor.stripeDetailsSubmitted,
    disabledReason: vendor.stripeDisabledReason,
    payoutsEnabled: vendor.stripePayoutsEnabled,
    readyForPayments,
  };
}

function vendorWithReadiness(
  vendor: PaymentAgreementContext["vendor"],
  readiness: UpdateVendorStripeReadinessInput,
): PaymentAgreementContext["vendor"] {
  return {
    ...vendor,
    stripeChargesEnabled: readiness.chargesEnabled,
    stripeConnectAccountId: readiness.accountId,
    stripeDetailsSubmitted: readiness.detailsSubmitted,
    stripeDisabledReason: readiness.disabledReason,
    stripePayoutsEnabled: readiness.payoutsEnabled,
  };
}

function paymentCheckoutUrl(detail: PaymentDetailRecord): string | null {
  const latestAttempt = [...detail.attempts].reverse().find((attempt) => {
    const checkoutUrl = attempt.metadata.checkoutUrl;
    return typeof checkoutUrl === "string" && checkoutUrl.length > 0;
  });

  return typeof latestAttempt?.metadata.checkoutUrl === "string"
    ? latestAttempt.metadata.checkoutUrl
    : null;
}

function toPaymentResult(detail: PaymentDetailRecord): PaymentServiceResult {
  return {
    attempts: detail.attempts.map((attempt) => ({
      amountCents: attempt.amountCents,
      completedAt: attempt.completedAt,
      failureCode: attempt.failureCode,
      failureMessage: attempt.failureMessage,
      id: attempt.id,
      status: attempt.status,
      stripeCheckoutSessionId: attempt.stripeCheckoutSessionId,
      stripePaymentIntentId: attempt.stripePaymentIntentId,
    })),
    checkoutUrl: paymentCheckoutUrl(detail),
    payment: {
      amountCents: detail.payment.amountCents,
      currency: detail.payment.currency,
      id: detail.payment.id,
      status: detail.payment.status,
      stripeCheckoutSessionId: detail.payment.stripeCheckoutSessionId,
      stripePaymentIntentId: detail.payment.stripePaymentIntentId,
      type: detail.payment.type,
    },
    scheduleItem: detail.scheduleItem
      ? {
          amountCents: detail.scheduleItem.amountCents,
          dueAt: detail.scheduleItem.dueAt,
          id: detail.scheduleItem.id,
          label: detail.scheduleItem.label,
          status: detail.scheduleItem.status,
          type: detail.scheduleItem.type,
        }
      : null,
  };
}

function toVendorPaymentSummary(
  vendorId: string,
  vendor: PaymentAgreementContext["vendor"],
  records: VendorPaymentRecord[],
): VendorPaymentSummaryResult {
  return {
    payments: records.map((record) => ({
      ...toPaymentResult(record),
      agreementId: record.payment.agreementId,
      eventName: record.rfq.eventName,
      rfqId: record.payment.rfqId,
    })),
    stripeAccount: stripeAccountSummary(vendor),
    vendorId,
  };
}

function assertAllowedAppUrl(appBaseUrl: string, value: string): void {
  const allowedOrigin = new URL(appBaseUrl).origin;
  const inputOrigin = new URL(value).origin;

  if (allowedOrigin !== inputOrigin) {
    throw new ValidationError("Stripe onboarding URLs must use the configured app origin.", {
      allowedOrigin,
      inputOrigin,
    });
  }
}

function requiredIdempotencyKey(idempotencyKey: string | undefined): string {
  const trimmed = idempotencyKey?.trim();

  if (!trimmed) {
    throw new ValidationError("Idempotency-Key header is required for payment checkout creation.");
  }

  return trimmed;
}

function findDepositScheduleItem(
  context: PaymentAgreementContext,
  scheduleItemId: string,
): PaymentAgreementContext["scheduleItems"][number] {
  const item = context.scheduleItems.find((candidate) => candidate.id === scheduleItemId);

  if (!item) {
    throw new NotFoundError("Payment schedule item was not found for this agreement.");
  }

  if (item.type !== "deposit") {
    throw new BusinessRuleError(
      "Only required deposit schedule items are supported in this phase.",
    );
  }

  if (item.amountCents <= 0) {
    throw new BusinessRuleError("Deposit schedule item does not require a positive payment.");
  }

  if (item.status === "paid") {
    throw new ConflictError("Deposit has already been paid.");
  }

  if (item.status === "waived" || item.status === "cancelled") {
    throw new ConflictError("Deposit schedule item is not payable.", { status: item.status });
  }

  return item;
}

function existingPaymentForScheduleItem(context: PaymentAgreementContext, scheduleItemId: string) {
  return context.payments.find((payment) => payment.paymentScheduleItemId === scheduleItemId);
}

function readinessInput(input: UpdateVendorStripeReadinessInput): UpdateVendorStripeReadinessInput {
  return input;
}

function recordFromObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringFrom(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function booleanFrom(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function readinessFromAccountObject(
  object: Record<string, unknown>,
): UpdateVendorStripeReadinessInput | null {
  const accountId = stringFrom(object.id);

  if (!accountId) return null;

  const requirements = recordFromObject(object.requirements);
  return readinessInput({
    accountId,
    chargesEnabled: booleanFrom(object.charges_enabled),
    detailsSubmitted: booleanFrom(object.details_submitted),
    disabledReason: stringFrom(requirements.disabled_reason),
    payoutsEnabled: booleanFrom(object.payouts_enabled),
  });
}

function paymentIntentFailure(eventObject: Record<string, unknown>) {
  const lastPaymentError = recordFromObject(eventObject.last_payment_error);
  return {
    failureCode: stringFrom(lastPaymentError.code),
    failureMessage: stringFrom(lastPaymentError.message),
  };
}

async function markWebhookProcessed(
  repository: PaymentRepository,
  event: StripeWebhookEvent,
  status: "ignored" | "processed",
) {
  await repository.updateWebhookEvent(event.id, { processedAt: now(), status }, now());
}

export function createPaymentService(deps: PaymentServiceDeps): PaymentService {
  const { appBaseUrl, repository, stripeClient, stripeWebhookSecret } = deps;

  async function markPaymentSucceeded(
    repo: PaymentRepository,
    detail: PaymentDetailRecord,
    completedAt: Date,
  ) {
    if (detail.payment.status === "succeeded") {
      return;
    }

    await repo.updatePayment(detail.payment.id, { status: "succeeded" }, completedAt);
    const latestAttempt = [...detail.attempts].reverse()[0];
    if (latestAttempt) {
      await repo.updateAttempt(latestAttempt.id, {
        completedAt,
        status: "succeeded",
      });
    }

    if (detail.payment.paymentScheduleItemId) {
      await repo.updatePaymentScheduleItem(
        detail.payment.paymentScheduleItemId,
        { paidAt: completedAt, status: "paid" },
        completedAt,
      );
    }

    const context = await repo.findAgreementPaymentContext(detail.payment.agreementId);
    if (!context) {
      throw new NotFoundError("Agreement context was not found for paid deposit.");
    }

    let rfqStatusAfterDeposit = context.rfq.status;
    if (context.rfq.status === "agreement_signed") {
      assertRfqTransition(context.rfq.status, "deposit_paid");
      await repo.updateRfqStatus(context.rfq.id, "deposit_paid", completedAt);
      rfqStatusAfterDeposit = "deposit_paid";
      await repo.createStatusHistory({
        actorUserId: null,
        fromStatus: "agreement_signed",
        metadata: {
          paymentId: detail.payment.id,
          stripePaymentIntentId: detail.payment.stripePaymentIntentId,
        },
        reason: "Required deposit payment confirmed.",
        rfqId: context.rfq.id,
        toStatus: "deposit_paid",
      });
    }

    await confirmCateringEventFromContext(
      repo,
      {
        agreement: context.agreement,
        paymentScheduleItems: context.scheduleItems,
        rfq: {
          ...context.rfq,
          status: rfqStatusAfterDeposit,
        },
        vendor: context.vendor,
      },
      {
        confirmedAt: completedAt,
        paymentId: detail.payment.id,
      },
    );

    await repo.createAuditLog({
      action: "payment.deposit_paid",
      actorRole: "system",
      actorUserId: null,
      entityId: detail.payment.id,
      entityType: "payment",
      newState: { status: "succeeded" },
      previousState: { status: detail.payment.status },
      requestId: null,
      vendorId: detail.payment.vendorId,
    });
    await repo.createOutboxEvent({
      aggregateId: detail.payment.id,
      aggregateType: "payment",
      eventType: "payment.deposit_paid",
      payload: {
        agreementId: detail.payment.agreementId,
        amountCents: detail.payment.amountCents,
        paymentId: detail.payment.id,
        rfqId: detail.payment.rfqId,
        vendorId: detail.payment.vendorId,
      },
      requestId: null,
    });
  }

  async function markPaymentFailed(
    repo: PaymentRepository,
    detail: PaymentDetailRecord,
    failureCode: string | null,
    failureMessage: string | null,
    failedAt: Date,
  ) {
    await repo.updatePayment(detail.payment.id, { status: "failed" }, failedAt);
    const latestAttempt = [...detail.attempts].reverse()[0];
    if (latestAttempt) {
      await repo.updateAttempt(latestAttempt.id, {
        completedAt: failedAt,
        failureCode,
        failureMessage,
        status: "failed",
      });
    }
    if (detail.payment.paymentScheduleItemId) {
      await repo.updatePaymentScheduleItem(
        detail.payment.paymentScheduleItemId,
        { status: "failed" },
        failedAt,
      );
    }
  }

  async function processStripeEvent(repo: PaymentRepository, event: StripeWebhookEvent) {
    const object = recordFromObject(event.data.object);

    if (event.type === "account.updated") {
      const readiness = readinessFromAccountObject(object);
      if (readiness) {
        await repo.updateVendorStripeReadinessByAccountId(readiness, now());
      }
      await markWebhookProcessed(repo, event, "processed");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const sessionId = stringFrom(object.id);
      if (!sessionId) {
        await markWebhookProcessed(repo, event, "ignored");
        return;
      }

      const detail = await repo.findPaymentByStripeCheckoutSessionId(sessionId);
      if (!detail) {
        await markWebhookProcessed(repo, event, "ignored");
        return;
      }

      const paymentIntentId = stringFrom(object.payment_intent);
      if (paymentIntentId && !detail.payment.stripePaymentIntentId) {
        await repo.updatePayment(
          detail.payment.id,
          { stripePaymentIntentId: paymentIntentId },
          now(),
        );
      }

      const refreshedDetail =
        paymentIntentId && !detail.payment.stripePaymentIntentId
          ? await repo.findPaymentById(detail.payment.id)
          : detail;

      await markPaymentSucceeded(repo, refreshedDetail ?? detail, now());
      await markWebhookProcessed(repo, event, "processed");
      return;
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntentId = stringFrom(object.id);
      if (!paymentIntentId) {
        await markWebhookProcessed(repo, event, "ignored");
        return;
      }

      const detail = await repo.findPaymentByStripePaymentIntentId(paymentIntentId);
      if (!detail) {
        await markWebhookProcessed(repo, event, "ignored");
        return;
      }

      await markPaymentSucceeded(repo, detail, now());
      await markWebhookProcessed(repo, event, "processed");
      return;
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntentId = stringFrom(object.id);
      if (!paymentIntentId) {
        await markWebhookProcessed(repo, event, "ignored");
        return;
      }

      const detail = await repo.findPaymentByStripePaymentIntentId(paymentIntentId);
      if (!detail) {
        await markWebhookProcessed(repo, event, "ignored");
        return;
      }

      const failure = paymentIntentFailure(object);
      await markPaymentFailed(repo, detail, failure.failureCode, failure.failureMessage, now());
      await markWebhookProcessed(repo, event, "processed");
      return;
    }

    await markWebhookProcessed(repo, event, "ignored");
  }

  return {
    async createStripeOnboardingLink(ctx, vendorId, input) {
      assertVendorOwner(ctx, vendorId);
      assertAllowedAppUrl(appBaseUrl, input.returnUrl);
      assertAllowedAppUrl(appBaseUrl, input.refreshUrl);

      const vendor = await repository.findVendorById(vendorId);
      if (!vendor) {
        throw new NotFoundError("Vendor was not found.");
      }

      const readiness = vendor.stripeConnectAccountId
        ? await stripeClient.retrieveAccount(vendor.stripeConnectAccountId)
        : await stripeClient.createConnectedAccount({
            businessName: vendor.businessName,
            vendorId: vendor.id,
          });

      const updatedVendor = await repository.updateVendorStripeReadiness(
        vendor.id,
        readiness,
        now(),
      );
      const link = await stripeClient.createOnboardingLink({
        accountId: readiness.accountId,
        refreshUrl: input.refreshUrl,
        returnUrl: input.returnUrl,
      });

      return {
        onboardingUrl: link.url,
        stripeAccount: stripeAccountSummary(
          updatedVendor ?? vendorWithReadiness(vendor, readiness),
        ),
      };
    },

    async createDepositCheckoutSession(ctx, input, idempotencyKeyHeader) {
      const idempotencyKey = requiredIdempotencyKey(idempotencyKeyHeader);
      const existingAttempt = await repository.findAttemptByIdempotencyKey(idempotencyKey);

      if (existingAttempt) {
        const existingPayment = await repository.findPaymentById(existingAttempt.paymentId);
        if (!existingPayment) {
          throw new ConflictError("Existing idempotent payment attempt no longer has a payment.");
        }

        return toPaymentResult(existingPayment);
      }

      const context = await repository.findAgreementPaymentContext(input.agreementId);
      if (!context) {
        throw new NotFoundError("Agreement was not found.");
      }

      assertCustomerCanPay(ctx, context);

      if (context.agreement.status !== "signed") {
        throw new ConflictError("Agreement must be signed before collecting a deposit.", {
          status: context.agreement.status,
        });
      }

      const stripeAccount = stripeAccountSummary(context.vendor);
      if (!stripeAccount.readyForPayments || !stripeAccount.accountId) {
        throw new BusinessRuleError("Vendor Stripe account is not ready for customer deposits.", {
          stripeAccount,
        });
      }

      const scheduleItem = findDepositScheduleItem(context, input.paymentScheduleItemId);
      let payment = existingPaymentForScheduleItem(context, scheduleItem.id);

      if (payment?.status === "succeeded") {
        throw new ConflictError("Deposit has already been paid.");
      }

      if (!payment) {
        payment = await repository.createPayment({
          agreementId: context.agreement.id,
          amountCents: scheduleItem.amountCents,
          currency: scheduleItem.currency,
          customerUserId: context.agreement.customerUserId,
          paymentScheduleItemId: scheduleItem.id,
          quoteId: context.agreement.quoteId,
          rfqId: context.agreement.rfqId,
          status: "requires_payment",
          type: "deposit",
          vendorId: context.agreement.vendorId,
        });
      }

      const attempt = await repository.createAttempt({
        amountCents: scheduleItem.amountCents,
        currency: scheduleItem.currency,
        idempotencyKey,
        metadata: {
          agreementId: context.agreement.id,
          paymentScheduleItemId: scheduleItem.id,
          source: "deposit_checkout_session",
        },
        paymentId: payment.id,
        status: "checkout_pending",
      });

      try {
        const checkout = await stripeClient.createDepositCheckoutSession({
          amountCents: scheduleItem.amountCents,
          cancelUrl: `${appBaseUrl}/customer/payments/deposits/${context.agreement.id}?status=cancelled`,
          connectedAccountId: stripeAccount.accountId,
          currency: scheduleItem.currency,
          customerUserId: context.agreement.customerUserId,
          idempotencyKey,
          metadata: {
            agreementId: context.agreement.id,
            paymentScheduleItemId: scheduleItem.id,
            rfqId: context.agreement.rfqId,
            vendorId: context.agreement.vendorId,
          },
          paymentId: payment.id,
          scheduleItemLabel: scheduleItem.label,
          successUrl: `${appBaseUrl}/customer/payments/deposits/${context.agreement.id}?status=success&paymentId=${payment.id}`,
          vendorBusinessName: context.vendor.businessName,
        });

        await repository.updatePayment(
          payment.id,
          {
            status: "checkout_created",
            stripeCheckoutSessionId: checkout.sessionId,
            stripePaymentIntentId: checkout.paymentIntentId,
          },
          now(),
        );
        await repository.updateAttempt(attempt.id, {
          metadata: {
            ...attempt.metadata,
            checkoutUrl: checkout.checkoutUrl,
          },
          status: "processing",
          stripeCheckoutSessionId: checkout.sessionId,
          stripePaymentIntentId: checkout.paymentIntentId,
        });
      } catch (error) {
        await repository.updatePayment(payment.id, { status: "failed" }, now());
        await repository.updateAttempt(attempt.id, {
          completedAt: now(),
          failureCode: "stripe_checkout_error",
          failureMessage: error instanceof Error ? error.message : "Stripe checkout failed.",
          status: "failed",
        });
        throw error;
      }

      const detail = await repository.findPaymentById(payment.id);
      if (!detail) {
        throw new NotFoundError("Payment was not found after checkout creation.");
      }

      return toPaymentResult(detail);
    },

    async getPayment(ctx, paymentId) {
      const detail = await repository.findPaymentById(paymentId);
      if (!detail) {
        throw new NotFoundError("Payment was not found.");
      }

      assertPaymentVisible(ctx, detail);
      return toPaymentResult(detail);
    },

    async listVendorPayments(ctx, vendorId, status) {
      assertVendorCanReadPayments(ctx, vendorId);
      const vendor = await repository.findVendorById(vendorId);
      if (!vendor) {
        throw new NotFoundError("Vendor was not found.");
      }

      const records = await repository.listVendorPayments(vendorId, status);
      return toVendorPaymentSummary(vendorId, vendor, records);
    },

    async handleStripeWebhook(rawBody, signature) {
      if (!signature) {
        throw new ValidationError("Stripe-Signature header is required.");
      }

      const event = stripeClient.constructWebhookEvent(rawBody, signature, stripeWebhookSecret);
      const existing = await repository.findWebhookEventByStripeEventId(event.id);

      if (existing) {
        return {
          duplicate: true,
          eventId: event.id,
          eventType: event.type,
          received: true,
          status:
            existing.status === "processed" || existing.status === "ignored"
              ? existing.status
              : "received",
        };
      }

      await repository.createWebhookEvent({
        eventType: event.type,
        payload: event as unknown as Record<string, unknown>,
        status: "received",
        stripeEventId: event.id,
      });

      try {
        await repository.transaction(async (repo) => {
          await processStripeEvent(repo, event);
        });
      } catch (error) {
        await repository.updateWebhookEvent(
          event.id,
          {
            lastError: error instanceof Error ? error.message : "Webhook processing failed.",
            status: "failed",
          },
          now(),
        );
        throw error;
      }

      const processed = await repository.findWebhookEventByStripeEventId(event.id);

      return {
        duplicate: false,
        eventId: event.id,
        eventType: event.type,
        received: true,
        status:
          processed?.status === "processed" || processed?.status === "ignored"
            ? processed.status
            : "received",
      };
    },
  };
}
