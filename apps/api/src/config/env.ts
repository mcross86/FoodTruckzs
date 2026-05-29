import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { z } from "zod";

import { AppError } from "../shared/errors/app-error.js";

let localEnvLoaded = false;

function findLocalEnvFile(startDirectory: string): string | null {
  let currentDirectory = startDirectory;

  while (true) {
    const candidate = join(currentDirectory, ".env");

    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

function loadLocalEnvFile(): void {
  if (localEnvLoaded || process.env.FOODTRUCKZS_SKIP_ENV_FILE === "true") {
    return;
  }

  localEnvLoaded = true;

  const envFilePath = findLocalEnvFile(process.cwd());

  if (envFilePath) {
    process.loadEnvFile(envFilePath);
  }
}

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

const PRODUCTION_JWT_ACCESS_TOKEN_TTL_MAX_SECONDS = 3_600;
const DEVELOPMENT_JWT_ACCESS_TOKEN_TTL_MAX_SECONDS = 604_800;

function jwtAccessTokenTtlDefault(): number {
  return process.env.NODE_ENV === "development" ? 28_800 : 900;
}

const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  LOG_LEVEL: logLevelSchema.default("info"),
  API_HOST: z.string().trim().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().max(65535).default(4000),
  APP_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  CORS_ORIGINS: z
    .string()
    .trim()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().url(),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().max(20).default(5),
  REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MESSAGING_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MESSAGING_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_PAYMENT_CREATION_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_PAYMENT_CREATION_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
  RATE_LIMIT_RFQ_SUBMISSION_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_RFQ_SUBMISSION_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(DEVELOPMENT_JWT_ACCESS_TOKEN_TTL_MAX_SECONDS)
    .default(jwtAccessTokenTtlDefault()),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(60).default(30),
  STRIPE_SECRET_KEY: z.string().trim().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().trim().default(""),
  FILE_STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  FILE_STORAGE_LOCAL_ROOT: z.string().trim().min(1).default(".local-storage"),
  FILE_STORAGE_BUCKET: z.string().trim().min(1).default("foodtruckzs-dev"),
  FILE_STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  FILE_STORAGE_SIGNING_SECRET: z.string().min(32).optional(),
  OBJECT_STORAGE_ENDPOINT: z.string().trim().optional().default(""),
  OBJECT_STORAGE_REGION: z.string().trim().min(1).default("auto"),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().trim().optional().default(""),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().trim().optional().default(""),
});

export type ApiEnv = {
  apiBaseUrl: string;
  appBaseUrl: string;
  corsOrigins: string[];
  databaseMaxConnections: number;
  databaseUrl: string;
  host: string;
  jwtAccessSecret: string;
  jwtAccessTokenTtlSeconds: number;
  logLevel: z.infer<typeof logLevelSchema>;
  nodeEnv: z.infer<typeof nodeEnvSchema>;
  port: number;
  refreshTokenSecret: string;
  refreshTokenTtlDays: number;
  rateLimitAuthMax: number;
  rateLimitAuthWindowMs: number;
  rateLimitMessagingMax: number;
  rateLimitMessagingWindowMs: number;
  rateLimitPaymentCreationMax: number;
  rateLimitPaymentCreationWindowMs: number;
  rateLimitRfqSubmissionMax: number;
  rateLimitRfqSubmissionWindowMs: number;
  requestBodyLimitBytes: number;
  fileStorageAccessKeyId: string;
  fileStorageBucket: string;
  fileStorageEndpoint: string;
  fileStorageLocalRoot: string;
  fileStorageProvider: "local" | "s3";
  fileStorageRegion: string;
  fileStorageSecretAccessKey: string;
  fileStorageSignedUrlTtlSeconds: number;
  fileStorageSigningSecret: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
};

export class EnvValidationError extends AppError {
  constructor(details: Record<string, unknown>) {
    super({
      code: "ENV_VALIDATION_FAILED",
      details,
      httpStatus: 500,
      message: "Environment configuration is invalid.",
    });
  }
}

