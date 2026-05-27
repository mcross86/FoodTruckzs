import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { InMemoryAgreementRepository } from "../fakes/in-memory-agreement-repository.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryBillingRepository } from "../fakes/in-memory-billing-repository.js";
import { InMemoryQuoteRepository } from "../fakes/in-memory-quote-repository.js";
import { InMemoryRfqRepository } from "../fakes/in-memory-rfq-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";
import { createTestEnv } from "../test-env.js";

const validPassword = "FoodTruck1234";

async function buildVendorTestApp() {
  const authRepository = new InMemoryAuthRepository();
  const vendorRepository = new InMemoryVendorRepository();
  const rfqRepository = new InMemoryRfqRepository(vendorRepository);
  const quoteRepository = new InMemoryQuoteRepository(rfqRepository);
  const agreementRepository = new InMemoryAgreementRepository(
    quoteRepository,
    rfqRepository,
    vendorRepository,
  );
  const billingRepository = new InMemoryBillingRepository(agreementRepository, vendorRepository);
  const app = await buildApp({
    agreementRepository,
    authRepository,
    billingRepository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(),
    quoteRepository,
    rfqRepository,
    vendorRepository,
  });

  return { app, authRepository, vendorRepository };
}

async function registerUser(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
  firstName = "Vendor",
) {
  const response = await app.inject({
    method: "POST",
    payload: {
      email,
      firstName,
      lastName: "Tester",
      password: validPassword,
    },
    url: "/api/v1/auth/register",
  });

  return {
    accessToken: response.json().data.accessToken as string,
    response,
  };
}

function authHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

