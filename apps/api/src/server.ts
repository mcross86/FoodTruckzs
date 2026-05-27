import { buildApp } from "./app.js";
import { readApiEnv } from "./config/env.js";

const env = readApiEnv();
const app = await buildApp({ env });

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, "shutting down api");
  await app.close();
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await app
  .listen({
    host: env.host,
    port: env.port,
  })
  .catch((error: unknown) => {
    app.log.error({ err: error }, "api failed to start");
    process.exit(1);
  });
