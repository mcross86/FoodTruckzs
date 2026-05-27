import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { requireGlobalRole } from "../../shared/auth/require-role.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  adminDisputeStatusSchema,
  adminNoteSchema,
  adminPaymentListQuerySchema,
  adminRfqListQuerySchema,
  adminRfqParamsSchema,
  adminVendorListQuerySchema,
  adminVendorParamsSchema,
  adminWebhookListQuerySchema,
  marketplaceVisibilitySchema,
  vendorApprovalDecisionSchema,
  vendorRejectionSchema,
  vendorRequestChangesSchema,
} from "./admin.dto.js";
import type { AdminService } from "./admin.service.js";

type AdminRouteDeps = {
  adminService: AdminService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  deps: AdminRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);
  const requireAdminRead = requireGlobalRole(["platform_admin", "support_admin"]);
  const requirePlatformAdmin = requireGlobalRole(["platform_admin"]);

  app.get(
    "/api/v1/admin/dashboard",
    { preHandler: [authenticate, requireAdminRead] },
    async (request) => {
      const dashboard = await deps.adminService.getDashboard(request.requestContext);
      return envelope(request.requestContext.requestId, dashboard);
    },
  );

  app.get(
    "/api/v1/admin/vendors",
    { preHandler: [authenticate, requireAdminRead] },
    async (request) => {
      const query = parseWithZod(adminVendorListQuerySchema, request.query);
      const vendors = await deps.adminService.listVendors(request.requestContext, query);
      return envelope(request.requestContext.requestId, vendors);
    },
  );

  app.get(
    "/api/v1/admin/vendors/:vendorId",
    { preHandler: [authenticate, requireAdminRead] },
    async (request) => {
      const params = parseWithZod(adminVendorParamsSchema, request.params);
      const vendor = await deps.adminService.getVendorReview(
        request.requestContext,
        params.vendorId,
      );
      return envelope(request.requestContext.requestId, vendor);
    },
  );

  app.post(
    "/api/v1/admin/vendors/:vendorId/approve",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(adminVendorParamsSchema, request.params);
      const dto = parseWithZod(vendorApprovalDecisionSchema, request.body);
      const vendor = await deps.adminService.approveVendor(
        request.requestContext,
        params.vendorId,
        dto,
      );
      return envelope(request.requestContext.requestId, vendor);
    },
  );

  app.post(
    "/api/v1/admin/vendors/:vendorId/reject",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(adminVendorParamsSchema, request.params);
      const dto = parseWithZod(vendorRejectionSchema, request.body);
      const vendor = await deps.adminService.rejectVendor(
        request.requestContext,
        params.vendorId,
        dto,
      );
      return envelope(request.requestContext.requestId, vendor);
    },
  );

  app.post(
    "/api/v1/admin/vendors/:vendorId/request-changes",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(adminVendorParamsSchema, request.params);
      const dto = parseWithZod(vendorRequestChangesSchema, request.body);
      const vendor = await deps.adminService.requestVendorChanges(
        request.requestContext,
        params.vendorId,
        dto,
      );
      return envelope(request.requestContext.requestId, vendor);
    },
  );

  app.patch(
    "/api/v1/admin/vendors/:vendorId/marketplace-visibility",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(adminVendorParamsSchema, request.params);
      const dto = parseWithZod(marketplaceVisibilitySchema, request.body);
      const vendor = await deps.adminService.setMarketplaceVisibility(
        request.requestContext,
        params.vendorId,
        dto,
      );
      return envelope(request.requestContext.requestId, vendor);
    },
  );

  app.get(
    "/api/v1/admin/rfqs",
    { preHandler: [authenticate, requireAdminRead] },
    async (request) => {
      const query = parseWithZod(adminRfqListQuerySchema, request.query);
      const rfqs = await deps.adminService.listRfqs(request.requestContext, query);
      return envelope(request.requestContext.requestId, rfqs);
    },
  );

  app.get(
    "/api/v1/admin/rfqs/:rfqId",
    { preHandler: [authenticate, requireAdminRead] },
    async (request) => {
      const params = parseWithZod(adminRfqParamsSchema, request.params);
      const rfq = await deps.adminService.getRfqReview(request.requestContext, params.rfqId);
      return envelope(request.requestContext.requestId, rfq);
    },
  );

  app.post(
    "/api/v1/admin/rfqs/:rfqId/notes",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(adminRfqParamsSchema, request.params);
      const dto = parseWithZod(adminNoteSchema, request.body);
      const rfq = await deps.adminService.addRfqAdminNote(
        request.requestContext,
        params.rfqId,
        dto.note,
      );
      return envelope(request.requestContext.requestId, rfq);
    },
  );

  app.patch(
    "/api/v1/admin/rfqs/:rfqId/dispute",
    { preHandler: [authenticate, requirePlatformAdmin] },
    async (request) => {
      const params = parseWithZod(adminRfqParamsSchema, request.params);
      const dto = parseWithZod(adminDisputeStatusSchema, request.body);
      const rfq = await deps.adminService.updateRfqDisputeStatus(
        request.requestContext,
        params.rfqId,
        dto,
      );
      return envelope(request.requestContext.requestId, rfq);
    },
  );

  app.get(
    "/api/v1/admin/payments",
    { preHandler: [authenticate, requireAdminRead] },
    async (request) => {
      const query = parseWithZod(adminPaymentListQuerySchema, request.query);
      const payments = await deps.adminService.listPayments(request.requestContext, query);
      return envelope(request.requestContext.requestId, payments);
    },
  );

  app.get(
    "/api/v1/admin/stripe-webhooks",
    { preHandler: [authenticate, requireAdminRead] },
    async (request) => {
      const query = parseWithZod(adminWebhookListQuerySchema, request.query);
      const events = await deps.adminService.listWebhooks(request.requestContext, query);
      return envelope(request.requestContext.requestId, events);
    },
  );
}
