import { NotFoundError } from "../../shared/errors/app-error.js";
import type { PublicVendorSearchQueryDto } from "./marketplace.dto.js";
import type { PublicMenuRecord, PublicVendorRecord } from "./marketplace.repository.js";
import type { MarketplaceRepository } from "./marketplace.repository.js";

type PublicCuisine = {
  id: string;
  name: string;
  slug: string;
};

type PublicServiceArea = {
  city: string | null;
  metroArea: string;
  postalCode: string | null;
  radiusMiles: number | null;
  state: string;
};

type PublicPriceRange = {
  maxCents: number;
  minCents: number;
};

type PublicMenuPreview = {
  description: string | null;
  dietaryTags: string[];
  items: {
    category: string | null;
    description: string | null;
    dietaryTags: string[];
    name: string;
    priceCents: number | null;
  }[];
  maximumGuestCount: number | null;
  minimumGuestCount: number | null;
  name: string;
  packages: {
    description: string | null;
    dietaryTags: string[];
    maximumGuestCount: number | null;
    minimumGuestCount: number | null;
    name: string;
    priceCents: number | null;
    pricingModel: string;
  }[];
  serviceStyles: string[];
};

type PublicVendorCard = {
  averageResponseTimeMinutes: number | null;
  businessName: string;
  cateringMinimumCents: number | null;
  cuisines: PublicCuisine[];
  description: string | null;
  dietaryAccommodations: string[];
  headline: string | null;
  id: string;
  minimumGuestCount: number | null;
  pricingSummary: string | null;
  publishedMenuCount: number;
  samplePriceRangeCents: PublicPriceRange | null;
  serviceAreas: PublicServiceArea[];
  serviceStyles: string[];
  slug: string;
  travelRadiusMiles: number | null;
};

type PublicVendorProfile = PublicVendorCard & {
  menus: PublicMenuPreview[];
  minimumLeadTimeDays: number | null;
  publicDescription: string | null;
  quoteResponseTargetHours: number | null;
  socialLinks: Record<string, string>;
  websiteUrl: string | null;
};

export type MarketplaceService = {
  getPublicVendorProfile: (vendorSlug: string) => Promise<PublicVendorProfile>;
  listCuisines: () => Promise<PublicCuisine[]>;
  searchPublicVendors: (
    query: PublicVendorSearchQueryDto,
  ) => Promise<{ filters: PublicVendorSearchQueryDto; vendors: PublicVendorCard[] }>;
};

