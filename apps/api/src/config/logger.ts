import pino, { type Logger, type LoggerOptions } from "pino";

import type { ApiEnv } from "./env.js";

const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "password",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.secret",
];

export function createLoggerOptions(env: Pick<ApiEnv, "logLevel" | "nodeEnv">): LoggerOptions {
  return {
    base: {
      environment: env.nodeEnv,
      service: "foodtruckzs-api",
    },
    level: env.logLevel,
    redact: {
      paths: REDACTED_PATHS,
      remove: true,
    },
  };
}

export function createLogger(env: Pick<ApiEnv, "logLevel" | "nodeEnv">): Logger {
  return pino(createLoggerOptions(env));
}
