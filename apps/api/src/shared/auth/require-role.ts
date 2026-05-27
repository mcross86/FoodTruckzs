import type { FastifyReply, FastifyRequest } from "fastify";

import { RoleAccessDeniedError } from "../../modules/auth/auth.errors.js";
import type { GlobalRole } from "../../modules/auth/auth.types.js";
import { AuthenticationError } from "../errors/app-error.js";

export function requireGlobalRole(allowedRoles: GlobalRole[]) {
  return async function requireRole(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.requestContext.userId) {
      throw new AuthenticationError();
    }

    const hasRole = request.requestContext.globalRoles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      throw new RoleAccessDeniedError();
    }
  };
}
