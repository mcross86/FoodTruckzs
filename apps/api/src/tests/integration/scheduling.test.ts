import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { createSchedulingService } from "../../modules/scheduling/scheduling.service.js";
import { InMemoryAgreementRepository } from "../fakes/in-memory-agreement-repository.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryBillingRepository } from "../fakes/in-memory-billing-repository.js";
import { InMemoryMarketplaceRepository } from "../fakes/in-memory-marketplace-repository.js";
import { InMemoryPaymentRepository } from "../fakes/in-memory-payment-repository.js";
import { InMemoryQuoteRepository } from "../fakes/in-memory-quote-repository.js";
import { InMemoryRfqRepository } from "../fakes/in-memory-rfq-repository.js";
import { InMemorySchedulingRepository } from "../fakes/in-memory-scheduling-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";
import { createTestEnv } from "../test-env.js";

async function buildSchedulingFixture() {
  const authRepository = new InMemoryAuthRepository();
  const vendorRepository = new InMemoryVendorRepository();
  const marketplaceRepository = new InMemoryMarketplaceRepository(vendorRepository);
  const rfqRepository = new InMemoryRfqRepository(vendorRepository);
  const quoteRepository = new InMemoryQuoteRepository(rfqRepository);
  const agreementRepository = new InMemoryAgreementRepository(
    quoteRepository,
    rfqRepository,
    vendorRepository,
  );
  const billingRepository = new InMemoryBillingRepository(agreementRepository, vendorRepository);
  const schedulingRepository = new InMemorySchedulingRepository(
    agreementRepository,
    quoteRepository,
    rfqRepository,
    vendorRepository,
  );
  const paymentRepository = new InMemoryPaymentRepository(
    agreementRepository,
    quoteRepository,
    rfqRepository,
    vendorRepository,
    schedulingRepository,
  );
  schedulingRepository.connectPayments(paymentRepository.payments);
  const app = await buildApp({
    agreementRepository,
    authRepository,
    billingRepository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(),
    marketplaceRepository,
    paymentRepository,
    quoteRepository,
    rfqRepository,
    schedulingRepository,
    vendorRepository,
  });
  const schedulingService = createSchedulingService({ repository: schedulingRepository });

  return {
    agreementRepository,
    app,
    authRepository,
    paymentRepository,
    quoteRepository,
    rfqRepository,
    schedulingRepository,
    schedulingService,
    vendorRepository,
  };
}

function futureDate(daysFromNow: number, hoursFromStart = 0): Date {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  date.setUTCHours(16 + hoursFromStart, 0, 0, 0);
  return date;
}

