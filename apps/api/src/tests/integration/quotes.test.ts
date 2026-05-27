import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryMarketplaceRepository } from "../fakes/in-memory-marketplace-repository.js";
import { InMemoryQuoteRepository } from "../fakes/in-memory-quote-repository.js";
import { InMemoryRfqRepository } from "../fakes/in-memory-rfq-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";
import { createTestEnv } from "../test-env.js";

async function buildQuoteTestApp() {
  const authRepository = new InMemoryAuthRepository();
  const vendorRepository = new InMemoryVendorRepository();
  const marketplaceRepository = new InMemoryMarketplaceRepository(vendorRepository);
  const rfqRepository = new InMemoryRfqRepository(vendorRepository);
  const quoteRepository = new InMemoryQuoteRepository(rfqRepository);
  const app = await buildApp({
    authRepository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(),
    marketplaceRepository,
    quoteRepository,
    rfqRepository,
    vendorRepository,
  });

  return { app, authRepository, quoteRepository, rfqRepository, vendorRepository };
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
    city: string;
    cuisineName: string;
    cuisineSlug: string;
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
    cateringMinimumCents: 100_000,
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
    serviceStyles: ["truck onsite"],
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

function validRfqPayload(vendorId: string) {
  return {
    attachments: [],
    budget: {
      budgetFlexibility: "Flexible for the right fit",
      budgetMaxCents: 350_000,
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
      eventName: "Quote Launch Lunch",
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
      dishesToAvoid: [],
      mealComponents: ["entrees", "sides"],
      menuPreference: "Use vendor recommendation",
      mustHaveDishes: [],
      nutFreeRequired: true,
    },
    serviceStyle: {
      desiredServiceStyle: "truck onsite",
      guestPaymentModel: "Customer pays full quote",
      mealPeriod: "Lunch",
      serviceEndsAt: futureIso(10, 3),
      serviceStartsAt: futureIso(10, 1),
    },
    targetVendorIds: [vendorId],
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
}

function quotePayload(vendorId: string, overrides: Record<string, unknown> = {}) {
  const payload = {
    assumptions: [
      "Pricing assumes 100 guests.",
      "Truck can park in the north lot for the full service window.",
    ],
    cancellationPolicySummary: "Deposit is non-refundable inside 7 days of the event.",
    depositRequiredCents: 50_000,
    exclusions: [
      "Alcohol service is excluded.",
      "Customer provides trash removal outside service area.",
    ],
    expiresAt: futureIso(5),
    lineItems: [
      {
        name: "Taco package",
        quantity: 100,
        taxable: true,
        type: "food",
        unit: "guest",
        unitAmountCents: 1_500,
      },
      {
        name: "Service fee",
        quantity: 1,
        taxable: false,
        type: "service",
        unit: "event",
        unitAmountCents: 20_000,
      },
      {
        name: "Staffing",
        quantity: 2,
        taxable: false,
        type: "staffing",
        unit: "staff",
        unitAmountCents: 15_000,
      },
      {
        name: "Travel",
        quantity: 1,
        taxable: false,
        type: "travel",
        unit: "event",
        unitAmountCents: 5_000,
      },
      {
        name: "Rental package",
        quantity: 1,
        taxable: true,
        type: "rental",
        unit: "event",
        unitAmountCents: 12_000,
      },
      {
        name: "Gratuity",
        quantity: 1,
        taxable: false,
        type: "gratuity",
        unit: "event",
        unitAmountCents: 10_000,
      },
      {
        name: "Service charge",
        quantity: 1,
        taxable: false,
        type: "service_charge",
        unit: "event",
        unitAmountCents: 8_000,
      },
      {
        name: "Overtime rate",
        quantity: 4,
        taxable: false,
        type: "overtime",
        unit: "hour",
        unitAmountCents: 5_000,
      },
      {
        name: "Estimated tax",
        quantity: 1,
        taxable: false,
        type: "tax",
        unit: "event",
        unitAmountCents: 17_000,
      },
    ],
    menuSummary: "Two taco entrees, vegetarian option, chips, salsa, and aguas frescas.",
    notes: "Initial quote based on the submitted RFQ.",
    paymentSchedule: [
      {
        amountCents: 50_000,
        dueAt: futureIso(6),
        label: "Deposit due at agreement",
        type: "deposit",
      },
      {
        amountCents: 222_000,
        dueAt: futureIso(9),
        label: "Final balance before event",
        type: "final_balance",
      },
    ],
    serviceStyle: "Truck onsite hosted meal service.",
    vendorId,
  };

  return {
    ...payload,
    ...overrides,
  };
}

async function createAcceptedRfqFixture() {
  const { app, authRepository, quoteRepository, rfqRepository, vendorRepository } =
    await buildQuoteTestApp();
  const customer = await registerUser(app, {
    email: `customer-${crypto.randomUUID()}@example.com`,
  });
  const vendorUser = await registerUser(app, {
    email: `vendor-${crypto.randomUUID()}@example.com`,
  });
  const vendor = await seedVendor(vendorRepository, {
    businessName: "Quote Taco Truck",
    city: "Atlanta",
    cuisineName: "Tacos",
    cuisineSlug: `tacos-${crypto.randomUUID()}`,
    slug: `quote-taco-truck-${crypto.randomUUID()}`,
  });
  authRepository.addVendorMembership({
    role: "owner",
    userId: vendorUser.userId,
    vendorId: vendor.id,
  });
  const rfqResponse = await app.inject({
    headers: { authorization: `Bearer ${customer.accessToken}` },
    method: "POST",
    payload: validRfqPayload(vendor.id),
    url: "/api/v1/rfqs",
  });
  expect(rfqResponse.statusCode).toBe(201);
  const rfq = rfqResponse.json().data;
  const targetId = rfq.vendorTargets[0].id as string;
  const acceptResponse = await app.inject({
    headers: { authorization: `Bearer ${vendorUser.accessToken}` },
    method: "POST",
    payload: { note: "Ready to quote." },
    url: `/api/v1/rfqs/${rfq.rfqId}/vendor-targets/${targetId}/accept`,
  });
  expect(acceptResponse.statusCode).toBe(200);

  return { app, authRepository, customer, quoteRepository, rfq, rfqRepository, vendor, vendorUser };
}

describe("quote lifecycle routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("creates a sent quote with server-calculated totals, payment schedule, and RFQ status updates", async () => {
    const fixture = await createAcceptedRfqFixture();
    apps.push(fixture.app);

    const response = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: quotePayload(fixture.vendor.id),
      url: `/api/v1/rfqs/${fixture.rfq.rfqId}/quotes`,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      currentRevision: {
        depositRequiredCents: 50_000,
        feesCents: 105_000,
        lineItems: expect.arrayContaining([
          expect.objectContaining({ totalAmountCents: 150_000, type: "food" }),
          expect.objectContaining({ totalAmountCents: 20_000, type: "overtime" }),
          expect.objectContaining({ totalAmountCents: 17_000, type: "tax" }),
        ]),
        paymentSchedule: expect.arrayContaining([
          expect.objectContaining({ amountCents: 50_000, type: "deposit" }),
          expect.objectContaining({ amountCents: 222_000, type: "final_balance" }),
        ]),
        subtotalCents: 150_000,
        taxCents: 17_000,
        totalCents: 272_000,
      },
      quote: {
        depositRequiredCents: 50_000,
        feesCents: 105_000,
        status: "sent",
        subtotalCents: 150_000,
        taxCents: 17_000,
        totalCents: 272_000,
      },
      rfq: {
        status: "quote_sent",
      },
    });

    const reloadedRfq = await fixture.rfqRepository.findRfqDetailById(fixture.rfq.rfqId);
    expect(reloadedRfq?.rfq.status).toBe("quote_sent");
    expect(reloadedRfq?.targets[0]?.target.status).toBe("quote_sent");
  });

  it("creates immutable revisions and preserves prior line items", async () => {
    const fixture = await createAcceptedRfqFixture();
    apps.push(fixture.app);
    const createResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: quotePayload(fixture.vendor.id),
      url: `/api/v1/rfqs/${fixture.rfq.rfqId}/quotes`,
    });
    expect(createResponse.statusCode).toBe(201);
    const quoteId = createResponse.json().data.quote.id as string;
    const firstRevisionId = createResponse.json().data.currentRevision.id as string;

    const revisionResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: quotePayload(fixture.vendor.id, {
        lineItems: [
          ...quotePayload(fixture.vendor.id).lineItems,
          {
            name: "Late-night snack add-on",
            quantity: 100,
            taxable: true,
            type: "food",
            unit: "guest",
            unitAmountCents: 500,
          },
        ],
        notes: "Added late-night snack service.",
        paymentSchedule: [
          {
            amountCents: 50_000,
            dueAt: futureIso(6),
            label: "Deposit due at agreement",
            type: "deposit",
          },
          {
            amountCents: 272_000,
            dueAt: futureIso(9),
            label: "Final balance before event",
            type: "final_balance",
          },
        ],
      }),
      url: `/api/v1/quotes/${quoteId}/revisions`,
    });

    expect(revisionResponse.statusCode).toBe(201);
    expect(revisionResponse.json().data.revisions).toHaveLength(2);
    expect(revisionResponse.json().data.currentRevision).toMatchObject({
      revisionNumber: 2,
      subtotalCents: 200_000,
      totalCents: 322_000,
    });
    expect(revisionResponse.json().data.revisions[0]).toMatchObject({
      id: firstRevisionId,
      revisionNumber: 1,
      subtotalCents: 150_000,
      totalCents: 272_000,
    });
    expect(fixture.quoteRepository.lineItems.size).toBe(19);
  });

  it("rejects payment schedules that do not match quote totals or required deposits", async () => {
    const fixture = await createAcceptedRfqFixture();
    apps.push(fixture.app);

    const totalMismatchResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: quotePayload(fixture.vendor.id, {
        paymentSchedule: [
          {
            amountCents: 50_000,
            dueAt: futureIso(6),
            label: "Deposit due at agreement",
            type: "deposit",
          },
          {
            amountCents: 200_000,
            dueAt: futureIso(9),
            label: "Final balance before event",
            type: "final_balance",
          },
        ],
      }),
      url: `/api/v1/rfqs/${fixture.rfq.rfqId}/quotes`,
    });
    const depositMismatchResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: quotePayload(fixture.vendor.id, {
        paymentSchedule: [
          {
            amountCents: 40_000,
            dueAt: futureIso(6),
            label: "Deposit due at agreement",
            type: "deposit",
          },
          {
            amountCents: 232_000,
            dueAt: futureIso(9),
            label: "Final balance before event",
            type: "final_balance",
          },
        ],
      }),
      url: `/api/v1/rfqs/${fixture.rfq.rfqId}/quotes`,
    });

    expect(totalMismatchResponse.statusCode).toBe(422);
    expect(totalMismatchResponse.json().error).toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
      details: {
        paymentScheduleTotalCents: 250_000,
        quoteTotalCents: 272_000,
      },
    });
    expect(depositMismatchResponse.statusCode).toBe(422);
    expect(depositMismatchResponse.json().error).toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
      details: {
        depositRequiredCents: 50_000,
        depositScheduleTotalCents: 40_000,
      },
    });
  });

  it("enforces vendor authorization for quote creation", async () => {
    const fixture = await createAcceptedRfqFixture();
    apps.push(fixture.app);
    const viewer = await registerUser(fixture.app, {
      email: `viewer-${crypto.randomUUID()}@example.com`,
    });
    fixture.authRepository.addVendorMembership({
      role: "viewer",
      userId: viewer.userId,
      vendorId: fixture.vendor.id,
    });

    const response = await fixture.app.inject({
      headers: { authorization: `Bearer ${viewer.accessToken}` },
      method: "POST",
      payload: quotePayload(fixture.vendor.id),
      url: `/api/v1/rfqs/${fixture.rfq.rfqId}/quotes`,
    });

    expect(response.statusCode).toBe(403);
  });

  it("rejects stale revision acceptance after a newer revision is sent", async () => {
    const fixture = await createAcceptedRfqFixture();
    apps.push(fixture.app);
    const createResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: quotePayload(fixture.vendor.id),
      url: `/api/v1/rfqs/${fixture.rfq.rfqId}/quotes`,
    });
    expect(createResponse.statusCode).toBe(201);
    const quoteId = createResponse.json().data.quote.id as string;
    const firstRevisionId = createResponse.json().data.currentRevision.id as string;
    const revisionResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: quotePayload(fixture.vendor.id, {
        notes: "Changed service charge.",
        lineItems: quotePayload(fixture.vendor.id).lineItems.map((lineItem) =>
          lineItem.type === "service_charge" ? { ...lineItem, unitAmountCents: 9_000 } : lineItem,
        ),
        paymentSchedule: [
          {
            amountCents: 50_000,
            dueAt: futureIso(6),
            label: "Deposit due at agreement",
            type: "deposit",
          },
          {
            amountCents: 223_000,
            dueAt: futureIso(9),
            label: "Final balance before event",
            type: "final_balance",
          },
        ],
      }),
      url: `/api/v1/quotes/${quoteId}/revisions`,
    });
    expect(revisionResponse.statusCode).toBe(201);

    const staleAccept = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.customer.accessToken}` },
      method: "POST",
      payload: { acceptedRevisionId: firstRevisionId },
      url: `/api/v1/quotes/${quoteId}/accept`,
    });

    expect(staleAccept.statusCode).toBe(409);
  });
});
