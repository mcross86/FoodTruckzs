import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { ApiEnv } from "../../config/env.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryMarketplaceRepository } from "../fakes/in-memory-marketplace-repository.js";
import { InMemoryRfqRepository } from "../fakes/in-memory-rfq-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";
import { createTestEnv } from "../test-env.js";

async function buildRfqTestApp(envOverrides: Partial<ApiEnv> = {}) {
  const authRepository = new InMemoryAuthRepository();
  const vendorRepository = new InMemoryVendorRepository();
  const marketplaceRepository = new InMemoryMarketplaceRepository(vendorRepository);
  const rfqRepository = new InMemoryRfqRepository(vendorRepository);
  const app = await buildApp({
    authRepository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(envOverrides),
    marketplaceRepository,
    rfqRepository,
    vendorRepository,
  });

  return { app, authRepository, rfqRepository, vendorRepository };
}

async function registerUser(
  app: Awaited<ReturnType<typeof buildApp>>,
  input: { email: string; firstName?: string; lastName?: string },
) {
  const response = await app.inject({
    method: "POST",
    payload: {
      email: input.email,
      firstName: input.firstName ?? "Test",
      lastName: input.lastName ?? "User",
      password: "StrongerPassword123!",
    },
    url: "/api/v1/auth/register",
  });

  expect(response.statusCode).toBe(201);
  const body = response.json();
  return {
    accessToken: body.data.accessToken as string,
    userId: body.data.user.id as string,
  };
}

async function seedVendor(
  vendorRepository: InMemoryVendorRepository,
  input: {
    businessName: string;
    cateringMinimumCents: number;
    city: string;
    cuisineName: string;
    cuisineSlug: string;
    serviceStyle: string;
    slug: string;
  },
) {
  const cuisine = await vendorRepository.createCuisine({
    isActive: true,
    name: input.cuisineName,
    slug: input.cuisineSlug,
  });
  const vendor = await vendorRepository.createVendor({
    businessName: input.businessName,
    cateringMinimumCents: input.cateringMinimumCents,
    description: `${input.businessName} description.`,
    pricingSummary: "Catering packages available.",
    slug: input.slug,
    status: "active",
  });

  vendorRepository.vendors.set(vendor.id, {
    ...vendor,
    approvalStatus: "approved",
    isPublished: true,
  });
  await vendorRepository.upsertProfile(vendor.id, {
    headline: `${input.businessName} catering`,
    publicDescription: `${input.businessName} caters local events.`,
    serviceStyles: [input.serviceStyle],
  });
  await vendorRepository.replaceVendorCuisines(vendor.id, [cuisine.id]);
  await vendorRepository.replaceServiceAreas(vendor.id, {
    serviceAreas: [{ city: input.city, metroArea: input.city, state: "GA" }],
  });
  await vendorRepository.upsertOperatingSettings(vendor.id, {
    minimumGuestCount: 20,
    minimumLeadTimeDays: 7,
    timezone: "America/New_York",
    travelRadiusMiles: 40,
  });

  return vendor;
}

function futureIso(daysFromNow: number, hoursFromStart = 0): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  date.setUTCHours(16 + hoursFromStart, 0, 0, 0);
  return date.toISOString();
}

