import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { requireVendorMembership } from "../../shared/auth/require-vendor.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  acceptRfqTargetSchema,
  createRfqSchema,
  markThreadReadSchema,
  messageThreadParamsSchema,
  rejectRfqTargetSchema,
  requestClarificationSchema,
  rfqIdParamsSchema,
  rfqListQuerySchema,
  rfqTargetActionParamsSchema,
  sendThreadMessageSchema,
  vendorRfqListParamsSchema,
} from "./rfqs.dto.js";
import type { RfqService } from "./rfqs.service.js";

type RfqRouteDeps = {
  rfqService: RfqService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerRfqRoutes(app: FastifyInstance, deps: RfqRouteDeps): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);
  const messagingRateLimit = app.rateLimiters.messaging;
  const rfqSubmissionRateLimit = app.rateLimiters.rfqSubmission;
  const requireVendorRead = requireVendorMembership();

  app.post(
    "/api/v1/rfqs",
    { preHandler: [authenticate, rfqSubmissionRateLimit] },
    async (request, reply) => {
      const dto = parseWithZod(createRfqSchema, request.body);
      const rfq = await deps.rfqService.createRfq(request.requestContext, dto);
      return reply.code(201).send(envelope(request.requestContext.requestId, rfq));
    },
  );

  app.get("/api/v1/rfqs/:rfqId", { preHandler: authenticate }, async (request) => {
    const params = parseWithZod(rfqIdParamsSchema, request.params);
    const rfq = await deps.rfqService.getRfqDetail(request.requestContext, params.rfqId);
    return envelope(request.requestContext.requestId, rfq);
  });

  app.get("/api/v1/customers/me/rfqs", { preHandler: authenticate }, async (request) => {
    const query = parseWithZod(rfqListQuerySchema, request.query);
    const rfqs = await deps.rfqService.listCustomerRfqs(request.requestContext, query);
    return envelope(request.requestContext.requestId, rfqs);
  });

  app.get(
    "/api/v1/vendors/:vendorId/rfqs",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(vendorRfqListParamsSchema, request.params);
      const query = parseWithZod(rfqListQuerySchema, request.query);
      const rfqs = await deps.rfqService.listVendorRfqs(
        request.requestContext,
        params.vendorId,
        query,
      );
      return envelope(request.requestContext.requestId, rfqs);
    },
  );

  app.post(
    "/api/v1/rfqs/:rfqId/vendor-targets/:targetId/accept",
    { preHandler: authenticate },
    async (request) => {
      const params = parseWithZod(rfqTargetActionParamsSchema, request.params);
      const dto = parseWithZod(acceptRfqTargetSchema, request.body);
      const rfq = await deps.rfqService.acceptTarget(
        request.requestContext,
        params.rfqId,
        params.targetId,
        dto,
      );
      return envelope(request.requestContext.requestId, rfq);
    },
  );

  app.post(
    "/api/v1/rfqs/:rfqId/vendor-targets/:targetId/reject",
    { preHandler: authenticate },
    async (request) => {
      const params = parseWithZod(rfqTargetActionParamsSchema, request.params);
      const dto = parseWithZod(rejectRfqTargetSchema, request.body);
      const rfq = await deps.rfqService.rejectTarget(
        request.requestContext,
        params.rfqId,
        params.targetId,
        dto,
      );
      return envelope(request.requestContext.requestId, rfq);
    },
  );

  app.post(
    "/api/v1/rfqs/:rfqId/request-clarification",
    { preHandler: [authenticate, messagingRateLimit] },
    async (request, reply) => {
      const params = parseWithZod(rfqIdParamsSchema, request.params);
      const dto = parseWithZod(requestClarificationSchema, request.body);
      const rfq = await deps.rfqService.requestClarification(
        request.requestContext,
        params.rfqId,
        dto,
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, rfq));
    },
  );

  app.get(
    "/api/v1/message-threads/:threadId/messages",
    { preHandler: authenticate },
    async (request) => {
      const params = parseWithZod(messageThreadParamsSchema, request.params);
      const messages = await deps.rfqService.getThreadMessages(
        request.requestContext,
        params.threadId,
      );
      return envelope(request.requestContext.requestId, messages);
    },
  );

  app.post(
    "/api/v1/message-threads/:threadId/messages",
    { preHandler: [authenticate, messagingRateLimit] },
    async (request, reply) => {
      const params = parseWithZod(messageThreadParamsSchema, request.params);
      const dto = parseWithZod(sendThreadMessageSchema, request.body);
      const rfq = await deps.rfqService.sendThreadMessage(
        request.requestContext,
        params.threadId,
        dto,
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, rfq));
    },
  );

  app.post(
    "/api/v1/message-threads/:threadId/read",
    { preHandler: authenticate },
    async (request) => {
      const params = parseWithZod(messageThreadParamsSchema, request.params);
      const dto = parseWithZod(markThreadReadSchema, request.body);
      const rfq = await deps.rfqService.markThreadRead(
        request.requestContext,
        params.threadId,
        dto,
      );
      return envelope(request.requestContext.requestId, rfq);
    },
  );
}
