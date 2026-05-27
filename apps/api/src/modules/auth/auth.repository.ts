import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { Transaction } from "../../db/transaction.js";
import {
  refreshTokens,
  sessions,
  users,
  vendorMemberships,
  type NewRefreshToken,
  type NewSession,
  type NewUser,
  type RefreshToken,
  type Session,
  type User,
  type VendorMembership,
} from "../../db/schema/index.js";

type AuthDb = Database | Transaction;

function requireReturnedRow<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error("Database write did not return a row.");
  }

  return row;
}

export type CreateUserInput = Pick<
  NewUser,
  "email" | "firstName" | "lastName" | "passwordHash" | "phone" | "status" | "globalRoles"
>;

export type CreateSessionInput = Pick<
  NewSession,
  "expiresAt" | "ipAddress" | "lastSeenAt" | "status" | "userAgent" | "userId"
>;

export type CreateRefreshTokenInput = Pick<
  NewRefreshToken,
  "expiresAt" | "sessionId" | "status" | "tokenFamilyId" | "tokenHash" | "userId"
>;

export type RotateRefreshTokenInput = {
  existingTokenId: string;
  nextToken: CreateRefreshTokenInput;
  now: Date;
};

export type AuthRepository = {
  createRefreshToken: (input: CreateRefreshTokenInput) => Promise<RefreshToken>;
  createSession: (input: CreateSessionInput) => Promise<Session>;
  createUser: (input: CreateUserInput) => Promise<User>;
  findActiveVendorMembershipsByUserId: (userId: string) => Promise<VendorMembership[]>;
  findRefreshTokenByHash: (tokenHash: string) => Promise<RefreshToken | null>;
  findSessionById: (sessionId: string) => Promise<Session | null>;
  findUserByEmail: (email: string) => Promise<User | null>;
  findUserById: (userId: string) => Promise<User | null>;
  revokeRefreshTokenFamily: (tokenFamilyId: string, now: Date) => Promise<void>;
  revokeRefreshTokensBySessionId: (sessionId: string, now: Date) => Promise<void>;
  revokeSession: (sessionId: string, now: Date) => Promise<void>;
  rotateRefreshToken: (input: RotateRefreshTokenInput) => Promise<RefreshToken>;
  transaction: <T>(callback: (repo: AuthRepository) => Promise<T>) => Promise<T>;
};

export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly db: AuthDb) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const [user] = await this.db.insert(users).values(input).returning();
    return requireReturnedRow(user);
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);

    return user ?? null;
  }

  async findUserById(userId: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    const [session] = await this.db.insert(sessions).values(input).returning();
    return requireReturnedRow(session);
  }

  async findSessionById(sessionId: string): Promise<Session | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    return session ?? null;
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        revokedAt: now,
        status: "revoked",
        updatedAt: now,
      })
      .where(eq(sessions.id, sessionId));
  }

  async createRefreshToken(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    const [refreshToken] = await this.db.insert(refreshTokens).values(input).returning();
    return requireReturnedRow(refreshToken);
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    const [refreshToken] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    return refreshToken ?? null;
  }

  async rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshToken> {
    const rotate = async (db: AuthDb) => {
      const [insertedToken] = await db.insert(refreshTokens).values(input.nextToken).returning();
      const nextToken = requireReturnedRow(insertedToken);
      await db
        .update(refreshTokens)
        .set({
          replacedByTokenId: nextToken.id,
          status: "rotated",
          usedAt: input.now,
        })
        .where(eq(refreshTokens.id, input.existingTokenId));

      return nextToken;
    };

    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => rotate(tx));
    }

    return rotate(this.db);
  }

  async revokeRefreshTokensBySessionId(sessionId: string, now: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        revokedAt: now,
        status: "revoked",
      })
      .where(
        and(eq(refreshTokens.sessionId, sessionId), sql`${refreshTokens.status} <> 'revoked'`),
      );
  }

  async revokeRefreshTokenFamily(tokenFamilyId: string, now: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        revokedAt: now,
        status: "revoked",
      })
      .where(
        and(
          eq(refreshTokens.tokenFamilyId, tokenFamilyId),
          sql`${refreshTokens.status} <> 'revoked'`,
        ),
      );
  }

  async findActiveVendorMembershipsByUserId(userId: string): Promise<VendorMembership[]> {
    return this.db
      .select()
      .from(vendorMemberships)
      .where(and(eq(vendorMemberships.userId, userId), eq(vendorMemberships.status, "active")));
  }

  async transaction<T>(callback: (repo: AuthRepository) => Promise<T>): Promise<T> {
    if ("transaction" in this.db && typeof this.db.transaction === "function") {
      return this.db.transaction((tx) => callback(new DrizzleAuthRepository(tx)));
    }

    return callback(this);
  }
}

export function createUnavailableAuthRepository(): AuthRepository {
  const unavailable = async () => {
    throw new Error("Auth repository is unavailable because no database client was provided.");
  };

  return {
    createRefreshToken: unavailable,
    createSession: unavailable,
    createUser: unavailable,
    findActiveVendorMembershipsByUserId: unavailable,
    findRefreshTokenByHash: unavailable,
    findSessionById: unavailable,
    findUserByEmail: unavailable,
    findUserById: unavailable,
    revokeRefreshTokenFamily: unavailable,
    revokeRefreshTokensBySessionId: unavailable,
    revokeSession: unavailable,
    rotateRefreshToken: unavailable,
    transaction: async (callback) => callback(createUnavailableAuthRepository()),
  };
}
