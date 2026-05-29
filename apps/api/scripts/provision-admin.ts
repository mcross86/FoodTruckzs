/**
 * Provision or update a platform admin user in the database.
 *
 * Usage:
 *   pnpm --filter @foodtruckzs/api provision:admin -- <email> <password> [firstName] [lastName]
 *
 * Password must meet API rules: 12+ chars with upper, lower, and number.
 */

import { sql } from "drizzle-orm";

import { readApiEnv } from "../src/config/env.js";
import { createDatabaseClient } from "../src/db/client.js";
import { users } from "../src/db/schema/index.js";
import { DrizzleAuthRepository } from "../src/modules/auth/auth.repository.js";
import { createPasswordService } from "../src/modules/auth/password.service.js";

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
const firstName = process.argv[4]?.trim() || "Platform";
const lastName = process.argv[5]?.trim() || "Admin";

function usage(): never {
  console.error(
    "Usage: pnpm --filter @foodtruckzs/api provision:admin -- <email> <password> [firstName] [lastName]",
  );
  process.exit(1);
}

if (!email || !password) {
  usage();
}

if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const env = readApiEnv();
const database = createDatabaseClient(env);
const repository = new DrizzleAuthRepository(database.db);
const passwordService = createPasswordService();

try {
  await database.ping();

  const passwordHash = await passwordService.hashPassword(password);
  const existing = await repository.findUserByEmail(email);

  if (existing) {
    const roles = new Set(
      Array.isArray(existing.globalRoles) ? (existing.globalRoles as string[]) : [],
    );
    roles.add("platform_admin");

    const [updated] = await database.db
      .update(users)
      .set({
        firstName: existing.firstName || firstName,
        globalRoles: [...roles],
        lastName: existing.lastName || lastName,
        passwordHash,
        status: "active",
        updatedAt: new Date(),
      })
      .where(sql`lower(${users.email}) = ${email}`)
      .returning({ email: users.email, globalRoles: users.globalRoles, id: users.id });

    if (!updated) {
      throw new Error("Failed to update existing user.");
    }

    console.log(`Updated admin user ${updated.email} (${updated.id})`);
    console.log(`Roles: ${JSON.stringify(updated.globalRoles)}`);
  } else {
    const created = await repository.createUser({
      email,
      firstName,
      globalRoles: ["platform_admin"],
      lastName,
      passwordHash,
      phone: undefined,
      status: "active",
    });

    console.log(`Created admin user ${created.email} (${created.id})`);
    console.log(`Roles: ${JSON.stringify(created.globalRoles)}`);
  }

  console.log("Sign in at /admin/login with this email and password.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await database.close();
}
