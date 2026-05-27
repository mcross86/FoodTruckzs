import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import type { ApiEnv } from "../../config/env.js";
import { AppError } from "./app-error.js";
import { ERROR_CODES } from "./error-codes.js";
import { zodErrorToValidationError } from "../validation/zod.js";

type ErrorResponse = {
  error: {
    code: string;
    details?: Record<string, unknown>;
    message: string;
    requestId: string;
  };
};

function isFastifyError(error: unknown): error is FastifyError {
  return typeof error === "object" && error !== null && "code" in error && "statusCode" in error;
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return zodErrorToValidationError(error);
  }

  if (
    isFastifyError(error) &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return new AppError({
      code: error.code,
      httpStatus: error.statusCode,
      message: error.message,
    });
  }

  return new AppError({
    cause: error,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    httpStatus: 500,
    message: "An unexpected server error occurred.",
  });
}

export function createErrorHandler(env: Pick<ApiEnv, "nodeEnv">) {
  return async function errorHandler(
    error: unknown,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const normalizedError = normalizeError(error);
    const requestId = request.requestContext?.requestId ?? request.id;
    const shouldExposeDetails = env.nodeEnv !== "production" || normalizedError.httpStatus < 500;
    const response: ErrorResponse = {
      error: {
        code: normalizedError.code,
        message: normalizedError.message,
        requestId,
      },
    };

    if (shouldExposeDetails && normalizedError.details) {
      response.error.details = normalizedError.details;
    }

    if (normalizedError.httpStatus >= 500) {
      request.log.error(
        {
          err: error,
          errorCode: normalizedError.code,
          requestId,
        },
        normalizedError.message,
      );
    } else {
      request.log.warn(
        {
          errorCode: normalizedError.code,
          requestId,
        },
        normalizedError.message,
      );
    }

    await reply.code(normalizedError.httpStatus).send(response);
  };
}
