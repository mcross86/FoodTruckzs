import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { calculateAgreementFeeCents } from "../../modules/billing/billing-calculation.js";
import { InMemoryAgreementRepository } from "../fakes/in-memory-agreement-repository.js";
import { InMemoryAuthRepository } from "../fakes/in-memory-auth-repository.js";
import { InMemoryBillingRepository } from "../fakes/in-memory-billing-repository.js";
import { InMemoryMarketplaceRepository } from "../fakes/in-memory-marketplace-repository.js";
import { InMemoryQuoteRepository } from "../fakes/in-memory-quote-repository.js";
import { InMemoryRfqRepository } from "../fakes/in-memory-rfq-repository.js";
import { InMemoryVendorRepository } from "../fakes/in-memory-vendor-repository.js";
import { createTestEnv } from "../test-env.js";

async function buildAgreementTestApp() {
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
    quoteRepository,
    rfqRepository,
    vendorRepository,
  });

  return {
    agreementRepository,
    app,
    authRepository,
    billingRepository,
    quoteRepository,
    rfqRepository,
    vendorRepository,
  };
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

function futureIso(daysFromNow: number, hoursFromStart = 0): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  date.setUTCHours(16 + hoursFromStart, 0, 0, 0);
  return date.toISOString();
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function signAcceptedAgreement(
  fixture: Awaited<ReturnType<typeof createAcceptedQuoteFixture>>,
) {
  const agreement = fixture.acceptedQuote.agreement;
  const response = await fixture.app.inject({
    headers: { authorization: `Bearer ${fixture.customer.accessToken}` },
    method: "POST",
    payload: {
      acceptedTermsVersion: agreement.currentVersion.id,
      acknowledgements: {
        cancellationPolicy: true,
        customerResponsibilities: true,
        paymentTerms: true,
      },
      typedName: "Pat Planner",
    },
    url: `/api/v1/agreements/${agreement.agreement.id}/sign`,
  });

  expect(response.statusCode).toBe(200);
  return response.json().data;
}

async function registerAdmin(fixture: Awaited<ReturnType<typeof createAcceptedQuoteFixture>>) {
  const admin = await registerUser(fixture.app, {
    email: `admin-${crypto.randomUUID()}@example.com`,
    firstName: "Admin",
  });
  const adminUser = fixture.authRepository.users.get(admin.userId)!;
  fixture.authRepository.users.set(admin.userId, {
    ...adminUser,
    globalRoles: ["platform_admin"],
  });

  return admin;
}

async function seedVendor(vendorRepository: InMemoryVendorRepository) {
  const cuisine = await vendorRepository.createCuisine({
    isActive: true,
    name: "Tacos",
    slug: `agreement-tacos-${crypto.randomUUID()}`,
  });
  const vendor = await vendorRepository.createVendor({
    businessName: "Agreement Taco Truck",
    cateringMinimumCents: 75_000,
    description: "Agreement Taco Truck description.",
    pricingSummary: "Catering packages available.",
    slug: `agreement-taco-truck-${crypto.randomUUID()}`,
    status: "active",
  });

  vendorRepository.vendors.set(vendor.id, {
    ...vendor,
    approvalStatus: "approved",
    isPublished: true,
  });
  await vendorRepository.upsertProfile(vendor.id, {
    headline: "Agreement Taco Truck catering",
    publicDescription: "Agreement Taco Truck caters local events.",
    serviceStyles: ["truck onsite"],
  });
  await vendorRepository.replaceVendorCuisines(vendor.id, [cuisine.id]);
  await vendorRepository.replaceServiceAreas(vendor.id, {
    serviceAreas: [{ city: "Atlanta", metroArea: "Atlanta", state: "GA" }],
  });
  await vendorRepository.upsertOperatingSettings(vendor.id, {
    minimumGuestCount: 20,
    minimumLeadTimeDays: 7,
    timezone: "America/New_York",
    travelRadiusMiles: 40,
  });
  await vendorRepository.upsertBillingSettings(vendor.id, {
    agreementFeeBasisPoints: 750,
    billingEmail: "billing@example.com",
    invoiceTermsDays: 30,
  });

  return vendor;
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
      eventName: "Agreement Launch Lunch",
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

function quotePayload(vendorId: string) {
  return {
    assumptions: ["Pricing assumes 100 guests.", "Truck parking is available near service."],
    cancellationPolicySummary: "Deposit is non-refundable inside 7 days of the event.",
    depositRequiredCents: 50_000,
    exclusions: ["Alcohol service is excluded."],
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
        name: "Estimated tax",
        quantity: 1,
        taxable: false,
        type: "tax",
        unit: "event",
        unitAmountCents: 15_000,
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
        amountCents: 135_000,
        dueAt: futureIso(9),
        label: "Final balance before event",
        type: "final_balance",
      },
    ],
    serviceStyle: "Truck onsite hosted meal service.",
    vendorId,
  };
}

