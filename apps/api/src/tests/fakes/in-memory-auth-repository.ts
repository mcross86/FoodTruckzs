import { randomUUID } from "node:crypto";

import type {
  CreateRefreshTokenInput,
  CreateSessionInput,
  CreateUserInput,
  AuthRepository,
  RotateRefreshTokenInput,
} from "../../modules/auth/auth.repository.js";
import type { RefreshToken, Session, User, VendorMembership } from "../../db/schema/index.js";
import type { VendorRole } from "../../modules/auth/auth.types.js";

function now(): Date {
  return new Date();
}

export class InMemoryAuthRepository implements AuthRepository {
  readonly refreshTokens = new Map<string, RefreshToken>();
  readonly sessions = new Map<string, Session>();
  readonly users = new Map<string, User>();
  readonly vendorMemberships = new Map<string, VendorMembership>();

  async createUser(input: CreateUserInput): Promise<User> {
    const createdAt = now();
    const user: User = {
      createdAt,
      email: input.email,
      emailVerifiedAt: null,
      firstName: input.firstName,
      globalRoles: input.globalRoles ?? [],
      id: randomUUID(),
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      phone: input.phone ?? null,
      status: input.status ?? "pending_verification",
      updatedAt: createdAt,
    };

    for (const existingUser of this.users.values()) {
      if (existingUser.email.toLowerCase() === user.email.toLowerCase()) {
        throw new Error("duplicate email");
      }
    }

    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }

    return null;
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    const createdAt = now();
    const session: Session = {
      createdAt,
      expiresAt: input.expiresAt,
      id: randomUUID(),
      ipAddress: input.ipAddress ?? null,
      lastSeenAt: input.lastSeenAt ?? null,
      revokedAt: null,
      status: input.status ?? "active",
      updatedAt: createdAt,
      userAgent: input.userAgent ?? null,
      userId: input.userId,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionById(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      this.sessions.set(sessionId, {
        ...session,
        revokedAt,
        status: "revoked",
        updatedAt: revokedAt,
      });
    }
  }

  async createRefreshToken(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    const refreshToken: RefreshToken = {
      createdAt: now(),
      expiresAt: input.expiresAt,
      id: randomUUID(),
      replacedByTokenId: null,
      revokedAt: null,
      sessionId: input.sessionId,
      status: input.status ?? "active",
      tokenFamilyId: input.tokenFamilyId,
      tokenHash: input.tokenHash,
      usedAt: null,
      userId: input.userId,
    };

    this.refreshTokens.set(refreshToken.id, refreshToken);
    return refreshToken;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    for (const refreshToken of this.refreshTokens.values()) {
      if (refreshToken.tokenHash === tokenHash) {
        return refreshToken;
      }
    }

    return null;
  }

  async rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshToken> {
    const nextToken = await this.createRefreshToken(input.nextToken);
    const existingToken = this.refreshTokens.get(input.existingTokenId);

    if (existingToken) {
      this.refreshTokens.set(existingToken.id, {
        ...existingToken,
        replacedByTokenId: nextToken.id,
        status: "rotated",
        usedAt: input.now,
      });
    }

    return nextToken;
  }

  async revokeRefreshTokensBySessionId(sessionId: string, revokedAt: Date): Promise<void> {
    for (const [id, refreshToken] of this.refreshTokens) {
      if (refreshToken.sessionId === sessionId) {
        this.refreshTokens.set(id, {
          ...refreshToken,
          revokedAt,
          status: "revoked",
        });
      }
    }
  }

  async revokeRefreshTokenFamily(tokenFamilyId: string, revokedAt: Date): Promise<void> {
    for (const [id, refreshToken] of this.refreshTokens) {
      if (refreshToken.tokenFamilyId === tokenFamilyId) {
        this.refreshTokens.set(id, {
          ...refreshToken,
          revokedAt,
          status: "revoked",
        });
      }
    }
  }

  async findActiveVendorMembershipsByUserId(userId: string): Promise<VendorMembership[]> {
    return [...this.vendorMemberships.values()].filter(
      (membership) => membership.userId === userId && membership.status === "active",
    );
  }

  async transaction<T>(callback: (repo: AuthRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  addVendorMembership(input: {
    role: VendorRole;
    status?: VendorMembership["status"];
    userId: string;
    vendorId: string;
  }): VendorMembership {
    const createdAt = now();
    const membership: VendorMembership = {
      createdAt,
      id: randomUUID(),
      invitedByUserId: null,
      role: input.role,
      status: input.status ?? "active",
      updatedAt: createdAt,
      userId: input.userId,
      vendorId: input.vendorId,
    };

    this.vendorMemberships.set(membership.id, membership);
    return membership;
  }

  expireSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (session) {
      this.sessions.set(sessionId, {
        ...session,
        expiresAt: new Date(Date.now() - 1_000),
        status: "expired",
      });
    }
  }
}