function validRfqPayload(overrides: Record<string, unknown> = {}) {
  const payload = {
    attachments: [
      {
        category: "parking_map",
        contentType: "application/pdf",
        fileName: "parking-map.pdf",
        sizeBytes: 12_000,
      },
    ],
    budget: {
      budgetFlexibility: "Flexible for the right fit",
      budgetMaxCents: 250_000,
      budgetMinCents: 150_000,
      depositReadiness: "Ready this week",
      payer: "Customer pays full quote",
      quoteResponseDeadline: futureIso(9),
    },
    equipment: {
      expectsVendorServiceware: true,
      expectsVendorTablesOrTenting: false,
      requests: [{ item: "plates", quantity: 100, required: true }],
      trashCleanup: "Vendor handles service-area trash.",
    },
    eventBasics: {
      customerType: "company",
      endsAt: futureIso(10, 4),
      estimatedHeadcount: 100,
      eventName: "Lifecycle Launch Lunch",
      eventType: "Corporate lunch",
      isOpenToPublic: false,
      isRecurring: false,
      primaryContact: {
        email: "planner@example.com",
        name: "Pat Planner",
        phone: "4045551212",
      },
      startsAt: futureIso(10),
      timezone: "America/New_York",
    },
    foodRequirements: {
      allergyNotes: "One nut allergy.",
      cuisinePreferences: ["tacos"],
      dietaryAccommodations: ["vegetarian"],
      mealComponents: ["entrees", "sides"],
      menuPreference: "Use vendor recommendation",
      nutFreeRequired: true,
    },
    serviceStyle: {
      desiredServiceStyle: "truck onsite",
      guestPaymentModel: "Customer pays full quote",
      mealPeriod: "Lunch",
      serviceEndsAt: futureIso(10, 3),
      serviceStartsAt: futureIso(10, 1),
    },
    specialNotes: "Please keep the line moving quickly.",
    venue: {
      allowsFoodTrucks: true,
      city: "Atlanta",
      coiRequired: true,
      country: "US",
      generatorAllowed: true,
      indoorOutdoor: "outdoor",
      line1: "100 Event Way",
      onsiteContactName: "Sam Site",
      onsiteContactPhone: "4045553434",
      parkingNotes: "Use the north parking lot.",
      permitResponsibility: "Customer",
      powerAvailable: true,
      state: "GA",
      truckParkingLocation: "North lot by main entrance",
      venueName: "Atlanta Office",
      weatherBackupPlan: "Move guests under covered patio.",
    },
  };

  return {
    ...payload,
    ...overrides,
  };
}