async function createAcceptedQuoteFixture() {
  const fixture = await buildAgreementTestApp();
  const customer = await registerUser(fixture.app, {
    email: `customer-${crypto.randomUUID()}@example.com`,
  });
  const vendorUser = await registerUser(fixture.app, {
    email: `vendor-${crypto.randomUUID()}@example.com`,
  });
  const vendor = await seedVendor(fixture.vendorRepository);
  fixture.authRepository.addVendorMembership({
    role: "owner",
    userId: vendorUser.userId,
    vendorId: vendor.id,
  });

  const rfqResponse = await fixture.app.inject({
    headers: { authorization: `Bearer ${customer.accessToken}` },
    method: "POST",
    payload: validRfqPayload(vendor.id),
    url: "/api/v1/rfqs",
  });
  expect(rfqResponse.statusCode).toBe(201);
  const rfq = rfqResponse.json().data;
  const acceptTargetResponse = await fixture.app.inject({
    headers: { authorization: `Bearer ${vendorUser.accessToken}` },
    method: "POST",
    payload: { note: "Ready to quote." },
    url: `/api/v1/rfqs/${rfq.rfqId}/vendor-targets/${rfq.vendorTargets[0].id}/accept`,
  });
  expect(acceptTargetResponse.statusCode).toBe(200);
  const quoteResponse = await fixture.app.inject({
    headers: { authorization: `Bearer ${vendorUser.accessToken}` },
    method: "POST",
    payload: quotePayload(vendor.id),
    url: `/api/v1/rfqs/${rfq.rfqId}/quotes`,
  });
  expect(quoteResponse.statusCode).toBe(201);
  const quote = quoteResponse.json().data;
  const acceptQuoteResponse = await fixture.app.inject({
    headers: { authorization: `Bearer ${customer.accessToken}` },
    method: "POST",
    payload: { acceptedRevisionId: quote.currentRevision.id },
    url: `/api/v1/quotes/${quote.quote.id}/accept`,
  });
  expect(acceptQuoteResponse.statusCode).toBe(200);

  return {
    ...fixture,
    acceptedQuote: acceptQuoteResponse.json().data,
    customer,
    vendor,
    vendorUser,
  };
}

