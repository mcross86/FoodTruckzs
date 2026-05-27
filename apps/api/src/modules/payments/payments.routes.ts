import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { requireVendorMembership } from "../../shared/auth/require-vendor.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  createDepositCheckoutSessionSchema,
  createStripeOnboardingLinkSchema,
  listVendorPaymentsQuerySchema,
  paymentIdParamsSchema,
  vendorIdParamsSchema,
} from "./payments.dto.js";
import type { PaymentService } from "./payments.service.js";

type PaymentRouteDeps = {
  paymentService: PaymentService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function registerPaymentRoutes(
  app: FastifyInstance,
  deps: PaymentRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);
  const paymentCreationRateLimit = app.rateLimiters.paymentCreation;
  const requireVendorOwner = requireVendorMembership({ allowedRoles: ["owner"] });
  const requireVendorPaymentsRead = requireVendorMembership({
    allowedRoles: ["owner", "manager", "staff"],
  });

  app.post(
    "/api/v1/vendors/:vendorId/stripe-connect/onboarding-link",
    { preHandler: [authenticate, requireVendorOwner, paymentCreationRateLimit] },
    async (request, reply) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(createStripeOnboardingLinkSchema, request.body);
      const result = await deps.paymentService.createStripeOnboardingLink(
        request.requestContext,
        params.vendorId,
        dto,
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, result));
    },
  );

  app.get(
    "/api/v1/vendors/:vendorId/payments",
    { preHandler: [authenticate, requireVendorPaymentsRead] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const query = parseWithZod(listVendorPaymentsQuerySchema, request.query);
      const result = await deps.paymentService.listVendorPayments(
        request.requestContext,
        params.vendorId,
        query.status,
      );
      return envelope(request.requestContext.requestId, result);
    },
  );

  app.post(
    "/api/v1/payments/deposits/checkout-session",
    { preHandler: [authenticate, paymentCreationRateLimit] },
    async (request, reply) => {
      const dto = parseWithZod(createDepositCheckoutSessionSchema, request.body);
      const result = await deps.paymentService.createDepositCheckoutSession(
        request.requestContext,
        dto,
        headerValue(request.headers["idempotency-key"]),
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, result));
    },
  );

  app.get("/api/v1/payments/:paymentId", { preHandler: authenticate }, async (request) => {
    const params = parseWithZod(paymentIdParamsSchema, request.params);
    const result = await deps.paymentService.getPayment(request.requestContext, params.paymentId);
    return envelope(request.requestContext.requestId, result);
  });

  app.post("/api/v1/webhooks/stripe", async (request) => {
    const result = await deps.paymentService.handleStripeWebhook(
      request.rawBody ?? JSON.stringify(request.body ?? {}),
      headerValue(request.headers["stripe-signature"]),
    );
    return {
      received: result.received,
    };
  });
}
