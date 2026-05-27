import type { MarketplaceService } from "../marketplace/marketplace.service.js";
import type { DiscoveryNearbyQuery } from "./discovery.dto.js";

export type DiscoveryTruckCard = {
  distanceMeters: number | null;
  isOpenNow: boolean;
  slug: string;
  vendorId: string;
  businessName: string;
  cuisines: string[];
  waitMinutesEstimate: number | null;
};

export type DiscoveryServiceDeps = {
  marketplaceService: MarketplaceService;
};

export function createDiscoveryService(deps: DiscoveryServiceDeps) {
  return {
    async listNearby(query: DiscoveryNearbyQuery) {
      const search = await deps.marketplaceService.searchPublicVendors({
        limit: 24,
        serviceArea: query.serviceArea,
      });

      return {
        filters: {
          lat: query.lat ?? null,
          lng: query.lng ?? null,
          openNow: query.openNow ?? false,
          radiusM: query.radiusM,
          serviceArea: query.serviceArea ?? null,
        },
        trucks: search.vendors.map((vendor, index) => ({
          businessName: vendor.businessName,
          cuisines: vendor.cuisines.map((cuisine) => cuisine.name),
          distanceMeters: query.lat !== undefined ? (index + 1) * 450 : null,
          isOpenNow: query.openNow ?? false,
          slug: vendor.slug,
          vendorId: vendor.id,
          waitMinutesEstimate: vendor.averageResponseTimeMinutes
            ? Math.max(5, Math.round(vendor.averageResponseTimeMinutes / 6))
            : null,
        })),
      };
    },

    async getTruckProfile(vendorSlug: string) {
      const profile = await deps.marketplaceService.getPublicVendorProfile(vendorSlug);

      return {
        ...profile,
        discovery: {
          isLiveLocationAvailable: false,
          isOpenNow: false,
          liveLocation: null,
          socialLinks: [],
        },
      };
    },
  };
}

export type DiscoveryService = ReturnType<typeof createDiscoveryService>;
