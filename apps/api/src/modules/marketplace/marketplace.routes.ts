import type { FastifyInstance } from "fastify";

import { parseWithZod } from "../../shared/validation/zod.js";
import { publicVendorSearchQuerySchema, publicVendorSlugParamsSchema } from "./marketplace.dto.js";
import type { MarketplaceService } from "./marketplace.service.js";

type MarketplaceRouteDeps = {
  marketplaceService: MarketplaceService;
};

function envelope(requestId: string, data: unknown) {
  return {
    data,
    meta: {
      requestId,
    },
  };
}

export async function registerMarketplaceRoutes(
  app: FastifyInstance,
  deps: MarketplaceRouteDeps,
): Promise<void> {
  app.get("/api/v1/marketplace/cuisines", async (request) => {
    const cuisines = await deps.marketplaceService.listCuisines();
    return envelope(request.requestContext.requestId, cuisines);
  });

  app.get("/api/v1/marketplace/vendors", async (request) => {
    const query = parseWithZod(publicVendorSearchQuerySchema, request.query);
    const result = await deps.marketplaceService.searchPublicVendors(query);
    return envelope(request.requestContext.requestId, result);
  });

  app.get("/api/v1/marketplace/vendors/:vendorSlug", async (request) => {
    const params = parseWithZod(publicVendorSlugParamsSchema, request.params);
    const profile = await deps.marketplaceService.getPublicVendorProfile(params.vendorSlug);
    return envelope(request.requestContext.requestId, profile);
  });
}