describe("agreement lifecycle routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("rejects signing an older agreement version after a new version is generated", async () => {
    const fixture = await createAcceptedQuoteFixture();
    apps.push(fixture.app);
    const agreement = fixture.acceptedQuote.agreement;
    const firstVersionId = agreement.currentVersion.id as string;

    const regenerateResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      url: `/api/v1/agreements/${agreement.agreement.id}/generate`,
    });
    expect(regenerateResponse.statusCode).toBe(201);

    const staleSignResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.customer.accessToken}` },
      method: "POST",
      payload: {
        acceptedTermsVersion: firstVersionId,
        acknowledgements: {
          cancellationPolicy: true,
          customerResponsibilities: true,
          paymentTerms: true,
        },
        typedName: "Pat Planner",
      },
      url: `/api/v1/agreements/${agreement.agreement.id}/sign`,
    });

    expect(staleSignResponse.statusCode).toBe(409);
  });

  it("allows only the RFQ customer to sign the agreement", async () => {
    const fixture = await createAcceptedQuoteFixture();
    apps.push(fixture.app);
    const agreement = fixture.acceptedQuote.agreement;

    const vendorSignResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: {
        acceptedTermsVersion: agreement.currentVersion.id,
        acknowledgements: {
          cancellationPolicy: true,
          customerResponsibilities: true,
          paymentTerms: true,
        },
        typedName: "Vendor Owner",
      },
      url: `/api/v1/agreements/${agreement.agreement.id}/sign`,
    });

    expect(vendorSignResponse.statusCode).toBe(403);
  });

  it("signs the current agreement immutably and creates platform fee metadata", async () => {
    const fixture = await createAcceptedQuoteFixture();
    apps.push(fixture.app);
    const agreement = fixture.acceptedQuote.agreement;

    expect(agreement.agreement.status).toBe("pending_signature");
    expect(agreement.currentVersion.termsSnapshot).toMatchObject({
      cancellationPolicy: expect.any(Object),
      customerResponsibilities: expect.any(Object),
      eventDetails: expect.any(Object),
      menuSelections: expect.any(Object),
      paymentTerms: expect.any(Object),
      pricing: expect.objectContaining({ totalCents: 185_000 }),
      vendorRequirements: expect.any(Object),
    });
    expect(fixture.rfqRepository.rfqs.get(agreement.rfq.id)?.status).toBe("agreement_pending");

    const signResponse = await fixture.app.inject({
      headers: {
        authorization: `Bearer ${fixture.customer.accessToken}`,
        "user-agent": "agreement-test-agent",
      },
      method: "POST",
      payload: {
        acceptedTermsVersion: agreement.currentVersion.id,
        acknowledgements: {
          cancellationPolicy: true,
          customerResponsibilities: true,
          paymentTerms: true,
        },
        typedName: "Pat Planner",
      },
      url: `/api/v1/agreements/${agreement.agreement.id}/sign`,
    });

    expect(signResponse.statusCode).toBe(200);
    expect(fixture.agreementRepository.platformAgreementFees.size).toBe(1);
    expect(signResponse.json().data).toMatchObject({
      agreement: { status: "signed" },
      nextPaymentAction: {
        amountCents: 50_000,
        label: "Deposit due at agreement",
        type: "deposit_required",
      },
      platformFee: {
        feeAmountCents: 13_875,
        feePercentageBasisPoints: 750,
        status: "pending_invoice",
      },
      signatures: [expect.objectContaining({ typedName: "Pat Planner" })],
    });
    expect(fixture.rfqRepository.rfqs.get(agreement.rfq.id)?.status).toBe("agreement_signed");

    const regenerateSignedResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      url: `/api/v1/agreements/${agreement.agreement.id}/generate`,
    });
    expect(regenerateSignedResponse.statusCode).toBe(409);

    const secondSignResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.customer.accessToken}` },
      method: "POST",
      payload: {
        acceptedTermsVersion: agreement.currentVersion.id,
        acknowledgements: {
          cancellationPolicy: true,
          customerResponsibilities: true,
          paymentTerms: true,
        },
        typedName: "Pat Planner",
      },
      url: `/api/v1/agreements/${agreement.agreement.id}/sign`,
    });
    expect(secondSignResponse.statusCode).toBe(409);
    expect(fixture.agreementRepository.platformAgreementFees.size).toBe(1);
  });

  it("calculates signed-agreement fees from basis points without applying an amount cap", () => {
    expect(calculateAgreementFeeCents(185_000, 750)).toBe(13_875);
    expect(calculateAgreementFeeCents(100_000_000, 750)).toBe(7_500_000);
  });

  it("keeps signed fee records immutable when billing settings change later", async () => {
    const fixture = await createAcceptedQuoteFixture();
    apps.push(fixture.app);
    const signedAgreement = await signAcceptedAgreement(fixture);
    const admin = await registerAdmin(fixture);

    const settingsUpdateResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${admin.accessToken}` },
      method: "PATCH",
      payload: {
        agreementFeeBasisPoints: 1000,
        billingEmail: "changed-billing@example.com",
        invoiceTermsDays: 45,
      },
      url: `/api/v1/admin/vendors/${fixture.vendor.id}/billing-settings`,
    });
    expect(settingsUpdateResponse.statusCode).toBe(200);

    const billingResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "GET",
      url: `/api/v1/vendors/${fixture.vendor.id}/platform-billing`,
    });

    expect(billingResponse.statusCode).toBe(200);
    expect(billingResponse.json().data).toMatchObject({
      agreementFeeBasisPoints: 1000,
      billingEmail: "changed-billing@example.com",
      pendingFees: [
        {
          agreementId: signedAgreement.agreement.id,
          feeAmountCents: 13_875,
          feePercentageBasisPoints: 750,
          signedAgreementTotalCents: 185_000,
          status: "pending_invoice",
        },
      ],
    });
  });

  it("generates vendor invoices from pending fees and leaves invoiced fee amounts immutable", async () => {
    const fixture = await createAcceptedQuoteFixture();
    apps.push(fixture.app);
    const signedAgreement = await signAcceptedAgreement(fixture);
    const admin = await registerAdmin(fixture);
    const period = dateString(new Date());

    const invoiceResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${admin.accessToken}` },
      method: "POST",
      payload: {
        billingPeriodEnd: period,
        billingPeriodStart: period,
        vendorId: fixture.vendor.id,
      },
      url: "/api/v1/admin/vendor-invoices",
    });

    expect(invoiceResponse.statusCode).toBe(201);
    expect(invoiceResponse.json().data).toMatchObject({
      billingPeriodEnd: period,
      billingPeriodStart: period,
      lineItems: [
        {
          amountCents: 13_875,
          platformAgreementFeeId: signedAgreement.platformFee.id,
          type: "agreement_fee",
        },
      ],
      status: "issued",
      subtotalCents: 13_875,
      totalCents: 13_875,
      vendorId: fixture.vendor.id,
    });

    const platformFee = fixture.agreementRepository.platformAgreementFees.get(
      signedAgreement.platformFee.id,
    );
    expect(platformFee).toMatchObject({
      feeAmountCents: 13_875,
      feePercentageBasisPoints: 750,
      status: "invoiced",
      vendorInvoiceId: invoiceResponse.json().data.id,
    });

    const settingsUpdateResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${admin.accessToken}` },
      method: "PATCH",
      payload: {
        agreementFeeBasisPoints: 1250,
        billingEmail: "after-invoice@example.com",
        invoiceTermsDays: 30,
      },
      url: `/api/v1/admin/vendors/${fixture.vendor.id}/billing-settings`,
    });
    expect(settingsUpdateResponse.statusCode).toBe(200);

    const repeatInvoiceResponse = await fixture.app.inject({
      headers: { authorization: `Bearer ${admin.accessToken}` },
      method: "POST",
      payload: {
        billingPeriodEnd: period,
        billingPeriodStart: period,
        vendorId: fixture.vendor.id,
      },
      url: "/api/v1/admin/vendor-invoices",
    });

    expect(repeatInvoiceResponse.statusCode).toBe(201);
    expect(repeatInvoiceResponse.json().data.id).toBe(invoiceResponse.json().data.id);
    expect(
      fixture.agreementRepository.platformAgreementFees.get(signedAgreement.platformFee.id),
    ).toMatchObject({
      feeAmountCents: 13_875,
      feePercentageBasisPoints: 750,
      status: "invoiced",
    });
  });
});