export function readApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  if (env === process.env) {
    loadLocalEnvFile();
  }

  const parsed = apiEnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new EnvValidationError({
      issues: parsed.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join("."),
      })),
    });
  }

  const maxJwtAccessTokenTtlSeconds =
    parsed.data.NODE_ENV === "development"
      ? DEVELOPMENT_JWT_ACCESS_TOKEN_TTL_MAX_SECONDS
      : PRODUCTION_JWT_ACCESS_TOKEN_TTL_MAX_SECONDS;

  if (parsed.data.JWT_ACCESS_TOKEN_TTL_SECONDS > maxJwtAccessTokenTtlSeconds) {
    throw new EnvValidationError({
      issues: [
        {
          message: `JWT access token TTL cannot exceed ${maxJwtAccessTokenTtlSeconds} seconds in ${parsed.data.NODE_ENV}.`,
          path: "JWT_ACCESS_TOKEN_TTL_SECONDS",
        },
      ],
    });
  }

  return {
    apiBaseUrl: parsed.data.API_BASE_URL,
    appBaseUrl: parsed.data.APP_BASE_URL,
    corsOrigins: parsed.data.CORS_ORIGINS,
    databaseMaxConnections: parsed.data.DATABASE_MAX_CONNECTIONS,
    databaseUrl: parsed.data.DATABASE_URL,
    host: parsed.data.API_HOST,
    jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
    jwtAccessTokenTtlSeconds: parsed.data.JWT_ACCESS_TOKEN_TTL_SECONDS,
    logLevel: parsed.data.LOG_LEVEL,
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.API_PORT,
    rateLimitAuthMax: parsed.data.RATE_LIMIT_AUTH_MAX,
    rateLimitAuthWindowMs: parsed.data.RATE_LIMIT_AUTH_WINDOW_MS,
    rateLimitMessagingMax: parsed.data.RATE_LIMIT_MESSAGING_MAX,
    rateLimitMessagingWindowMs: parsed.data.RATE_LIMIT_MESSAGING_WINDOW_MS,
    rateLimitPaymentCreationMax: parsed.data.RATE_LIMIT_PAYMENT_CREATION_MAX,
    rateLimitPaymentCreationWindowMs: parsed.data.RATE_LIMIT_PAYMENT_CREATION_WINDOW_MS,
    rateLimitRfqSubmissionMax: parsed.data.RATE_LIMIT_RFQ_SUBMISSION_MAX,
    rateLimitRfqSubmissionWindowMs: parsed.data.RATE_LIMIT_RFQ_SUBMISSION_WINDOW_MS,
    refreshTokenSecret: parsed.data.REFRESH_TOKEN_SECRET,
    refreshTokenTtlDays: parsed.data.REFRESH_TOKEN_TTL_DAYS,
    requestBodyLimitBytes: parsed.data.REQUEST_BODY_LIMIT_BYTES,
    fileStorageAccessKeyId: parsed.data.OBJECT_STORAGE_ACCESS_KEY_ID,
    fileStorageBucket: parsed.data.FILE_STORAGE_BUCKET,
    fileStorageEndpoint: parsed.data.OBJECT_STORAGE_ENDPOINT,
    fileStorageLocalRoot: parsed.data.FILE_STORAGE_LOCAL_ROOT,
    fileStorageProvider: parsed.data.FILE_STORAGE_PROVIDER,
    fileStorageRegion: parsed.data.OBJECT_STORAGE_REGION,
    fileStorageSecretAccessKey: parsed.data.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    fileStorageSignedUrlTtlSeconds: parsed.data.FILE_STORAGE_SIGNED_URL_TTL_SECONDS,
    fileStorageSigningSecret:
      parsed.data.FILE_STORAGE_SIGNING_SECRET ?? parsed.data.REFRESH_TOKEN_SECRET,
    stripeSecretKey: parsed.data.STRIPE_SECRET_KEY,
    stripeWebhookSecret: parsed.data.STRIPE_WEBHOOK_SECRET,
  };
}