describe("RFQ lifecycle routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("creates a general RFQ, deterministically targets matching vendors, and exposes customer/vendor reads", async () => {
    const { app, rfqRepository, vendorRepository } = await buildRfqTestApp();
    apps.push(app);
    const customer = await registerUser(app, { email: "rfq-customer@example.com" });
    const tacoVendor = await seedVendor(vendorRepository, {
      businessName: "Target Taco Truck",
      cateringMinimumCents: 100_000,
      city: "Atlanta",
      cuisineName: "Tacos",
      cuisineSlug: "tacos",
      serviceStyle: "truck onsite",
      slug: "target-taco-truck",
    });
    await seedVendor(vendorRepository, {
      businessName: "Filtered BBQ Truck",
      cateringMinimumCents: 100_000,
      city: "Atlanta",
      cuisineName: "BBQ",
      cuisineSlug: "bbq",
      serviceStyle: "buffet",
      slug: "filtered-bbq-truck",
    });

    const response = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: validRfqPayload(),
      url: "/api/v1/rfqs",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      completenessStatus: "complete",
      event: { eventName: "Lifecycle Launch Lunch" },
      status: "submitted",
    });
    expect(response.json().data.vendorTargets).toHaveLength(1);
    expect(response.json().data.vendorTargets[0].vendor.id).toBe(tacoVendor.id);
    expect(response.json().data.riskFlags).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "allergy_sensitive" })]),
    );
    expect([...rfqRepository.outboxEvents.values()]).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "rfq.submitted" })]),
    );
    expect([...rfqRepository.auditLogs.values()]).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "rfq.submitted" })]),
    );

    const listResponse = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "GET",
      url: "/api/v1/customers/me/rfqs",
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data).toHaveLength(1);
  });

  it("enforces RFQ validation gates before creation", async () => {
    const { app, vendorRepository } = await buildRfqTestApp();
    apps.push(app);
    const customer = await registerUser(app, { email: "rfq-validation@example.com" });
    await seedVendor(vendorRepository, {
      businessName: "Validation Taco Truck",
      cateringMinimumCents: 100_000,
      city: "Atlanta",
      cuisineName: "Tacos",
      cuisineSlug: "validation-tacos",
      serviceStyle: "truck onsite",
      slug: "validation-taco-truck",
    });
    const eventBasics = {
      ...(validRfqPayload().eventBasics as Record<string, unknown>),
      endsAt: futureIso(2, 4),
      startsAt: futureIso(2),
    };

    const response = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: validRfqPayload({ eventBasics }),
      url: "/api/v1/rfqs",
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toContain("7-day minimum booking lead time");
  });

  it("allows targeted vendors to accept, reject, and request clarification with authorization checks", async () => {
    const { app, authRepository, rfqRepository, vendorRepository } = await buildRfqTestApp();
    apps.push(app);
    const customer = await registerUser(app, { email: "rfq-owner@example.com" });
    const vendorUser = await registerUser(app, { email: "rfq-vendor@example.com" });
    const otherVendorUser = await registerUser(app, { email: "rfq-other-vendor@example.com" });
    const viewerUser = await registerUser(app, { email: "rfq-viewer@example.com" });
    const tacoVendor = await seedVendor(vendorRepository, {
      businessName: "Action Taco Truck",
      cateringMinimumCents: 100_000,
      city: "Atlanta",
      cuisineName: "Tacos",
      cuisineSlug: "action-tacos",
      serviceStyle: "truck onsite",
      slug: "action-taco-truck",
    });
    const otherVendor = await seedVendor(vendorRepository, {
      businessName: "Other Taco Truck",
      cateringMinimumCents: 100_000,
      city: "Atlanta",
      cuisineName: "Tacos",
      cuisineSlug: "other-tacos",
      serviceStyle: "truck onsite",
      slug: "other-taco-truck",
    });
    authRepository.addVendorMembership({
      role: "manager",
      userId: vendorUser.userId,
      vendorId: tacoVendor.id,
    });
    authRepository.addVendorMembership({
      role: "manager",
      userId: otherVendorUser.userId,
      vendorId: otherVendor.id,
    });
    authRepository.addVendorMembership({
      role: "viewer",
      userId: viewerUser.userId,
      vendorId: tacoVendor.id,
    });

    const createResponse = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: validRfqPayload({ targetVendorIds: [tacoVendor.id] }),
      url: "/api/v1/rfqs",
    });
    expect(createResponse.statusCode).toBe(201);
    const rfqId = createResponse.json().data.rfqId as string;
    const targetId = createResponse.json().data.vendorTargets[0].id as string;

    const unauthorizedAccept = await app.inject({
      headers: { authorization: `Bearer ${otherVendorUser.accessToken}` },
      method: "POST",
      payload: {},
      url: `/api/v1/rfqs/${rfqId}/vendor-targets/${targetId}/accept`,
    });
    expect(unauthorizedAccept.statusCode).toBe(403);

    const viewerAccept = await app.inject({
      headers: { authorization: `Bearer ${viewerUser.accessToken}` },
      method: "POST",
      payload: {},
      url: `/api/v1/rfqs/${rfqId}/vendor-targets/${targetId}/accept`,
    });
    expect(viewerAccept.statusCode).toBe(403);

    const acceptResponse = await app.inject({
      headers: { authorization: `Bearer ${vendorUser.accessToken}` },
      method: "POST",
      payload: { note: "Looks like a fit." },
      url: `/api/v1/rfqs/${rfqId}/vendor-targets/${targetId}/accept`,
    });
    expect(acceptResponse.statusCode).toBe(200);
    expect(acceptResponse.json().data.status).toBe("vendor_reviewing");
    expect(acceptResponse.json().data.vendorTargets[0].status).toBe("accepted");

    const clarificationResponse = await app.inject({
      headers: { authorization: `Bearer ${vendorUser.accessToken}` },
      method: "POST",
      payload: { body: "Can you confirm the truck parking dimensions?" },
      url: `/api/v1/rfqs/${rfqId}/request-clarification`,
    });
    expect(clarificationResponse.statusCode).toBe(201);
    expect(clarificationResponse.json().data.status).toBe("clarification_requested");
    expect(clarificationResponse.json().data.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ body: "Can you confirm the truck parking dimensions?" }),
      ]),
    );
    expect([...rfqRepository.outboxEvents.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "rfq.clarification_requested" }),
      ]),
    );

    const rejectCreateResponse = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: validRfqPayload({
        eventBasics: {
          ...(validRfqPayload().eventBasics as Record<string, unknown>),
          eventName: "Rejectable RFQ",
        },
        targetVendorIds: [tacoVendor.id],
      }),
      url: "/api/v1/rfqs",
    });
    expect(rejectCreateResponse.statusCode).toBe(201);
    const rejectRfqId = rejectCreateResponse.json().data.rfqId as string;
    const rejectTargetId = rejectCreateResponse.json().data.vendorTargets[0].id as string;

    const rejectResponse = await app.inject({
      headers: { authorization: `Bearer ${vendorUser.accessToken}` },
      method: "POST",
      payload: { reasonCode: "unavailable", note: "Already booked." },
      url: `/api/v1/rfqs/${rejectRfqId}/vendor-targets/${rejectTargetId}/reject`,
    });
    expect(rejectResponse.statusCode).toBe(200);
    expect(rejectResponse.json().data.vendorTargets[0]).toMatchObject({
      rejectedReason: "unavailable",
      status: "rejected",
    });
  });

  it("scopes message threads to RFQ customer and targeted vendor members", async () => {
    const { app, authRepository, vendorRepository } = await buildRfqTestApp();
    apps.push(app);
    const customer = await registerUser(app, { email: "thread-customer@example.com" });
    const otherCustomer = await registerUser(app, { email: "thread-other-customer@example.com" });
    const firstVendorUser = await registerUser(app, { email: "thread-first-vendor@example.com" });
    const secondVendorUser = await registerUser(app, { email: "thread-second-vendor@example.com" });
    const firstVendor = await seedVendor(vendorRepository, {
      businessName: "Thread Taco Truck",
      cateringMinimumCents: 100_000,
      city: "Atlanta",
      cuisineName: "Tacos",
      cuisineSlug: "thread-tacos",
      serviceStyle: "truck onsite",
      slug: "thread-taco-truck",
    });
    const secondVendor = await seedVendor(vendorRepository, {
      businessName: "Thread Burger Truck",
      cateringMinimumCents: 100_000,
      city: "Atlanta",
      cuisineName: "Tacos",
      cuisineSlug: "thread-burgers",
      serviceStyle: "truck onsite",
      slug: "thread-burger-truck",
    });
    authRepository.addVendorMembership({
      role: "manager",
      userId: firstVendorUser.userId,
      vendorId: firstVendor.id,
    });
    authRepository.addVendorMembership({
      role: "manager",
      userId: secondVendorUser.userId,
      vendorId: secondVendor.id,
    });

    const createResponse = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: validRfqPayload({ targetVendorIds: [firstVendor.id, secondVendor.id] }),
      url: "/api/v1/rfqs",
    });
    expect(createResponse.statusCode).toBe(201);
    const rfqId = createResponse.json().data.rfqId as string;
    const firstVendorTargetId = createResponse
      .json()
      .data.vendorTargets.find(
        (target: { vendor: { id: string } }) => target.vendor.id === firstVendor.id,
      ).id as string;
    const firstVendorThreadId = createResponse
      .json()
      .data.threads.find((thread: { vendorId: string }) => thread.vendorId === firstVendor.id)
      .id as string;

    const firstVendorDetail = await app.inject({
      headers: { authorization: `Bearer ${firstVendorUser.accessToken}` },
      method: "GET",
      url: `/api/v1/rfqs/${rfqId}`,
    });
    expect(firstVendorDetail.statusCode).toBe(200);
    expect(firstVendorDetail.json().data.vendorTargets).toHaveLength(1);
    expect(firstVendorDetail.json().data.threads).toEqual([
      expect.objectContaining({ id: firstVendorThreadId, vendorId: firstVendor.id }),
    ]);

    const otherCustomerThreadRead = await app.inject({
      headers: { authorization: `Bearer ${otherCustomer.accessToken}` },
      method: "GET",
      url: `/api/v1/message-threads/${firstVendorThreadId}/messages`,
    });
    expect(otherCustomerThreadRead.statusCode).toBe(403);

    const secondVendorThreadRead = await app.inject({
      headers: { authorization: `Bearer ${secondVendorUser.accessToken}` },
      method: "GET",
      url: `/api/v1/message-threads/${firstVendorThreadId}/messages`,
    });
    expect(secondVendorThreadRead.statusCode).toBe(403);

    const customerAcceptAttempt = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: {},
      url: `/api/v1/rfqs/${rfqId}/vendor-targets/${firstVendorTargetId}/accept`,
    });
    expect(customerAcceptAttempt.statusCode).toBe(403);

    const clarificationResponse = await app.inject({
      headers: { authorization: `Bearer ${firstVendorUser.accessToken}` },
      method: "POST",
      payload: { body: "Can you confirm if the truck can park on the north side?" },
      url: `/api/v1/rfqs/${rfqId}/request-clarification`,
    });
    expect(clarificationResponse.statusCode).toBe(201);
    expect(clarificationResponse.json().data.status).toBe("clarification_requested");

    const customerReply = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: { body: "Yes, the north lot has 40 feet reserved for the truck." },
      url: `/api/v1/message-threads/${firstVendorThreadId}/messages`,
    });
    expect(customerReply.statusCode).toBe(201);
    expect(customerReply.json().data.status).toBe("vendor_reviewing");

    const firstVendorMessages = await app.inject({
      headers: { authorization: `Bearer ${firstVendorUser.accessToken}` },
      method: "GET",
      url: `/api/v1/message-threads/${firstVendorThreadId}/messages`,
    });
    expect(firstVendorMessages.statusCode).toBe(200);
    expect(firstVendorMessages.json().data.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ body: "Yes, the north lot has 40 feet reserved for the truck." }),
      ]),
    );
    expect(firstVendorMessages.json().data.thread.unreadCount).toBe(1);

    const markReadResponse = await app.inject({
      headers: { authorization: `Bearer ${firstVendorUser.accessToken}` },
      method: "POST",
      payload: {},
      url: `/api/v1/message-threads/${firstVendorThreadId}/read`,
    });
    expect(markReadResponse.statusCode).toBe(200);
    expect(markReadResponse.json().data.unreadMessageCount).toBe(0);

    const secondVendorSendAttempt = await app.inject({
      headers: { authorization: `Bearer ${secondVendorUser.accessToken}` },
      method: "POST",
      payload: { body: "Trying to enter another vendor thread." },
      url: `/api/v1/message-threads/${firstVendorThreadId}/messages`,
    });
    expect(secondVendorSendAttempt.statusCode).toBe(403);
  });

  it("rate limits RFQ submission and RFQ-scoped messaging", async () => {
    const { app, authRepository, vendorRepository } = await buildRfqTestApp({
      rateLimitMessagingMax: 1,
      rateLimitMessagingWindowMs: 60_000,
      rateLimitRfqSubmissionMax: 1,
      rateLimitRfqSubmissionWindowMs: 60_000,
    });
    apps.push(app);
    const customer = await registerUser(app, { email: "rfq-rate-limit-customer@example.com" });
    const vendorUser = await registerUser(app, { email: "rfq-rate-limit-vendor@example.com" });
    const vendor = await seedVendor(vendorRepository, {
      businessName: "Rate Limit Taco Truck",
      cateringMinimumCents: 100_000,
      city: "Atlanta",
      cuisineName: "Tacos",
      cuisineSlug: "rate-limit-tacos",
      serviceStyle: "truck onsite",
      slug: "rate-limit-taco-truck",
    });
    authRepository.addVendorMembership({
      role: "manager",
      userId: vendorUser.userId,
      vendorId: vendor.id,
    });

    const createResponse = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: validRfqPayload({ targetVendorIds: [vendor.id] }),
      url: "/api/v1/rfqs",
    });
    const limitedRfqResponse = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: validRfqPayload({
        eventBasics: {
          ...(validRfqPayload().eventBasics as Record<string, unknown>),
          eventName: "Second rate-limited RFQ",
        },
        targetVendorIds: [vendor.id],
      }),
      url: "/api/v1/rfqs",
    });

    expect(createResponse.statusCode).toBe(201);
    expect(limitedRfqResponse.statusCode).toBe(429);
    expect(limitedRfqResponse.json()).toMatchObject({
      error: {
        code: "RATE_LIMITED",
        details: { limit: 1 },
      },
    });

    const threadId = createResponse.json().data.threads[0].id as string;
    const firstMessage = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: { body: "First customer note for the vendor." },
      url: `/api/v1/message-threads/${threadId}/messages`,
    });
    const limitedMessage = await app.inject({
      headers: { authorization: `Bearer ${customer.accessToken}` },
      method: "POST",
      payload: { body: "Second customer note should be rate limited." },
      url: `/api/v1/message-threads/${threadId}/messages`,
    });

    expect(firstMessage.statusCode).toBe(201);
    expect(limitedMessage.statusCode).toBe(429);
    expect(limitedMessage.json().error.code).toBe("RATE_LIMITED");
  });
});
