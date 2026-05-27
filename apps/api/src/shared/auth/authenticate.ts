import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthService } from "../../modules/auth/auth.service.js";
import { AuthenticationError } from "../errors/app-error.js";

function extractBearerToken(authorizationHeader: string | undefined): string {
  const [scheme, token] = authorizationHeader?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw new AuthenticationError("Bearer access token is required.");
  }

  return token;
}

export function createAuthenticateMiddleware(authService: AuthService) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const accessToken = extractBearerToken(request.headers.authorization);
    const authenticatedContext = await authService.authenticateAccessToken(accessToken);

    request.requestContext = {
      ...request.requestContext,
      ...authenticatedContext,
    };
  };
}
