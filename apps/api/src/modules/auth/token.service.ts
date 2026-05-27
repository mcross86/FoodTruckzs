import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { errors as joseErrors, jwtVerify, SignJWT } from "jose";

import { InvalidTokenError, TokenExpiredError } from "./auth.errors.js";
import { GLOBAL_ROLES, type GlobalRole } from "./auth.types.js";

export type AccessTokenPayload = {
  activeVendorId?: string;
  globalRoles: GlobalRole[];
  sessionId: string;
  userId: string;
};

export type VerifiedAccessToken = AccessTokenPayload & {
  expiresAt: Date;
};

export type TokenService = {
  accessTokenTtlSeconds: number;
  createRefreshToken: () => string;
  hashRefreshToken: (token: string) => string;
  signAccessToken: (payload: AccessTokenPayload) => Promise<string>;
  verifyAccessToken: (token: string) => Promise<VerifiedAccessToken>;
};

export type TokenServiceOptions = {
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenSecret: string;
};

export function createTokenService(options: TokenServiceOptions): TokenService {
  const accessTokenSecret = new TextEncoder().encode(options.accessTokenSecret);

  return {
    accessTokenTtlSeconds: options.accessTokenTtlSeconds,
    createRefreshToken() {
      return `${randomUUID()}.${randomBytes(48).toString("base64url")}`;
    },
    hashRefreshToken(token) {
      return createHmac("sha256", options.refreshTokenSecret).update(token).digest("hex");
    },
    async signAccessToken(payload) {
      return new SignJWT({
        activeVendorId: payload.activeVendorId,
        globalRoles: payload.globalRoles,
        sid: payload.sessionId,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setJti(randomUUID())
        .setSubject(payload.userId)
        .setExpirationTime(Math.floor(Date.now() / 1000) + options.accessTokenTtlSeconds)
        .sign(accessTokenSecret);
    },
    async verifyAccessToken(token) {
      try {
        const verified = await jwtVerify(token, accessTokenSecret);
        const sessionId = verified.payload.sid;
        const globalRoles = verified.payload.globalRoles;

        if (
          typeof verified.payload.sub !== "string" ||
          typeof sessionId !== "string" ||
          !Array.isArray(globalRoles)
        ) {
          throw new InvalidTokenError();
        }

        return {
          activeVendorId:
            typeof verified.payload.activeVendorId === "string"
              ? verified.payload.activeVendorId
              : undefined,
          expiresAt: new Date((verified.payload.exp ?? 0) * 1000),
          globalRoles: globalRoles.filter((role): role is GlobalRole =>
            GLOBAL_ROLES.includes(role as GlobalRole),
          ),
          sessionId,
          userId: verified.payload.sub,
        };
      } catch (error) {
        if (error instanceof TokenExpiredError || error instanceof InvalidTokenError) {
          throw error;
        }

        if (error instanceof joseErrors.JWTExpired) {
          throw new TokenExpiredError();
        }

        throw new InvalidTokenError();
      }
    },
  };
}
