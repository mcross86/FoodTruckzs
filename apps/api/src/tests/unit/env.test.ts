import { describe, expect, it } from "vitest";

import { EnvValidationError, readApiEnv } from "../../config/env.js";

const baseEnv = {
  API_BASE_URL: "http://localhost:4000",
  API_HOST: "127.0.0.1",
  API_PORT: "4000",
  APP_BASE_URL: "http://localhost:3000",
  CORS_ORIGINS: "http://localhost:3000,http://localhost:3001",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/foodtruckzs_test",
  JWT_ACCESS_SECRET: "test-jwt-access-secret-at-least-32-characters",
  LOG_LEVEL: "debug",
  NODE_ENV: "test",
  REFRESH_TOKEN_SECRET: "test-refresh-token-secret-at-least-32-characters",
};

describe("readApiEnv", () => {
  it("validates and normalizes backend environment variables", () => {
    expect(readApiEnv(baseEnv)).toMatchObject({
      apiBaseUrl: "http://localhost:4000",
      appBaseUrl: "http://localhost:3000",
      corsOrigins: ["http://localhost:3000", "http://localhost:3001"],
      databaseUrl: "postgres://postgres:postgres@localhost:5432/foodtruckzs_test",
      host: "127.0.0.1",
      jwtAccessTokenTtlSeconds: 900,
      logLevel: "debug",
      nodeEnv: "test",
      port: 4000,
      refreshTokenTtlDays: 30,
    });
  });

  it("allows longer JWT access token TTL in development", () => {
    expect(
      readApiEnv({
        ...baseEnv,
        JWT_ACCESS_TOKEN_TTL_SECONDS: "28800",
        NODE_ENV: "development",
      }).jwtAccessTokenTtlSeconds,
    ).toBe(28_800);
  });

  it("rejects JWT access token TTL above one hour outside development", () => {
    expect(() =>
      readApiEnv({
        ...baseEnv,
        JWT_ACCESS_TOKEN_TTL_SECONDS: "7200",
        NODE_ENV: "production",
      }),
    ).toThrow(EnvValidationError);
  });

  it("throws a typed error for invalid configuration", () => {
    expect(() =>
      readApiEnv({
        ...baseEnv,
        API_PORT: "not-a-port",
      }),
    ).toThrow(EnvValidationError);
  });
});
