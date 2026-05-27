import { ERROR_CODES, type ErrorCode } from "./error-codes.js";

type AppErrorOptions = {
  cause?: unknown;
  code: ErrorCode;
  details?: Record<string, unknown>;
  httpStatus: number;
  message: string;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly httpStatus: number;
  readonly isOperational = true;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.details = options.details;
    this.httpStatus = options.httpStatus;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Request validation failed.", details?: Record<string, unknown>) {
    super({
      code: ERROR_CODES.VALIDATION_FAILED,
      details,
      httpStatus: 400,
      message,
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication is required.") {
    super({
      code: ERROR_CODES.AUTHENTICATION_REQUIRED,
      httpStatus: 401,
      message,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You are not authorized to perform this action.") {
    super({
      code: ERROR_CODES.AUTHORIZATION_FAILED,
      httpStatus: 403,
      message,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super({
      code: ERROR_CODES.NOT_FOUND,
      httpStatus: 404,
      message,
    });
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "Request conflicts with the current resource state.",
    details?: Record<string, unknown>,
  ) {
    super({
      code: ERROR_CODES.CONFLICT,
      details,
      httpStatus: 409,
      message,
    });
  }
}

export class BusinessRuleError extends AppError {
  constructor(message = "Request violates a business rule.", details?: Record<string, unknown>) {
    super({
      code: ERROR_CODES.BUSINESS_RULE_VIOLATION,
      details,
      httpStatus: 422,
      message,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    message = "External service request failed.",
    details?: Record<string, unknown>,
    httpStatus = 502,
  ) {
    super({
      code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      details,
      httpStatus,
      message,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests.", details?: Record<string, unknown>) {
    super({
      code: ERROR_CODES.RATE_LIMITED,
      details,
      httpStatus: 429,
      message,
    });
  }
}
