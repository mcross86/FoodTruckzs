import type { FastifyInstance } from "fastify";

import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import {
  notificationListQuerySchema,
  notificationParamsSchema,
  updateNotificationPreferencesSchema,
} from "./notifications.dto.js";
import type { NotificationService } from "./notifications.service.js";

type NotificationRouteDeps = {
  notificationService: NotificationService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerNotificationRoutes(
  app: FastifyInstance,
  deps: NotificationRouteDeps,
): Promise<void> {
  const authenticate = createAuthenticateMiddleware(app.authService);

  app.get("/api/v1/notifications", { preHandler: authenticate }, async (request) => {
    const query = parseWithZod(notificationListQuerySchema, request.query);
    const result = await deps.notificationService.listNotifications(request.requestContext, query);
    return envelope(request.requestContext.requestId, result);
  });

  app.post(
    "/api/v1/notifications/:notificationId/read",
    { preHandler: authenticate },
    async (request) => {
      const params = parseWithZod(notificationParamsSchema, request.params);
      const result = await deps.notificationService.markRead(
        request.requestContext,
        params.notificationId,
      );
      return envelope(request.requestContext.requestId, result);
    },
  );

  app.post("/api/v1/notifications/read-all", { preHandler: authenticate }, async (request) => {
    const result = await deps.notificationService.markAllRead(request.requestContext);
    return envelope(request.requestContext.requestId, result);
  });

  app.get("/api/v1/notification-preferences", { preHandler: authenticate }, async (request) => {
    const preferences = await deps.notificationService.listPreferences(request.requestContext);
    return envelope(request.requestContext.requestId, preferences);
  });

  app.post("/api/v1/notification-preferences", { preHandler: authenticate }, async (request) => {
    const dto = parseWithZod(updateNotificationPreferencesSchema, request.body);
    const preferences = await deps.notificationService.updatePreferences(
      request.requestContext,
      dto,
    );
    return envelope(request.requestContext.requestId, preferences);
  });
}
