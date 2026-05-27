import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { ApiEnv } from "../../config/env.js";
import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { AuthenticationError } from "../../shared/errors/app-error.js";
import { parseWithZod } from "../../shared/validation/zod.js";
import { loginRequestSchema, registerRequestSchema } from "./auth.dto.js";
import type { AuthService, SessionRequestMetadata } from "./auth.service.js";
import type { AuthResponse, AuthServiceResult } from "./auth.types.js";

export const REFRESH_TOKEN_COOKIE_NAME = "ftz_refresh_token";

type AuthRouteDeps = {
  authService: AuthService;
  env: Pick<ApiEnv, "nodeEnv">;
};

function requestMetadata(request: FastifyRequest): SessionRequestMetadata {
  return {
    ipAddress: request.requestContext.ipAddress,
    userAgent: request.requestContext.userAgent,
  };
}

function cookieOptions(env: Pick<ApiEnv, "nodeEnv">, expires?: Date) {
  return {
    expires,
    httpOnly: true,
    path: "/api/v1/auth",
    sameSite: "lax" as const,
    secure: env.nodeEnv === "production",
  };
}

function setRefreshCookie(
  reply: FastifyReply,
  env: Pick<ApiEnv, "nodeEnv">,
  result: AuthServiceResult,
): void {
  reply.setCookie(
    REFRESH_TOKEN_COOKIE_NAME,
    result.refreshToken,
    cookieOptions(env, result.refreshTokenExpiresAt),
  );
}

function clearRefreshCookie(reply: FastifyReply, env: Pick<ApiEnv, "nodeEnv">): void {
  reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, cookieOptions(env));
}

function responseBody(result: AuthServiceResult): AuthResponse {
  return {
    accessToken: result.accessToken,
    accessTokenExpiresInSeconds: result.accessTokenExpiresInSeconds,
    user: result.user,
    vendorMemberships: result.vendorMemberships,
  };
}

function readRefreshToken(request: FastifyRequest): string {
  const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE_NAME];

  if (!refreshToken) {
    throw new AuthenticationError("Refresh token is required.");
  }

  return refreshToken;
}

export async function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): Promise<void> {
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const authRateLimit = app.rateLimiters.auth;

  app.post("/api/v1/auth/register", { preHandler: authRateLimit }, async (request, reply) => {
    const dto = parseWithZod(registerRequestSchema, request.body);
    const result = await deps.authService.register(dto, requestMetadata(request));
    setRefreshCookie(reply, deps.env, result);

    return reply.code(201).send({
      data: responseBody(result),
      meta: {
        requestId: request.requestContext.requestId,
      },
    });
  });

  app.post("/api/v1/auth/login", { preHandler: authRateLimit }, async (request, reply) => {
    const dto = parseWithZod(loginRequestSchema, request.body);
    const result = await deps.authService.login(dto, requestMetadata(request));
    setRefreshCookie(reply, deps.env, result);

    return {
      data: responseBody(result),
      meta: {
        requestId: request.requestContext.requestId,
      },
    };
  });

  app.post("/api/v1/auth/refresh", { preHandler: authRateLimit }, async (request, reply) => {
    const result = await deps.authService.refresh(
      readRefreshToken(request),
      requestMetadata(request),
    );
    setRefreshCookie(reply, deps.env, result);

    return {
      data: {
        accessToken: result.accessToken,
        accessTokenExpiresInSeconds: result.accessTokenExpiresInSeconds,
      },
      meta: {
        requestId: request.requestContext.requestId,
      },
    };
  });

  app.post("/api/v1/auth/logout", { preHandler: authenticate }, async (request, reply) => {
    await deps.authService.logout(request.requestContext.sessionId!);
    clearRefreshCookie(reply, deps.env);
    return reply.code(204).send();
  });

  app.get("/api/v1/auth/me", { preHandler: authenticate }, async (request) => {
    return {
      data: {
        activeVendorId: request.requestContext.activeVendorId,
        globalRoles: request.requestContext.globalRoles,
        sessionId: request.requestContext.sessionId,
        user: request.requestContext.user,
        vendorMemberships: request.requestContext.vendorMemberships,
      },
      meta: {
        requestId: request.requestContext.requestId,
      },
    };
  });
}
