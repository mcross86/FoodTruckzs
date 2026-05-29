import { randomUUID } from "node:crypto";

import type { RefreshToken, Session, User, VendorMembership } from "../../db/schema/index.js";
import { AuthenticationError } from "../../shared/errors/app-error.js";
import type { RequestContext } from "../../shared/middleware/request-context.js";
import type { LoginRequestDto, RegisterRequestDto } from "./auth.dto.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  RefreshTokenReusedError,
  SessionExpiredError,
  SessionRevokedError,
  UserSuspendedError,
} from "./auth.errors.js";
import type { AuthRepository } from "./auth.repository.js";
import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";
import {
  GLOBAL_ROLES,
  VENDOR_ROLES,
  type AuthServiceResult,
  type GlobalRole,
} from "./auth.types.js";
import type { VendorMembershipSummary } from "./auth.types.js";

export type AuthServiceOptions = {
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
};

export type SessionRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type AuthenticatedContextFields = Pick<
  RequestContext,
  "globalRoles" | "sessionId" | "user" | "userId" | "vendorMemberships"
>;

export type AuthService = {
  authenticateAccessToken: (accessToken: string) => Promise<AuthenticatedContextFields>;
  login: (input: LoginRequestDto, metadata: SessionRequestMetadata) => Promise<AuthServiceResult>;
  logout: (sessionId: string, now?: Date) => Promise<void>;
  refresh: (refreshToken: string, metadata: SessionRequestMetadata) => Promise<AuthServiceResult>;
  register: (
    input: RegisterRequestDto,
    metadata: SessionRequestMetadata,
  ) => Promise<AuthServiceResult>;
};

export type AuthServiceDeps = {
  options: AuthServiceOptions;
  passwordService: PasswordService;
  repository: AuthRepository;
  tokenService: TokenService;
};

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

function normalizeGlobalRoles(roles: unknown): GlobalRole[] {
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter((role): role is GlobalRole =>
    GLOBAL_ROLES.includes(role as (typeof GLOBAL_ROLES)[number]),
  );
}

function mapUser(user: User) {
  return {
    email: user.email,
    firstName: user.firstName,
    globalRoles: normalizeGlobalRoles(user.globalRoles),
    id: user.id,
    lastName: user.lastName,
    phone: user.phone ?? undefined,
    status: user.status,
  };
}

function mapMembership(membership: {
  approvalStatus: VendorMembershipSummary["approvalStatus"];
  businessName: string;
  role: VendorMembershipSummary["role"];
  status: VendorMembershipSummary["status"];
  vendorId: string;
}): VendorMembershipSummary {
  return {
    approvalStatus: membership.approvalStatus,
    businessName: membership.businessName,
    role: membership.role,
    status: membership.status,
    vendorId: membership.vendorId,
  };
}

function assertUserCanAuthenticate(user: User): void {
  if (user.status === "suspended" || user.status === "disabled") {
    throw new UserSuspendedError();
  }
}

