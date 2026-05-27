import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryMarketplaceRepository } from "../fakes/in-memory-marketplace-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";
import { createTestEnv } from "../test-env.js";

async function buildMarketplaceTestApp() {
  const authRepository = new InMemoryAuthRepository();
  const vendorRepository = new InMemoryVendorRepository();
  const marketplaceRepository = new InMemoryMarketplaceRepository(vendorRepository);
  const app = await buildApp({
    authRepository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(),
    marketplaceRepository,
    vendorRepository,
  });

  return { app, vendorRepository };
}

async function seedVendor(
  vendorRepository: InMemoryVendorRepository,
  input: {
    approvalStatus?: "approved" | "pending" | "rejected";
    budgetMinimumCents: number;
    businessName: string;
    city: string;
    cuisineName: string;
    cuisineSlug: string;
    guestMaximum?: number;
    guestMinimum?: number;
    isPublished?: boolean;
    packagePriceCents: number;
    serviceStyle: string;
    slug: string;
    status?: "active" | "suspended" | "closed";
  },
) {
  const cuisine = await vendorRepository.createCuisine({
    isActive: true,
    name: input.cuisineName,
    slug: input.cuisineSlug,
  });
  const vendor = await vendorRepository.createVendor({
    businessName: input.businessName,
    cateringMinimumCents: input.budgetMinimumCents,
    description: `${input.businessName} public description.`,
    pricingSummary: "Sample catering packages available.",
    slug: input.slug,
    status: input.status ?? "active",
  });
  vendorRepository.vendors.set(vendor.id, {
    ...vendor,
    approvalStatus: input.approvalStatus ?? "approved",
    isPublished: input.isPublished ?? true,
    status: input.status ?? "active",
  });
  await vendorRepository.upsertProfile(vendor.id, {
    headline: `${input.businessName} headline`,
    publicDescription: `${input.businessName} serves catered events.`,
    serviceStyles: [input.serviceStyle],
  });
  await vendorRepository.replaceVendorCuisines(vendor.id, [cuisine.id]);
  await vendorRepository.replaceServiceAreas(vendor.id, {
    serviceAreas: [{ city: input.city, metroArea: input.city, state: "GA" }],
  });
  await vendorRepository.upsertOperatingSettings(vendor.id, {
    minimumGuestCount: input.guestMinimum,
    minimumLeadTimeDays: 7,
    timezone: "America/New_York",
    travelRadiusMiles: 40,
  });
  await vendorRepository.createMenu(vendor.id, {
    dietaryTags: [],
    isPublic: true,
    items: [
      {
        dietaryTags: [],
        isAvailable: true,
        name: `${input.businessName} sample item`,
        priceCents: input.packagePriceCents,
        sortOrder: 0,
      },
    ],
    maximumGuestCount: input.guestMaximum,
    minimumGuestCount: input.guestMinimum,
    name: `${input.businessName} public catering menu`,
    packages: [
      {
        dietaryTags: [],
        includedItemIds: [],
        isAvailable: true,
        maximumGuestCount: input.guestMaximum,
        minimumGuestCount: input.guestMinimum,
        name: `${input.businessName} event package`,
        priceCents: input.packagePriceCents,
        pricingModel: "per_person",
        sortOrder: 0,
      },
    ],
    serviceStyles: [input.serviceStyle],
    status: "published",
  });

  return vendor;
}

describe("public marketplace routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("filters public vendor search by cuisine, service area, service style, guest count, and budget", async () => {
    const { app, vendorRepository } = await buildMarketplaceTestApp();
    apps.push(app);
    const tacoVendor = await seedVendor(vendorRepository, {
      budgetMinimumCents: 150_000,
      businessName: "Taco Search Truck",
      city: "Atlanta",
      cuisineName: "Tacos",
      cuisineSlug: "tacos",
      guestMaximum: 200,
      guestMinimum: 25,
      packagePriceCents: 1800,
      serviceStyle: "truck onsite",
      slug: "taco-search-truck",
    });
    await seedVendor(vendorRepository, {
      budgetMinimumCents: 500_000,
      businessName: "BBQ Budget Truck",
      city: "Atlanta",
      cuisineName: "BBQ",
      cuisineSlug: "bbq",
      guestMaximum: 500,
      guestMinimum: 100,
      packagePriceCents: 3200,
      serviceStyle: "buffet",
      slug: "bbq-budget-truck",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/marketplace/vendors?cuisine=tacos&serviceArea=Atlanta&serviceStyle=truck%20onsite&guestCount=50&budgetMaxCents=200000",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.vendors).toHaveLength(1);
    expect(response.json().data.vendors[0]).toMatchObject({
      businessName: "Taco Search Truck",
      id: tacoVendor.id,
      slug: "taco-search-truck",
    });
  });

  it("hides unpublished and suspended vendors from public search and profiles", async () => {
    const { app, vendorRepository } = await buildMarketplaceTestApp();
    apps.push(app);
    await seedVendor(vendorRepository, {
      budgetMinimumCents: 100_000,
      businessName: "Visible Taco Truck",
      city: "Atlanta",
      cuisineName: "Visible Tacos",
      cuisineSlug: "visible-tacos",
      packagePriceCents: 1500,
      serviceStyle: "truck onsite",
      slug: "visible-taco-truck",
    });
    await seedVendor(vendorRepository, {
      budgetMinimumCents: 100_000,
      businessName: "Unpublished Taco Truck",
      city: "Atlanta",
      cuisineName: "Unpublished Tacos",
      cuisineSlug: "unpublished-tacos",
      isPublished: false,
      packagePriceCents: 1500,
      serviceStyle: "truck onsite",
      slug: "unpublished-taco-truck",
    });
    await seedVendor(vendorRepository, {
      budgetMinimumCents: 100_000,
      businessName: "Suspended Taco Truck",
      city: "Atlanta",
      cuisineName: "Suspended Tacos",
      cuisineSlug: "suspended-tacos",
      packagePriceCents: 1500,
      serviceStyle: "truck onsite",
      slug: "suspended-taco-truck",
      status: "suspended",
    });

    const searchResponse = await app.inject({
      method: "GET",
      url: "/api/v1/marketplace/vendors?serviceArea=Atlanta",
    });

    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json().data.vendors).toHaveLength(1);
    expect(searchResponse.json().data.vendors[0].slug).toBe("visible-taco-truck");

    const unpublishedProfileResponse = await app.inject({
      method: "GET",
      url: "/api/v1/marketplace/vendors/unpublished-taco-truck",
    });
    const suspendedProfileResponse = await app.inject({
      method: "GET",
      url: "/api/v1/marketplace/vendors/suspended-taco-truck",
    });

    expect(unpublishedProfileResponse.statusCode).toBe(404);
    expect(suspendedProfileResponse.statusCode).toBe(404);
  });
});
