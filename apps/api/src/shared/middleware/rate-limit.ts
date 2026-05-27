import type { FastifyReply, FastifyRequest } from "fastify";

import type { ApiEnv } from "../../config/env.js";
import { RateLimitError } from "../errors/app-error.js";

type RateLimitOptions = {
  keyGenerator?: (request: FastifyRequest) => string;
  max: number;
  name: string;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitMiddleware = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export type ApiRateLimiters = {
  auth: RateLimitMiddleware;
  messaging: RateLimitMiddleware;
  paymentCreation: RateLimitMiddleware;
  rfqSubmission: RateLimitMiddleware;
};

function bodyEmail(request: FastifyRequest): string {
  const body = request.body;

  if (body && typeof body === "object" && "email" in body) {
    const email = (body as { email?: unknown }).email;
    if (typeof email === "string" && email.trim()) {
      return email.trim().toLowerCase();
    }
  }

  return "unknown-email";
}

function userOrIp(request: FastifyRequest): string {
  return request.requestContext?.userId ?? request.ip;
}

function routeScopedUserOrIp(request: FastifyRequest): string {
  return `${userOrIp(request)}:${request.method}:${request.routeOptions.url ?? request.url}`;
}

function createRateLimitMiddleware(options: RateLimitOptions): RateLimitMiddleware {
  const buckets = new Map<string, RateLimitBucket>();

  return async function rateLimit(request, reply) {
    const now = Date.now();
    const identity = options.keyGenerator?.(request) ?? userOrIp(request);
    const key = `${options.name}:${identity}`;
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : {
            count: 0,
            resetAt: now + options.windowMs,
          };
    buckets.set(key, bucket);

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
    reply.header("x-ratelimit-limit", String(options.max));
    reply.header("x-ratelimit-reset", String(Math.ceil(bucket.resetAt / 1_000)));

    if (bucket.count >= options.max) {
      reply.header("retry-after", String(retryAfterSeconds));
      reply.header("x-ratelimit-remaining", "0");
      throw new RateLimitError("Too many requests.", {
        limit: options.max,
        retryAfterSeconds,
        windowSeconds: Math.ceil(options.windowMs / 1_000),
      });
    }

    bucket.count += 1;
    reply.header("x-ratelimit-remaining", String(Math.max(0, options.max - bucket.count)));
  };
}

export function createRateLimiters(env: ApiEnv): ApiRateLimiters {
  return {
    auth: createRateLimitMiddleware({
      keyGenerator: (request) => `${request.ip}:${bodyEmail(request)}`,
      max: env.rateLimitAuthMax,
      name: "auth",
      windowMs: env.rateLimitAuthWindowMs,
    }),
    messaging: createRateLimitMiddleware({
      keyGenerator: routeScopedUserOrIp,
      max: env.rateLimitMessagingMax,
      name: "messaging",
      windowMs: env.rateLimitMessagingWindowMs,
    }),
    paymentCreation: createRateLimitMiddleware({
      keyGenerator: routeScopedUserOrIp,
      max: env.rateLimitPaymentCreationMax,
      name: "payment-creation",
      windowMs: env.rateLimitPaymentCreationWindowMs,
    }),
    rfqSubmission: createRateLimitMiddleware({
      keyGenerator: userOrIp,
      max: env.rateLimitRfqSubmissionMax,
      name: "rfq-submission",
      windowMs: env.rateLimitRfqSubmissionWindowMs,
    }),
  };
}
