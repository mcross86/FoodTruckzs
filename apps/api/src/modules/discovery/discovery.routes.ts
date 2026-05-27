import type { FastifyInstance } from "fastify";

import { parseWithZod } from "../../shared/validation/zod.js";
import {
  discoveryNearbyQuerySchema,
  discoveryTruckSlugParamsSchema,
} from "./discovery.dto.js";
import type { DiscoveryService } from "./discovery.service.js";

type DiscoveryRouteDeps = {
  discoveryService: DiscoveryService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerDiscoveryRoutes(
  app: FastifyInstance,
  deps: DiscoveryRouteDeps,
): Promise<void> {
  app.get("/api/v1/discovery/nearby", async (request) => {
    const query = parseWithZod(discoveryNearbyQuerySchema, request.query);
    const result = await deps.discoveryService.listNearby(query);
    return envelope(request.requestContext.requestId, result);
  });

  app.get("/api/v1/discovery/trucks/:vendorSlug", async (request) => {
    const params = parseWithZod(discoveryTruckSlugParamsSchema, request.params);
    const profile = await deps.discoveryService.getTruckProfile(params.vendorSlug);
    return envelope(request.requestContext.requestId, profile);
  });
}