function assertSessionActive(session: Session, now: Date): void {
  if (session.status === "revoked" || session.revokedAt !== null) {
    throw new SessionRevokedError();
  }

  if (session.status === "expired" || isExpired(session.expiresAt, now)) {
    throw new SessionExpiredError();
  }
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  async function buildAuthResponse(
    user: User,
    session: Session,
    refreshToken: string,
    refreshTokenExpiresAt: Date,
  ): Promise<AuthServiceResult> {
    const vendorMemberships = await deps.repository.findActiveVendorMembershipsByUserId(user.id);
    const userSummary = mapUser(user);
    const accessToken = await deps.tokenService.signAccessToken({
      globalRoles: userSummary.globalRoles,
      sessionId: session.id,
      userId: user.id,
    });

    return {
      accessToken,
      accessTokenExpiresInSeconds: deps.options.accessTokenTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt,
      user: userSummary,
      vendorMemberships: vendorMemberships.map(mapMembership),
    };
  }

  async function createSessionAndTokens(
    user: User,
    metadata: SessionRequestMetadata,
    now = new Date(),
  ) {
    const refreshTokenExpiresAt = addDays(now, deps.options.refreshTokenTtlDays);
    const session = await deps.repository.createSession({
      expiresAt: refreshTokenExpiresAt,
      ipAddress: metadata.ipAddress,
      lastSeenAt: now,
      status: "active",
      userAgent: metadata.userAgent,
      userId: user.id,
    });
    const refreshToken = deps.tokenService.createRefreshToken();

    await deps.repository.createRefreshToken({
      expiresAt: refreshTokenExpiresAt,
      sessionId: session.id,
      status: "active",
      tokenFamilyId: randomUUID(),
      tokenHash: deps.tokenService.hashRefreshToken(refreshToken),
      userId: user.id,
    });

    return { refreshToken, refreshTokenExpiresAt, session };
  }

  async function revokeFamilyForReuse(refreshToken: RefreshToken, now: Date): Promise<void> {
    await deps.repository.transaction(async (repo) => {
      await repo.revokeRefreshTokenFamily(refreshToken.tokenFamilyId, now);
      await repo.revokeSession(refreshToken.sessionId, now);
    });
  }

  return {
    async register(input, metadata) {
      const existingUser = await deps.repository.findUserByEmail(input.email);

      if (existingUser !== null) {
        throw new EmailAlreadyRegisteredError();
      }

      const passwordHash = await deps.passwordService.hashPassword(input.password);

      let user: User;
      try {
        user = await deps.repository.createUser({
          email: input.email,
          firstName: input.firstName,
          globalRoles: ["customer"],
          lastName: input.lastName,
          passwordHash,
          phone: input.phone,
          status: "active",
        });
      } catch {
        throw new EmailAlreadyRegisteredError();
      }

      const { refreshToken, refreshTokenExpiresAt, session } = await createSessionAndTokens(
        user,
        metadata,
      );

      return buildAuthResponse(user, session, refreshToken, refreshTokenExpiresAt);
    },

    async login(input, metadata) {
      const user = await deps.repository.findUserByEmail(input.email);

      if (user === null) {
        throw new InvalidCredentialsError();
      }

      const isPasswordValid = await deps.passwordService.verifyPassword(
        user.passwordHash,
        input.password,
      );

      if (!isPasswordValid) {
        throw new InvalidCredentialsError();
      }

      assertUserCanAuthenticate(user);

      const { refreshToken, refreshTokenExpiresAt, session } = await createSessionAndTokens(
        user,
        metadata,
      );

      return buildAuthResponse(user, session, refreshToken, refreshTokenExpiresAt);
    },

    async refresh(refreshToken, _metadata) {
      if (!refreshToken) {
        throw new AuthenticationError("Refresh token is required.");
      }

      const now = new Date();
      const tokenHash = deps.tokenService.hashRefreshToken(refreshToken);
      const storedRefreshToken = await deps.repository.findRefreshTokenByHash(tokenHash);

      if (storedRefreshToken === null) {
        throw new AuthenticationError("Refresh token is invalid.");
      }

      if (storedRefreshToken.status !== "active" || storedRefreshToken.usedAt !== null) {
        await revokeFamilyForReuse(storedRefreshToken, now);
        throw new RefreshTokenReusedError();
      }

      if (isExpired(storedRefreshToken.expiresAt, now)) {
        await deps.repository.revokeRefreshTokenFamily(storedRefreshToken.tokenFamilyId, now);
        throw new SessionExpiredError();
      }

      const session = await deps.repository.findSessionById(storedRefreshToken.sessionId);

      if (session === null) {
        throw new SessionRevokedError("Session was not found.");
      }

      assertSessionActive(session, now);

      const user = await deps.repository.findUserById(storedRefreshToken.userId);

      if (user === null) {
        throw new SessionRevokedError("Session user was not found.");
      }

      assertUserCanAuthenticate(user);

      const nextRefreshToken = deps.tokenService.createRefreshToken();
      const nextRefreshTokenExpiresAt = addDays(now, deps.options.refreshTokenTtlDays);
      await deps.repository.rotateRefreshToken({
        existingTokenId: storedRefreshToken.id,
        nextToken: {
          expiresAt: nextRefreshTokenExpiresAt,
          sessionId: session.id,
          status: "active",
          tokenFamilyId: storedRefreshToken.tokenFamilyId,
          tokenHash: deps.tokenService.hashRefreshToken(nextRefreshToken),
          userId: user.id,
        },
        now,
      });

      return buildAuthResponse(user, session, nextRefreshToken, nextRefreshTokenExpiresAt);
    },

    async logout(sessionId, now = new Date()) {
      await deps.repository.transaction(async (repo) => {
        await repo.revokeRefreshTokensBySessionId(sessionId, now);
        await repo.revokeSession(sessionId, now);
      });
    },

    async authenticateAccessToken(accessToken) {
      const verifiedToken = await deps.tokenService.verifyAccessToken(accessToken);
      const now = new Date();
      const [session, user] = await Promise.all([
        deps.repository.findSessionById(verifiedToken.sessionId),
        deps.repository.findUserById(verifiedToken.userId),
      ]);

      if (session === null || user === null) {
        throw new SessionRevokedError();
      }

      assertSessionActive(session, now);
      assertUserCanAuthenticate(user);

      const memberships = await deps.repository.findActiveVendorMembershipsByUserId(user.id);

      return {
        globalRoles: normalizeGlobalRoles(user.globalRoles),
        sessionId: session.id,
        user: mapUser(user),
        userId: user.id,
        vendorMemberships: memberships
          .filter((membership) => VENDOR_ROLES.includes(membership.role))
          .map(mapMembership),
      };
    },
  };
}
