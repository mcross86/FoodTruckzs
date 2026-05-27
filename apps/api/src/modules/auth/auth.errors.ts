import { AppError } from "../../shared/errors/app-error.js";

export class InvalidCredentialsError extends AppError {
  constructor() {
    super({
      code: "INVALID_CREDENTIALS",
      httpStatus: 401,
      message: "Invalid email or password.",
    });
  }
}

export class EmailAlreadyRegisteredError extends AppError {
  constructor() {
    super({
      code: "EMAIL_ALREADY_REGISTERED",
      httpStatus: 409,
      message: "A user with this email already exists.",
    });
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super({
      code: "TOKEN_EXPIRED",
      httpStatus: 401,
      message: "Access token has expired.",
    });
  }
}

export class InvalidTokenError extends AppError {
  constructor() {
    super({
      code: "INVALID_TOKEN",
      httpStatus: 401,
      message: "Authentication token is invalid.",
    });
  }
}

export class SessionRevokedError extends AppError {
  constructor(message = "Session has been revoked.") {
    super({
      code: "SESSION_REVOKED",
      httpStatus: 401,
      message,
    });
  }
}

export class SessionExpiredError extends AppError {
  constructor() {
    super({
      code: "SESSION_EXPIRED",
      httpStatus: 401,
      message: "Session has expired.",
    });
  }
}

export class RefreshTokenReusedError extends AppError {
  constructor() {
    super({
      code: "REFRESH_TOKEN_REUSED",
      httpStatus: 401,
      message: "Refresh token reuse was detected.",
    });
  }
}

export class UserSuspendedError extends AppError {
  constructor() {
    super({
      code: "USER_SUSPENDED",
      httpStatus: 403,
      message: "User account is suspended.",
    });
  }
}

export class VendorAccessDeniedError extends AppError {
  constructor() {
    super({
      code: "VENDOR_ACCESS_DENIED",
      httpStatus: 403,
      message: "Active vendor membership is required.",
    });
  }
}

export class RoleAccessDeniedError extends AppError {
  constructor() {
    super({
      code: "ROLE_ACCESS_DENIED",
      httpStatus: 403,
      message: "Required role is missing.",
    });
  }
}