async function registerUser(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<{ accessToken: string; userId: string }> {
  const response = await app.inject({
    method: "POST",
    payload: {
      email,
      firstName: "Calendar",
      lastName: "Tester",
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

async function seedVendor(vendorRepository: InMemoryVendorRepository) {
  const vendor = await vendorRepository.createVendor({
    businessName: "Calendar Taco Truck",
    cateringMinimumCents: 50_000,
    description: "Calendar test vendor.",
    pricingSummary: "Packages available.",
    slug: `calendar-taco-truck-${crypto.randomUUID()}`,
    status: "active",
  });
  vendorRepository.vendors.set(vendor.id, {
    ...vendor,
    approvalStatus: "approved",
    isPublished: true,
  });
  await vendorRepository.upsertOperatingSettings(vendor.id, {
    defaultSetupMinutes: 60,
    defaultTravelBufferMinutes: 30,
    minimumLeadTimeDays: 7,
    timezone: "America/New_York",
    travelRadiusMiles: 40,
  });
  return vendorRepository.vendors.get(vendor.id)!;
}

async function seedSignedAgreement(
  fixture: Awaited<ReturnType<typeof buildSchedulingFixture>>,
  customerUserId: string,
  vendorId: string,
) {
  const startsAt = futureDate(14, 0);
  const endsAt = futureDate(14, 3);
  const address = await fixture.rfqRepository.createAddress({
    city: "Atlanta",
    country: "US",
    line1: "200 Calendar Ave",
    postalCode: "30301",
    state: "GA",
  });
  const rfq = await fixture.rfqRepository.createRfq({
    budgetMaxCents: 250_000,
    budgetMinCents: 150_000,
    customerUserId,
    endsAt,
    estimatedHeadcount: 100,
    eventName: "Confirmed Calendar Lunch",
    eventType: "Corporate lunch",
    indoorOutdoor: "outdoor",
    quoteResponseDeadline: futureDate(10),
    startsAt,
    status: "deposit_paid",
    timezone: "America/New_York",
    venueAddressId: address.id,
  });
  await fixture.rfqRepository.createRequirements([
    {
      details: {
        primaryContact: {
          email: "planner@example.com",
          name: "Pat Planner",
          phone: "4045551000",
        },
      },
      label: "event_basics",
      rfqId: rfq.id,
      type: "other",
    },
    {
      details: {
        onsiteContactName: "Sam Site",
        onsiteContactPhone: "4045552000",
        parkingNotes: "Use the north lot.",
        powerAvailable: true,
        venueName: "Calendar Office",
      },
      label: "venue_logistics",
      rfqId: rfq.id,
      type: "other",
    },
    {
      details: {
        desiredServiceStyle: "truck onsite",
        serviceEndsAt: futureDate(14, 2).toISOString(),
        serviceStartsAt: futureDate(14, 1).toISOString(),
      },
      label: "service_style",
      rfqId: rfq.id,
      type: "service",
    },
    {
      details: { menuPreference: "Use vendor recommendation" },
      label: "food_requirements",
      rfqId: rfq.id,
      type: "food",
    },
    {
      details: {
        requests: [{ item: "plates", quantity: 100, required: true }],
      },
      label: "equipment",
      rfqId: rfq.id,
      type: "equipment",
    },
  ]);
  const quote = await fixture.quoteRepository.createQuote({
    currentRevisionId: null,
    depositRequiredCents: 50_000,
    rfqId: rfq.id,
    status: "accepted",
    subtotalCents: 200_000,
    totalCents: 200_000,
    vendorId,
  });
  const revision = await fixture.quoteRepository.createRevision({
    assumptions: ["Arrive with 60 minutes for setup."],
    depositRequiredCents: 50_000,
    menuSummary: "Tacos, sides, vegetarian option, and aguas frescas.",
    quoteId: quote.id,
    revisionNumber: 1,
    serviceStyle: "Truck onsite hosted lunch.",
    subtotalCents: 200_000,
    totalCents: 200_000,
  });
  await fixture.quoteRepository.updateQuote(
    quote.id,
    { currentRevisionId: revision.id },
    new Date(),
  );
  await fixture.quoteRepository.createLineItems([
    {
      name: "Taco package",
      quantity: 100,
      quoteId: quote.id,
      quoteRevisionId: revision.id,
      sortOrder: 0,
      totalAmountCents: 180_000,
      type: "food",
      unit: "guest",
      unitAmountCents: 1_800,
    },
    {
      name: "Service crew",
      quantity: 1,
      quoteId: quote.id,
      quoteRevisionId: revision.id,
      sortOrder: 1,
      totalAmountCents: 20_000,
      type: "staffing",
      unit: "event",
      unitAmountCents: 20_000,
    },
  ]);
  const [deposit] = await fixture.quoteRepository.createPaymentScheduleItems([
    {
      amountCents: 50_000,
      label: "Required deposit",
      paidAt: new Date(),
      quoteRevisionId: revision.id,
      sortOrder: 0,
      status: "paid",
      type: "deposit",
    },
  ]);
  expect(deposit).toBeDefined();
  const agreement = await fixture.agreementRepository.createAgreement({
    customerUserId,
    quoteId: quote.id,
    quoteRevisionId: revision.id,
    rfqId: rfq.id,
    status: "signed",
    vendorId,
  });
  const version = await fixture.agreementRepository.createVersion({
    agreementId: agreement.id,
    termsSnapshot: { eventName: rfq.eventName },
    versionNumber: 1,
  });
  await fixture.agreementRepository.updateAgreement(
    agreement.id,
    {
      currentVersionId: version.id,
      generatedAt: new Date(),
      signedAt: new Date(),
    },
    new Date(),
  );
  fixture.quoteRepository.paymentScheduleItems.set(deposit!.id, {
    ...deposit!,
    agreementId: agreement.id,
  });

  return { agreement, endsAt, rfq, startsAt };
}

describe("scheduling", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("creates confirmed catering events idempotently after signed agreement and deposit", async () => {
    const fixture = await buildSchedulingFixture();
    apps.push(fixture.app);
    const vendor = await seedVendor(fixture.vendorRepository);
    const { agreement } = await seedSignedAgreement(fixture, crypto.randomUUID(), vendor.id);

    const first = await fixture.schedulingService.confirmAgreementAfterDeposit(agreement.id, {
      paymentId: crypto.randomUUID(),
    });
    const second = await fixture.schedulingService.confirmAgreementAfterDeposit(agreement.id, {
      paymentId: crypto.randomUUID(),
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.calendarEvent.type).toBe("confirmed_catering");
    expect(fixture.schedulingRepository.cateringEvents.size).toBe(1);
    expect(fixture.schedulingRepository.calendarEvents.size).toBe(1);
    expect([...fixture.rfqRepository.rfqs.values()][0]?.status).toBe("confirmed");
  });

  it("returns conflict and setup buffer warnings for calendar events", async () => {
    const fixture = await buildSchedulingFixture();
    apps.push(fixture.app);
    const vendor = await seedVendor(fixture.vendorRepository);
    const { agreement, startsAt } = await seedSignedAgreement(
      fixture,
      crypto.randomUUID(),
      vendor.id,
    );

    await fixture.schedulingRepository.createCalendarEvent({
      endsAt: new Date(startsAt.getTime() - 30 * 60 * 1_000),
      isBlocking: false,
      startsAt: new Date(startsAt.getTime() - 2 * 60 * 60 * 1_000),
      status: "confirmed",
      title: "Lunch public vending",
      type: "food_truck_location",
      vendorId: vendor.id,
    });

    const confirmed = await fixture.schedulingService.confirmAgreementAfterDeposit(agreement.id);
    const blocked = await fixture.schedulingService.createManualEvent(
      {
        globalRoles: [],
        requestId: "req_scheduling_test",
        userId: crypto.randomUUID(),
        vendorMemberships: [
          {
            role: "manager",
            status: "active",
            vendorId: vendor.id,
          },
        ],
      },
      vendor.id,
      {
        endsAt: futureDate(14, 2).toISOString(),
        startsAt: futureDate(14, 1).toISOString(),
        title: "Manager blocked time",
        type: "blocked_time",
      },
    );

    expect(confirmed.warnings.map((warning) => warning.code)).toContain(
      "tight_setup_travel_buffer",
    );
    expect(blocked.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "hard_conflict",
          isHard: true,
        }),
      ]),
    );
  });

  it("exposes vendor calendar view and operations run sheet APIs", async () => {
    const fixture = await buildSchedulingFixture();
    apps.push(fixture.app);
    const vendorUser = await registerUser(
      fixture.app,
      `calendar-vendor-${crypto.randomUUID()}@example.com`,
    );
    const vendor = await seedVendor(fixture.vendorRepository);
    fixture.authRepository.addVendorMembership({
      role: "manager",
      userId: vendorUser.userId,
      vendorId: vendor.id,
    });
    const { agreement, startsAt } = await seedSignedAgreement(
      fixture,
      crypto.randomUUID(),
      vendor.id,
    );
    const confirmed = await fixture.schedulingService.confirmAgreementAfterDeposit(agreement.id);

    const calendarResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${vendorUser.accessToken}` },
      method: "GET",
      url: `/api/v1/vendors/${vendor.id}/calendar-events?view=agenda&startsFrom=${encodeURIComponent(
        new Date(startsAt.getTime() - 24 * 60 * 60 * 1_000).toISOString(),
      )}&startsTo=${encodeURIComponent(new Date(startsAt.getTime() + 24 * 60 * 60 * 1_000).toISOString())}`,
    });
    const operationsResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${vendorUser.accessToken}` },
      method: "GET",
      url: `/api/v1/vendors/${vendor.id}/calendar-events/${confirmed.calendarEvent.id}/operations`,
    });

    expect(calendarResponse.statusCode).toBe(200);
    expect(calendarResponse.json().data).toMatchObject({
      events: [
        {
          title: "Confirmed Calendar Lunch",
          type: "confirmed_catering",
        },
      ],
      view: "agenda",
    });
    expect(operationsResponse.statusCode).toBe(200);
    expect(operationsResponse.json().data).toMatchObject({
      agreedMenu: {
        menuSummary: "Tacos, sides, vegetarian option, and aguas frescas.",
      },
      contacts: {
        onsite: {
          name: "Sam Site",
        },
      },
      equipmentChecklist: [
        {
          item: "plates",
          required: true,
        },
      ],
    });
  });
});
