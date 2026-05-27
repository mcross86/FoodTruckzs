import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { ApiEnv } from "../../config/env.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { createTestEnv } from "../test-env.js";

async function buildHardeningApp(overrides: Partial<ApiEnv> = {}) {
  return buildApp({
    authRepository: new InMemoryAuthRepository(),
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(overrides),
  });
}

function validRegistration(email: string) {
  return {
    email,
    firstName: "Hardening",
    lastName: "Tester",
    password: "StrongerPassword123!",
  };
}

describe("API production hardening", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("returns consistent validation errors with request correlation", async () => {
    const app = await buildHardeningApp();
    apps.push(app);

    const response = await app.inject({
      headers: {
        origin: "http://localhost:3000",
        "x-request-id": "req_validation_consistency",
      },
      method: "POST",
      payload: {
        email: "not-an-email",
      },
      url: "/api/v1/auth/register",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["x-request-id"]).toBe("req_validation_consistency");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.json()).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: {
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "email" }),
            expect.objectContaining({ path: "password" }),
          ]),
        },
        requestId: "req_validation_consistency",
      },
    });
  });

  it("applies secure headers, strict CORS allowlist behavior, and body limits", async () => {
    const app = await buildHardeningApp({ requestBodyLimitBytes: 200 });
    apps.push(app);

    const allowedResponse = await app.inject({
      headers: { origin: "http://localhost:3000" },
      method: "GET",
      url: "/healthz",
    });
    const disallowedResponse = await app.inject({
      headers: { origin: "https://evil.example" },
      method: "GET",
      url: "/healthz",
    });
    const bodyLimitResponse = await app.inject({
      headers: { "content-type": "application/json" },
      method: "POST",
      payload: JSON.stringify({
        ...validRegistration("body-limit@example.com"),
        firstName: "X".repeat(500),
      }),
      url: "/api/v1/auth/register",
    });

    expect(allowedResponse.statusCode).toBe(200);
    expect(allowedResponse.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowedResponse.headers["x-content-type-options"]).toBe("nosniff");
    expect(allowedResponse.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(disallowedResponse.headers["access-control-allow-origin"]).toBeUndefined();

    expect(bodyLimitResponse.statusCode).toBe(413);
    expect(bodyLimitResponse.json()).toMatchObject({
      error: {
        code: "FST_ERR_CTP_BODY_TOO_LARGE",
        requestId: expect.stringMatching(/^req_/),
      },
    });
  });

  it("rate limits auth endpoints with a consistent error envelope", async () => {
    const app = await buildHardeningApp({
      rateLimitAuthMax: 1,
      rateLimitAuthWindowMs: 60_000,
    });
    apps.push(app);

    const first = await app.inject({
      method: "POST",
      payload: validRegistration("rate-limit@example.com"),
      url: "/api/v1/auth/register",
    });
    const second = await app.inject({
      method: "POST",
      payload: validRegistration("rate-limit@example.com"),
      url: "/api/v1/auth/register",
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(429);
    expect(second.headers["retry-after"]).toBeDefined();
    expect(second.json()).toMatchObject({
      error: {
        code: "RATE_LIMITED",
        details: {
          limit: 1,
          windowSeconds: 60,
        },
        requestId: expect.stringMatching(/^req_/),
      },
    });
  });
});
