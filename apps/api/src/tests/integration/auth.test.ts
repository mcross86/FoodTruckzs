import { randomUUID } from "node:crypto";
import type { OutgoingHttpHeaders } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { createAuthenticateMiddleware } from "../../shared/auth/authenticate.js";
import { requireVendorMembership } from "../../shared/auth/require-vendor.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { createTestEnv } from "../test-env.js";

const validPassword = "FoodTruck1234";

function cookieHeader(response: { headers: OutgoingHttpHeaders }): string {
  const setCookie = response.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : String(setCookie ?? "");

  if (!cookie) {
    throw new Error("Expected response to set a cookie.");
  }

  return cookie.split(";")[0]!;
}

async function buildAuthTestApp(repository = new InMemoryAuthRepository(), ttlSeconds = 900) {
  const app = await buildApp({
    authRepository: repository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv({
      jwtAccessTokenTtlSeconds: ttlSeconds,
    }),
  });

  return { app, repository };
}

async function registerUser(app: Awaited<ReturnType<typeof buildApp>>, email = "auth@example.com") {
  return app.inject({
    method: "POST",
    payload: {
      email,
      firstName: "Auth",
      lastName: "Tester",
      password: validPassword,
    },
    url: "/api/v1/auth/register",
  });
}

describe("auth routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("registers, authenticates me, refreshes, and logs out", async () => {
    const { app } = await buildAuthTestApp();
    apps.push(app);

    const registerResponse = await registerUser(app);
    expect(registerResponse.statusCode).toBe(201);
    const registerBody = registerResponse.json();
    const accessToken = registerBody.data.accessToken as string;
    const firstCookie = cookieHeader(registerResponse);

    expect(registerBody.data.user).toMatchObject({
      email: "auth@example.com",
      firstName: "Auth",
      globalRoles: ["customer"],
    });

    const meResponse = await app.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().data.user).toMatchObject({
      email: "auth@example.com",
      globalRoles: ["customer"],
    });

    const refreshResponse = await app.inject({
      headers: {
        cookie: firstCookie,
      },
      method: "POST",
      url: "/api/v1/auth/refresh",
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json().data.accessToken).toEqual(expect.any(String));

    const logoutResponse = await app.inject({
      headers: {
        authorization: `Bearer ${refreshResponse.json().data.accessToken as string}`,
        cookie: cookieHeader(refreshResponse),
      },
      method: "POST",
      url: "/api/v1/auth/logout",
    });

    expect(logoutResponse.statusCode).toBe(204);
  });

  it("rejects invalid login credentials with a generic error", async () => {
    const { app } = await buildAuthTestApp();
    apps.push(app);
    await registerUser(app, "invalid@example.com");

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "invalid@example.com",
        password: "wrong-password",
      },
      url: "/api/v1/auth/login",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
    });
  });

  it("rejects expired access tokens", async () => {
    const { app } = await buildAuthTestApp(new InMemoryAuthRepository(), -1);
    apps.push(app);
    const registerResponse = await registerUser(app, "expired-token@example.com");

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${registerResponse.json().data.accessToken as string}`,
      },
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("TOKEN_EXPIRED");
  });

  it("rejects expired and revoked sessions", async () => {
    const { app, repository } = await buildAuthTestApp();
    apps.push(app);
    const registerResponse = await registerUser(app, "expired-session@example.com");
    const accessToken = registerResponse.json().data.accessToken as string;
    const sessionId = [...repository.sessions.keys()][0]!;

    repository.expireSession(sessionId);

    const expiredResponse = await app.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(expiredResponse.statusCode).toBe(401);
    expect(expiredResponse.json().error.code).toBe("SESSION_EXPIRED");

    const { app: revokedApp, repository: revokedRepository } = await buildAuthTestApp();
    apps.push(revokedApp);
    const revokedRegisterResponse = await registerUser(revokedApp, "revoked-session@example.com");
    const revokedAccessToken = revokedRegisterResponse.json().data.accessToken as string;
    const revokedSessionId = [...revokedRepository.sessions.keys()][0]!;
    await revokedRepository.revokeSession(revokedSessionId, new Date());

    const revokedResponse = await revokedApp.inject({
      headers: {
        authorization: `Bearer ${revokedAccessToken}`,
      },
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(revokedResponse.statusCode).toBe(401);
    expect(revokedResponse.json().error.code).toBe("SESSION_REVOKED");
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const { app } = await buildAuthTestApp();
    apps.push(app);
    const registerResponse = await registerUser(app, "rotation@example.com");
    const originalCookie = cookieHeader(registerResponse);

    const refreshResponse = await app.inject({
      headers: {
        cookie: originalCookie,
      },
      method: "POST",
      url: "/api/v1/auth/refresh",
    });

    expect(refreshResponse.statusCode).toBe(200);

    const reuseResponse = await app.inject({
      headers: {
        cookie: originalCookie,
      },
      method: "POST",
      url: "/api/v1/auth/refresh",
    });

    expect(reuseResponse.statusCode).toBe(401);
    expect(reuseResponse.json().error.code).toBe("REFRESH_TOKEN_REUSED");

    const revokedAccessResponse = await app.inject({
      headers: {
        authorization: `Bearer ${refreshResponse.json().data.accessToken as string}`,
      },
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(revokedAccessResponse.statusCode).toBe(401);
    expect(revokedAccessResponse.json().error.code).toBe("SESSION_REVOKED");
  });

  it("denies vendor-scoped access without an active membership", async () => {
    const { app, repository } = await buildAuthTestApp();
    apps.push(app);
    app.get(
      "/test/vendors/:vendorId/guarded",
      {
        preHandler: [
          createAuthenticateMiddleware(app.authService),
          requireVendorMembership({ allowedRoles: ["owner", "manager"] }),
        ],
      },
      async (request) => ({
        data: {
          activeVendorId: request.requestContext.activeVendorId,
        },
      }),
    );

    await registerUser(app, "vendor-denied@example.com");
    const user = [...repository.users.values()][0]!;
    repository.users.set(user.id, {
      ...user,
      globalRoles: ["vendor_user"],
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email: "vendor-denied@example.com",
        password: validPassword,
      },
      url: "/api/v1/auth/login",
    });

    const response = await app.inject({
      headers: {
        authorization: `Bearer ${loginResponse.json().data.accessToken as string}`,
      },
      method: "GET",
      url: `/test/vendors/${randomUUID()}/guarded`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("VENDOR_ACCESS_DENIED");
  });
});
