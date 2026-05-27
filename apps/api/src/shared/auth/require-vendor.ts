import type { FastifyReply, FastifyRequest } from "fastify";

import { VendorAccessDeniedError } from "../../modules/auth/auth.errors.js";
import type { VendorRole } from "../../modules/auth/auth.types.js";
import { AuthenticationError } from "../errors/app-error.js";

type RequireVendorOptions = {
  allowedRoles?: VendorRole[];
  paramName?: string;
};

function readRouteParam(request: FastifyRequest, paramName: string): string | undefined {
  if (typeof request.params !== "object" || request.params === null) {
    return undefined;
  }

  const value = (request.params as Record<string, unknown>)[paramName];
  return typeof value === "string" ? value : undefined;
}

export function requireVendorMembership(options: RequireVendorOptions = {}) {
  const paramName = options.paramName ?? "vendorId";

  return async function requireVendor(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.requestContext.userId) {
      throw new AuthenticationError();
    }

    const vendorId = readRouteParam(request, paramName);

    if (!vendorId) {
      throw new VendorAccessDeniedError();
    }

    const membership = request.requestContext.vendorMemberships.find(
      (candidate) => candidate.vendorId === vendorId && candidate.status === "active",
    );

    if (!membership) {
      throw new VendorAccessDeniedError();
    }

    if (options.allowedRoles && !options.allowedRoles.includes(membership.role)) {
      throw new VendorAccessDeniedError();
    }

    request.requestContext.activeVendorId = vendorId;
  };
}
