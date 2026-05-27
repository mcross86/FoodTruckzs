import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { FastifyInstance } from "fastify";

import type {
  GlobalRole,
  UserSummary,
  VendorMembershipSummary,
} from "../../modules/auth/auth.types.js";

export const REQUEST_ID_HEADER = "x-request-id";

export type RequestContext = {
  activeVendorId?: string;
  globalRoles: GlobalRole[];
  ipAddress?: string;
  requestId: string;
  sessionId?: string;
  user?: UserSummary;
  userId?: string;
  userAgent?: string;
  vendorMemberships: VendorMembershipSummary[];
};

declare module "fastify" {
  interface FastifyRequest {
    requestContext: RequestContext;
  }
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function createRequestId(request: IncomingMessage): string {
  const inboundRequestId = firstHeaderValue(request.headers[REQUEST_ID_HEADER]);

  if (inboundRequestId?.trim()) {
    return inboundRequestId.trim();
  }

  return `req_${randomUUID()}`;
}

export async function registerRequestContext(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    request.requestContext = {
      globalRoles: [],
      ipAddress: request.ip,
      requestId: request.id,
      userAgent: request.headers["user-agent"],
      vendorMemberships: [],
    };

    reply.header(REQUEST_ID_HEADER, request.id);
  });
}