export type MarketplaceServiceDeps = {
  repository: MarketplaceRepository;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesNormalized(value: string | null | undefined, query: string): boolean {
  return value !== null && value !== undefined && normalize(value).includes(query);
}

function tagMatches(tags: string[], query: string): boolean {
  return tags.some((tag) => normalize(tag) === query || normalize(tag).includes(query));
}

function priceRangeFor(record: PublicVendorRecord): PublicPriceRange | null {
  const prices = record.menus.flatMap((menu) => [
    ...menu.items.map((item) => item.priceCents),
    ...menu.packages.map((menuPackage) => menuPackage.priceCents),
  ]);
  const numericPrices = prices.filter((price): price is number => typeof price === "number");

  if (numericPrices.length === 0) {
    return null;
  }

  return {
    maxCents: Math.max(...numericPrices),
    minCents: Math.min(...numericPrices),
  };
}

function supportsGuestCount(record: PublicVendorRecord, guestCount: number): boolean {
  if (
    record.operatingSettings?.minimumGuestCount !== null &&
    record.operatingSettings?.minimumGuestCount !== undefined &&
    guestCount < record.operatingSettings.minimumGuestCount
  ) {
    return false;
  }

  const ranges = record.menus.flatMap((menu) => [
    {
      maximumGuestCount: menu.menu.maximumGuestCount,
      minimumGuestCount: menu.menu.minimumGuestCount,
    },
    ...menu.packages.map((menuPackage) => ({
      maximumGuestCount: menuPackage.maximumGuestCount,
      minimumGuestCount: menuPackage.minimumGuestCount,
    })),
  ]);
  const constrainedRanges = ranges.filter(
    (range) => range.minimumGuestCount !== null || range.maximumGuestCount !== null,
  );

  if (constrainedRanges.length === 0) {
    return true;
  }

  return constrainedRanges.some((range) => {
    if (range.minimumGuestCount !== null && guestCount < range.minimumGuestCount) {
      return false;
    }
    if (range.maximumGuestCount !== null && guestCount > range.maximumGuestCount) {
      return false;
    }
    return true;
  });
}

function recordMatchesQuery(
  record: PublicVendorRecord,
  query: PublicVendorSearchQueryDto,
): boolean {
  if (query.cuisine) {
    const cuisineQuery = normalize(query.cuisine);
    const matchesCuisine = record.cuisines.some(
      (cuisine) =>
        normalize(cuisine.id) === cuisineQuery ||
        normalize(cuisine.slug) === cuisineQuery ||
        normalize(cuisine.name) === cuisineQuery,
    );

    if (!matchesCuisine) {
      return false;
    }
  }

  if (query.serviceArea) {
    const areaQuery = normalize(query.serviceArea);
    const matchesArea = record.serviceAreas.some(
      (area) =>
        includesNormalized(area.metroArea, areaQuery) ||
        includesNormalized(area.city, areaQuery) ||
        includesNormalized(area.state, areaQuery) ||
        includesNormalized(area.postalCode, areaQuery),
    );

    if (!matchesArea) {
      return false;
    }
  }

  if (query.serviceStyle) {
    const serviceStyleQuery = normalize(query.serviceStyle);
    const menuServiceStyles = record.menus.flatMap((menu) => menu.menu.serviceStyles);

    if (
      !tagMatches(record.profile?.serviceStyles ?? [], serviceStyleQuery) &&
      !tagMatches(menuServiceStyles, serviceStyleQuery)
    ) {
      return false;
    }
  }

  if (query.guestCount !== undefined && !supportsGuestCount(record, query.guestCount)) {
    return false;
  }

  if (
    query.budgetMaxCents !== undefined &&
    record.vendor.cateringMinimumCents !== null &&
    record.vendor.cateringMinimumCents > query.budgetMaxCents
  ) {
    return false;
  }

  return true;
}

function toPublicCuisines(record: PublicVendorRecord): PublicCuisine[] {
  return record.cuisines.map((cuisine) => ({
    id: cuisine.id,
    name: cuisine.name,
    slug: cuisine.slug,
  }));
}

function toPublicServiceAreas(record: PublicVendorRecord): PublicServiceArea[] {
  return record.serviceAreas.map((area) => ({
    city: area.city,
    metroArea: area.metroArea,
    postalCode: area.postalCode,
    radiusMiles: area.radiusMiles,
    state: area.state,
  }));
}

function toPublicVendorCard(record: PublicVendorRecord): PublicVendorCard {
  return {
    averageResponseTimeMinutes: record.profile?.averageResponseTimeMinutes ?? null,
    businessName: record.vendor.businessName,
    cateringMinimumCents: record.vendor.cateringMinimumCents,
    cuisines: toPublicCuisines(record),
    description: record.profile?.publicDescription ?? record.vendor.description,
    dietaryAccommodations: record.profile?.dietaryAccommodations ?? [],
    headline: record.profile?.headline ?? null,
    id: record.vendor.id,
    minimumGuestCount: record.operatingSettings?.minimumGuestCount ?? null,
    pricingSummary: record.vendor.pricingSummary,
    publishedMenuCount: record.menus.length,
    samplePriceRangeCents: priceRangeFor(record),
    serviceAreas: toPublicServiceAreas(record),
    serviceStyles: record.profile?.serviceStyles ?? [],
    slug: record.vendor.slug,
    travelRadiusMiles: record.operatingSettings?.travelRadiusMiles ?? null,
  };
}

function toPublicMenuPreview(menuRecord: PublicMenuRecord): PublicMenuPreview {
  return {
    description: menuRecord.menu.description,
    dietaryTags: menuRecord.menu.dietaryTags,
    items: menuRecord.items.map((item) => ({
      category: item.category,
      description: item.description,
      dietaryTags: item.dietaryTags,
      name: item.name,
      priceCents: item.priceCents,
    })),
    maximumGuestCount: menuRecord.menu.maximumGuestCount,
    minimumGuestCount: menuRecord.menu.minimumGuestCount,
    name: menuRecord.menu.name,
    packages: menuRecord.packages.map((menuPackage) => ({
      description: menuPackage.description,
      dietaryTags: menuPackage.dietaryTags,
      maximumGuestCount: menuPackage.maximumGuestCount,
      minimumGuestCount: menuPackage.minimumGuestCount,
      name: menuPackage.name,
      priceCents: menuPackage.priceCents,
      pricingModel: menuPackage.pricingModel,
    })),
    serviceStyles: menuRecord.menu.serviceStyles,
  };
}

function toPublicVendorProfile(record: PublicVendorRecord): PublicVendorProfile {
  return {
    ...toPublicVendorCard(record),
    menus: record.menus.map(toPublicMenuPreview),
    minimumLeadTimeDays: record.operatingSettings?.minimumLeadTimeDays ?? null,
    publicDescription: record.profile?.publicDescription ?? record.vendor.description,
    quoteResponseTargetHours: record.operatingSettings?.quoteResponseTargetHours ?? null,
    socialLinks: record.profile?.socialLinks ?? {},
    websiteUrl: record.profile?.websiteUrl ?? null,
  };
}

export function createMarketplaceService(deps: MarketplaceServiceDeps): MarketplaceService {
  const { repository } = deps;

  return {
    async listCuisines() {
      const cuisines = await repository.listActiveCuisines();
      return cuisines.map((cuisine) => ({
        id: cuisine.id,
        name: cuisine.name,
        slug: cuisine.slug,
      }));
    },

    async searchPublicVendors(query) {
      const records = await repository.listPublicVendorRecords();
      const vendors = records
        .filter((record) => recordMatchesQuery(record, query))
        .slice(0, query.limit)
        .map(toPublicVendorCard);

      return {
        filters: query,
        vendors,
      };
    },

    async getPublicVendorProfile(vendorSlug) {
      const record = await repository.findPublicVendorRecordBySlug(vendorSlug);

      if (record === null) {
        throw new NotFoundError("Public vendor profile was not found.");
      }

      return toPublicVendorProfile(record);
    },
  };
}
