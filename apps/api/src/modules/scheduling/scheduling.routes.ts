import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { requireVendorMembership } from "../../shared/auth/require-vendor.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  calendarEventIdParamsSchema,
  createCalendarEventSchema,
  listCalendarEventsQuerySchema,
  vendorIdParamsSchema,
} from "./scheduling.dto.js";
import type { SchedulingService } from "./scheduling.service.js";

type SchedulingRouteDeps = {
  schedulingService: SchedulingService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerSchedulingRoutes(
  app: FastifyInstance,
  deps: SchedulingRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);
  const requireVendorRead = requireVendorMembership();
  const requireVendorWrite = requireVendorMembership({
    allowedRoles: ["owner", "manager", "staff"],
  });

  app.get(
    "/api/v1/vendors/:vendorId/calendar-events",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const query = parseWithZod(listCalendarEventsQuerySchema, request.query);
      const result = await deps.schedulingService.listCalendarEvents(
        request.requestContext,
        params.vendorId,
        query,
      );
      return envelope(request.requestContext.requestId, result);
    },
  );

  app.post(
    "/api/v1/vendors/:vendorId/calendar-events",
    { preHandler: [authenticate, requireVendorWrite] },
    async (request, reply) => {
      const params = parseWithZod(vendorIdParamsSchema, request.params);
      const dto = parseWithZod(createCalendarEventSchema, request.body);
      const result = await deps.schedulingService.createManualEvent(
        request.requestContext,
        params.vendorId,
        dto,
      );
      return reply.code(201).send(envelope(request.requestContext.requestId, result));
    },
  );

  app.get(
    "/api/v1/vendors/:vendorId/calendar-events/:eventId/operations",
    { preHandler: [authenticate, requireVendorRead] },
    async (request) => {
      const params = parseWithZod(calendarEventIdParamsSchema, request.params);
      const result = await deps.schedulingService.getEventOperationsDetail(
        request.requestContext,
        params.vendorId,
        params.eventId,
      );
      return envelope(request.requestContext.requestId, result);
    },
  );
}
