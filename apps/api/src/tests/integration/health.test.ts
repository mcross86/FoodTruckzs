import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { createTestEnv } from "../test-env.js";

async function buildTestApp(
  database: { close?: () => Promise<void>; ping?: () => Promise<void> } = {},
) {
  return buildApp({
    database: {
      close: database.close ?? vi.fn(async () => undefined),
      ping: database.ping ?? vi.fn(async () => undefined),
    },
    env: createTestEnv(),
  });
}

describe("health routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("returns process health with a request id", async () => {
    const app = await buildTestApp();
    apps.push(app);

    const response = await app.inject({
      headers: {
        "x-request-id": "req_test",
      },
      method: "GET",
      url: "/healthz",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("req_test");
    expect(response.json()).toEqual({
      data: {
        service: "foodtruckzs-api",
        status: "ok",
      },
      meta: {
        requestId: "req_test",
      },
    });
  });

  it("returns readiness when PostgreSQL is reachable", async () => {
    const ping = vi.fn(async () => undefined);
    const app = await buildTestApp({ ping });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/readyz",
    });

    expect(response.statusCode).toBe(200);
    expect(ping).toHaveBeenCalledOnce();
    expect(response.json()).toMatchObject({
      data: {
        dependencies: {
          database: "ok",
        },
        service: "foodtruckzs-api",
        status: "ok",
      },
    });
  });

  it("returns a consistent 503 error when PostgreSQL is unavailable", async () => {
    const app = await buildTestApp({
      ping: vi.fn(async () => {
        throw new Error("connection refused");
      }),
    });
    apps.push(app);

    const response = await app.inject({
      headers: {
        "x-request-id": "req_down",
      },
      method: "GET",
      url: "/readyz",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: "DATABASE_UNAVAILABLE",
        details: {
          database: "unavailable",
        },
        message: "API dependencies are not ready.",
        requestId: "req_down",
      },
    });
  });
});
