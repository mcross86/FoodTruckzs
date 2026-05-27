import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { defineConfig } from "drizzle-kit";

function findLocalEnvFile(startDirectory: string): string | null {
  let currentDirectory = startDirectory;

  while (true) {
    const candidate = join(currentDirectory, ".env");

    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

const envFilePath = findLocalEnvFile(process.cwd());

if (envFilePath) {
  process.loadEnvFile(envFilePath);
}

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  dialect: "postgresql",
  out: "./src/db/migrations",
  schema: "./src/db/schema/index.ts",
  strict: true,
  verbose: true,
});
