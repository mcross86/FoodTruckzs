import type { FastifyInstance } from "fastify";

import { AppError } from "../shared/errors/app-error.js";

type ReadinessDependency = {
  ping: () => Promise<void>;
};

export type HealthRouteDeps = {
  database: ReadinessDependency;
};

export async function registerHealthRoutes(
  app: FastifyInstance,
  deps: HealthRouteDeps,
): Promise<void> {
  app.get("/healthz", async (request) => ({
    data: {
      service: "foodtruckzs-api",
      status: "ok",
    },
    meta: {
      requestId: request.requestContext.requestId,
    },
  }));

  app.get("/readyz", async (request) => {
    try {
      await deps.database.ping();
    } catch (error) {
      throw new AppError({
        cause: error,
        code: "DATABASE_UNAVAILABLE",
        details: {
          database: "unavailable",
        },
        httpStatus: 503,
        message: "API dependencies are not ready.",
      });
    }

    return {
      data: {
        dependencies: {
          database: "ok",
        },
        service: "foodtruckzs-api",
        status: "ok",
      },
      meta: {
        requestId: request.requestContext.requestId,
      },
    };
  });
}
