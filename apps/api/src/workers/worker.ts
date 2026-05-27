import { readApiEnv } from "../config/env.js";
import { createDatabaseClient } from "../db/client.js";
import { createDevelopmentEmailProvider } from "../modules/notifications/email-provider.js";
import { DrizzleNotificationRepository } from "../modules/notifications/notifications.repository.js";
import { createNotificationService } from "../modules/notifications/notifications.service.js";

const workerName = "foodtruckzs-worker";
const pollIntervalMs = Number.parseInt(
  process.env.NOTIFICATION_WORKER_POLL_INTERVAL_MS ?? "5000",
  10,
);
const batchSize = Number.parseInt(process.env.NOTIFICATION_WORKER_BATCH_SIZE ?? "25", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const env = readApiEnv();
  const database = createDatabaseClient(env);
  const notificationService = createNotificationService({
    emailProvider: createDevelopmentEmailProvider(),
    repository: new DrizzleNotificationRepository(database.db),
  });
  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals) {
    shuttingDown = true;
    console.info({ signal, workerName }, "Worker shutdown requested.");
    await database.close();
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  console.info({ batchSize, pollIntervalMs, workerName }, "Worker started.");

  while (!shuttingDown) {
    try {
      const result = await notificationService.processOutboxBatch(batchSize);
      if (result.claimed > 0) {
        console.info({ result, workerName }, "Outbox notification batch processed.");
      }
    } catch (error) {
      console.error({ error, workerName }, "Outbox notification batch failed.");
    }

    await sleep(pollIntervalMs);
  }
}

main().catch((error) => {
  console.error({ error, workerName }, "Worker crashed.");
  process.exitCode = 1;
});