describe("vendor operations routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("creates vendor setup and enforces vendor role checks", async () => {
    const { app, authRepository, vendorRepository } = await buildVendorTestApp();
    apps.push(app);
    const cuisine = await vendorRepository.createCuisine({
      isActive: true,
      name: "Tacos",
      slug: "tacos",
    });
    const { accessToken } = await registerUser(app, "owner@example.com");

    const createResponse = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: {
        businessEmail: "hello@tacotruck.test",
        businessName: "Taco Test Truck",
        cateringMinimumCents: 150_000,
        cuisineIds: [cuisine.id],
        ownerContactName: "Tess Owner",
        profileDescription: "Street tacos for catered events.",
        serviceAreas: [
          {
            city: "Atlanta",
            metroArea: "Atlanta",
            radiusMiles: 35,
            state: "GA",
          },
        ],
        serviceStyles: ["truck onsite", "buffet"],
        settings: {
          minimumLeadTimeDays: 7,
          timezone: "America/New_York",
          travelRadiusMiles: 35,
        },
      },
      url: "/api/v1/vendors",
    });

    expect(createResponse.statusCode).toBe(201);
    const vendorId = createResponse.json().data.vendor.id as string;
    const ownerUser = [...authRepository.users.values()].find(
      (user) => user.email === "owner@example.com",
    )!;
    authRepository.addVendorMembership({
      role: "owner",
      userId: ownerUser.id,
      vendorId,
    });

    const patchResponse = await app.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: {
        headline: "Fast tacos for big groups",
        isPublished: false,
      },
      url: `/api/v1/vendors/${vendorId}/profile`,
    });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().data.profile.headline).toBe("Fast tacos for big groups");

    const { accessToken: viewerToken } = await registerUser(app, "viewer@example.com", "View");
    const viewerUser = [...authRepository.users.values()].find(
      (user) => user.email === "viewer@example.com",
    )!;
    await vendorRepository.createMembership({
      role: "viewer",
      status: "active",
      userId: viewerUser.id,
      vendorId,
    });
    authRepository.addVendorMembership({
      role: "viewer",
      userId: viewerUser.id,
      vendorId,
    });

    const readResponse = await app.inject({
      headers: authHeaders(viewerToken),
      method: "GET",
      url: `/api/v1/vendors/${vendorId}/profile`,
    });
    expect(readResponse.statusCode).toBe(200);

    const deniedPatchResponse = await app.inject({
      headers: authHeaders(viewerToken),
      method: "PATCH",
      payload: {
        headline: "Viewer edit attempt",
      },
      url: `/api/v1/vendors/${vendorId}/profile`,
    });

    expect(deniedPatchResponse.statusCode).toBe(403);
    expect(deniedPatchResponse.json().error.code).toBe("VENDOR_ACCESS_DENIED");
  });

  it("validates availability, menus, and billing settings within vendor scope", async () => {
    const { app, authRepository, vendorRepository } = await buildVendorTestApp();
    apps.push(app);
    const cuisine = await vendorRepository.createCuisine({
      isActive: true,
      name: "BBQ",
      slug: "bbq",
    });
    const { accessToken } = await registerUser(app, "ops@example.com");

    const createResponse = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: {
        businessName: "BBQ Ops Truck",
        cateringMinimumCents: 200_000,
        cuisineIds: [cuisine.id],
        serviceAreas: [{ metroArea: "Austin", state: "TX" }],
        serviceStyles: ["truck onsite"],
        settings: {
          minimumLeadTimeDays: 7,
          timezone: "America/Chicago",
          travelRadiusMiles: 50,
        },
      },
      url: "/api/v1/vendors",
    });
    const vendorId = createResponse.json().data.vendor.id as string;
    const ownerUser = [...authRepository.users.values()].find(
      (user) => user.email === "ops@example.com",
    )!;
    authRepository.addVendorMembership({
      role: "owner",
      userId: ownerUser.id,
      vendorId,
    });

    const overlappingAvailabilityResponse = await app.inject({
      headers: authHeaders(accessToken),
      method: "PUT",
      payload: {
        exceptions: [],
        rules: [
          {
            dayOfWeek: 5,
            endsAtLocal: "14:00",
            startsAtLocal: "10:00",
            timezone: "America/Chicago",
          },
          {
            dayOfWeek: 5,
            endsAtLocal: "16:00",
            startsAtLocal: "13:00",
            timezone: "America/Chicago",
          },
        ],
        settings: {
          minimumLeadTimeDays: 7,
          requestAnywayOnBlackout: false,
          timezone: "America/Chicago",
          travelRadiusMiles: 50,
        },
      },
      url: `/api/v1/vendors/${vendorId}/availability`,
    });

    expect(overlappingAvailabilityResponse.statusCode).toBe(409);
    expect(overlappingAvailabilityResponse.json().error.code).toBe("CONFLICT");

    const emptyMenuResponse = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: {
        name: "Empty Catering Menu",
      },
      url: `/api/v1/vendors/${vendorId}/menus`,
    });

    expect(emptyMenuResponse.statusCode).toBe(400);

    const menuResponse = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: {
        items: [
          {
            name: "Brisket Plate",
            priceCents: 2200,
          },
        ],
        name: "Corporate BBQ",
        packages: [
          {
            minimumGuestCount: 25,
            name: "Smokehouse Buffet",
            priceCents: 2800,
            pricingModel: "per_person",
          },
        ],
      },
      url: `/api/v1/vendors/${vendorId}/menus`,
    });

    expect(menuResponse.statusCode).toBe(201);
    expect(menuResponse.json().data.items).toHaveLength(1);
    expect(menuResponse.json().data.packages).toHaveLength(1);

    const { accessToken: adminToken } = await registerUser(app, "admin@example.com", "Admin");
    const adminUser = [...authRepository.users.values()].find(
      (user) => user.email === "admin@example.com",
    )!;
    authRepository.users.set(adminUser.id, {
      ...adminUser,
      globalRoles: ["platform_admin"],
    });

    const billingUpdateResponse = await app.inject({
      headers: authHeaders(adminToken),
      method: "PATCH",
      payload: {
        agreementFeeBasisPoints: 750,
        billingEmail: "billing@bbqops.test",
        invoiceTermsDays: 15,
      },
      url: `/api/v1/admin/vendors/${vendorId}/billing-settings`,
    });

    expect(billingUpdateResponse.statusCode).toBe(200);
    expect(billingUpdateResponse.json().data.agreementFeeBasisPoints).toBe(750);

    const vendorBillingReadResponse = await app.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: `/api/v1/vendors/${vendorId}/platform-billing`,
    });

    expect(vendorBillingReadResponse.statusCode).toBe(200);
    expect(vendorBillingReadResponse.json().data).toMatchObject({
      agreementFeeBasisPoints: 750,
      billingEmail: "billing@bbqops.test",
    });
  });
});
