import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import type { ApiEnv } from "../config/env.js";
import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;

export type DatabaseClient = {
  db: Database;
  ping: () => Promise<void>;
  close: () => Promise<void>;
  sql: Sql;
};

export function createDatabaseClient(
  env: Pick<ApiEnv, "databaseMaxConnections" | "databaseUrl">,
): DatabaseClient {
  const sql = postgres(env.databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: env.databaseMaxConnections,
  });

  const db = drizzle(sql, { schema });

  return {
    db,
    async ping() {
      await sql`select 1`;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
    sql,
  };
}
