import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { requireGlobalRole } from "../../shared/auth/require-role.js";
import { requireVendorMembership } from "../../shared/auth/require-vendor.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  createVendorInvoiceSchema,
  platformBillingQuerySchema,
  vendorBillingParamsSchema,
} from "./billing.dto.js";
import type { BillingService } from "./billing.service.js";

type BillingRouteDeps = {
  billingService: BillingService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerBillingRoutes(
  app: FastifyInstance,
  deps: BillingRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);
  const requireVendorBillingAccess = requireVendorMembership({
    allowedRoles: ["owner", "manager"],
  });
  const requirePlatformAdmin = requireGlobalRole(["platform_admin"]);

  app.get(
    "/api/v1/vendors/:vendorId/platform-billing",
    { preHandler: [authenticate, requireVendorBillingAccess] },
    async (request) => {
      const params = parseWithZod(vendorBillingParamsSchema, request.params);
      const billing = await deps.billingService.getVendorPlatformBilling(params.vendorId);
      return envelope(request.requestContext.requestId, billing);
    },
  );

  app.get(
    "/api/v1/admin/platform-billing",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const query = parseWithZod(platformBillingQuerySchema, request.query);
      const billing = await deps.billingService.getAdminPlatformBilling(query.vendorId);
      return envelope(request.requestContext.requestId, billing);
    },
  );

  app.post(
    "/api/v1/admin/vendor-invoices",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request, reply) => {
      const dto = parseWithZod(createVendorInvoiceSchema, request.body);
      const invoice = await deps.billingService.createVendorInvoice(request.requestContext, dto);
      return reply.code(201).send(envelope(request.requestContext.requestId, invoice));
    },
  );
}
