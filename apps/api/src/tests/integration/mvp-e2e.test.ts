import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type {
  CreateConnectedAccountInput,
  CreateDepositCheckoutSessionInput,
  CreateOnboardingLinkInput,
  StripeAccountReadiness,
  StripeCheckoutSessionResult,
  StripeClient,
  StripeWebhookEvent,
} from "../../shared/stripe/stripe-client.js";
import { InMemoryAdminRepository } from "../fakes/in-memory-admin-repository.js";
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

class MvpStripeClient implements StripeClient {
  readonly checkoutSessions: CreateDepositCheckoutSessionInput[] = [];
  private accountCounter = 0;
  private checkoutCounter = 0;

  constructWebhookEvent(rawBody: string | Buffer): StripeWebhookEvent {
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
    return JSON.parse(body) as StripeWebhookEvent;
  }

  async createConnectedAccount(
    _input: CreateConnectedAccountInput,
  ): Promise<StripeAccountReadiness> {
    this.accountCounter += 1;
    return {
      accountId: `acct_mvp_${this.accountCounter}`,
      chargesEnabled: false,
      detailsSubmitted: false,
      disabledReason: "requirements.past_due",
      payoutsEnabled: false,
    };
  }

  async retrieveAccount(accountId: string): Promise<StripeAccountReadiness> {
    return {
      accountId,
      chargesEnabled: true,
      detailsSubmitted: true,
      disabledReason: null,
      payoutsEnabled: true,
    };
  }

  async createOnboardingLink(input: CreateOnboardingLinkInput): Promise<{ url: string }> {
    return {
      url: `https://connect.stripe.test/setup/${input.accountId}`,
    };
  }

  async createDepositCheckoutSession(
    input: CreateDepositCheckoutSessionInput,
  ): Promise<StripeCheckoutSessionResult> {
    this.checkoutCounter += 1;
    this.checkoutSessions.push(input);
    return {
      checkoutUrl: `https://checkout.stripe.test/session/${this.checkoutCounter}`,
      paymentIntentId: `pi_mvp_${this.checkoutCounter}`,
      sessionId: `cs_mvp_${this.checkoutCounter}`,
    };
  }
}

async function buildMvpApp() {
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
  const adminRepository = new InMemoryAdminRepository(
    agreementRepository,
    paymentRepository,
    quoteRepository,
    rfqRepository,
    vendorRepository,
  );
  const stripeClient = new MvpStripeClient();
  const app = await buildApp({
    adminRepository,
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
    stripeClient,
    vendorRepository,
  });

  return {
    adminRepository,
    app,
    authRepository,
    billingRepository,
    paymentRepository,
    quoteRepository,
    rfqRepository,
    schedulingRepository,
    stripeClient,
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
      firstName: input.firstName ?? "MVP",
      lastName: input.lastName ?? "Tester",
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

function authHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

function futureIso(daysFromNow: number, hoursFromStart = 0): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  date.setUTCHours(16 + hoursFromStart, 0, 0, 0);
  return date.toISOString();
}

function dateString(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

function rfqPayload(vendorId: string) {
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
      endsAt: futureIso(14, 4),
      estimatedHeadcount: 100,
      eventName: "MVP Launch Lunch",
      eventType: "Corporate lunch",
      isOpenToPublic: false,
      isRecurring: false,
      primaryContact: {
        email: "planner@example.com",
        name: "Pat Planner",
        phone: "4045551212",
      },
      startsAt: futureIso(14),
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
      serviceEndsAt: futureIso(14, 3),
      serviceStartsAt: futureIso(14, 1),
    },
    specialNotes: "Please include a vegetarian option.",
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
    menuSummary: "Two taco entrees, vegetarian option, chips, salsa, and agua frescas.",
    paymentSchedule: [
      {
        amountCents: 50_000,
        dueAt: futureIso(6),
        label: "Deposit due at agreement",
        type: "deposit",
      },
      {
        amountCents: 135_000,
        dueAt: futureIso(12),
        label: "Final balance before event",
        type: "final_balance",
      },
    ],
    serviceStyle: "Truck onsite hosted meal service.",
    vendorId,
  };
}

describe("MVP end-to-end flow", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("runs vendor onboarding through confirmed booking and admin review", async () => {
    const { app, authRepository, stripeClient } = await buildMvpApp();
    apps.push(app);

    const admin = await registerUser(app, {
      email: `mvp-admin-${crypto.randomUUID()}@example.com`,
      firstName: "Admin",
    });
    const adminUser = authRepository.users.get(admin.userId)!;
    authRepository.users.set(admin.userId, {
      ...adminUser,
      globalRoles: ["platform_admin"],
    });
    const vendorUser = await registerUser(app, {
      email: `mvp-vendor-${crypto.randomUUID()}@example.com`,
      firstName: "Vendor",
    });
    const customer = await registerUser(app, {
      email: `mvp-customer-${crypto.randomUUID()}@example.com`,
      firstName: "Customer",
    });

    const cuisineResponse = await app.inject({
      headers: authHeaders(admin.accessToken),
      method: "POST",
      payload: { isActive: true, name: "Tacos", slug: `mvp-tacos-${crypto.randomUUID()}` },
      url: "/api/v1/admin/cuisines",
    });
    expect(cuisineResponse.statusCode).toBe(201);
    const cuisineId = cuisineResponse.json().data.id as string;

    const vendorResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "POST",
      payload: {
        businessEmail: "hello@mvp-tacos.test",
        businessName: "MVP Taco Truck",
        businessPhone: "4045551010",
        cateringMinimumCents: 100_000,
        cuisineIds: [cuisineId],
        headline: "Tacos ready for catered events",
        ownerContactName: "Val Vendor",
        pricingSummary: "Packages from $15 per guest.",
        profileDescription: "Street tacos, sides, and vegetarian options for office events.",
        serviceAreas: [{ city: "Atlanta", metroArea: "Atlanta", radiusMiles: 40, state: "GA" }],
        serviceStyles: ["truck onsite", "buffet"],
        settings: {
          defaultSetupMinutes: 60,
          defaultTravelBufferMinutes: 30,
          minimumGuestCount: 20,
          minimumLeadTimeDays: 7,
          timezone: "America/New_York",
          travelRadiusMiles: 40,
        },
      },
      url: "/api/v1/vendors",
    });
    expect(vendorResponse.statusCode).toBe(201);
    const vendorId = vendorResponse.json().data.vendor.id as string;
    authRepository.addVendorMembership({
      role: "owner",
      userId: vendorUser.userId,
      vendorId,
    });

    const menuResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "POST",
      payload: {
        isPublic: true,
        items: [{ name: "Chicken taco", priceCents: 1500 }],
        minimumGuestCount: 20,
        name: "Corporate Taco Catering",
        packages: [
          {
            minimumGuestCount: 20,
            name: "Hosted taco bar",
            priceCents: 1800,
            pricingModel: "per_person",
          },
        ],
        serviceStyles: ["truck onsite", "buffet"],
        status: "published",
      },
      url: `/api/v1/vendors/${vendorId}/menus`,
    });
    expect(menuResponse.statusCode).toBe(201);

    const availabilityResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "PUT",
      payload: {
        exceptions: [],
        rules: [
          {
            dayOfWeek: 2,
            endsAtLocal: "18:00",
            startsAtLocal: "09:00",
            timezone: "America/New_York",
          },
        ],
        settings: {
          defaultSetupMinutes: 60,
          defaultTravelBufferMinutes: 30,
          minimumGuestCount: 20,
          minimumLeadTimeDays: 7,
          requestAnywayOnBlackout: false,
          timezone: "America/New_York",
          travelRadiusMiles: 40,
        },
      },
      url: `/api/v1/vendors/${vendorId}/availability`,
    });
    expect(availabilityResponse.statusCode).toBe(200);

    const billingSettingsResponse = await app.inject({
      headers: authHeaders(admin.accessToken),
      method: "PATCH",
      payload: {
        agreementFeeBasisPoints: 750,
        billingEmail: "billing@mvp-tacos.test",
        invoiceTermsDays: 15,
      },
      url: `/api/v1/admin/vendors/${vendorId}/billing-settings`,
    });
    expect(billingSettingsResponse.statusCode).toBe(200);

    const onboardingResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "POST",
      payload: {
        refreshUrl: "http://localhost:3000/vendor/payments?stripe=refresh",
        returnUrl: "http://localhost:3000/vendor/payments?stripe=return",
      },
      url: `/api/v1/vendors/${vendorId}/stripe-connect/onboarding-link`,
    });
    expect(onboardingResponse.statusCode).toBe(201);
    const stripeAccountId = onboardingResponse.json().data.stripeAccount.accountId as string;

    const approveResponse = await app.inject({
      headers: authHeaders(admin.accessToken),
      method: "POST",
      payload: { note: "MVP vendor reviewed and approved." },
      url: `/api/v1/admin/vendors/${vendorId}/approve`,
    });
    expect(approveResponse.statusCode).toBe(200);

    const marketplaceResponse = await app.inject({
      method: "GET",
      url: "/api/v1/marketplace/vendors?cuisine=tacos&serviceArea=Atlanta&serviceStyle=truck%20onsite&guestCount=100&budgetMaxCents=250000",
    });
    expect(marketplaceResponse.statusCode).toBe(200);
    expect(marketplaceResponse.json().data.vendors).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: vendorId })]),
    );

    const rfqResponse = await app.inject({
      headers: authHeaders(customer.accessToken),
      method: "POST",
      payload: rfqPayload(vendorId),
      url: "/api/v1/rfqs",
    });
    expect(rfqResponse.statusCode).toBe(201);
    const rfq = rfqResponse.json().data;
    const targetId = rfq.vendorTargets[0].id as string;

    const clarificationResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "POST",
      payload: { body: "Can you confirm the truck can remain onsite for the full service?" },
      url: `/api/v1/rfqs/${rfq.rfqId}/request-clarification`,
    });
    expect(clarificationResponse.statusCode).toBe(201);
    const threadId = clarificationResponse.json().data.threads[0].id as string;

    const clarificationReplyResponse = await app.inject({
      headers: authHeaders(customer.accessToken),
      method: "POST",
      payload: { body: "Yes, the truck can remain onsite for the full service window." },
      url: `/api/v1/message-threads/${threadId}/messages`,
    });
    expect(clarificationReplyResponse.statusCode).toBe(201);

    const acceptRfqResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "POST",
      payload: { note: "Fit confirmed after clarification." },
      url: `/api/v1/rfqs/${rfq.rfqId}/vendor-targets/${targetId}/accept`,
    });
    expect(acceptRfqResponse.statusCode).toBe(200);

    const quoteResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "POST",
      payload: quotePayload(vendorId),
      url: `/api/v1/rfqs/${rfq.rfqId}/quotes`,
    });
    expect(quoteResponse.statusCode).toBe(201);
    const quote = quoteResponse.json().data;

    const acceptQuoteResponse = await app.inject({
      headers: authHeaders(customer.accessToken),
      method: "POST",
      payload: { acceptedRevisionId: quote.currentRevision.id },
      url: `/api/v1/quotes/${quote.quote.id}/accept`,
    });
    expect(acceptQuoteResponse.statusCode).toBe(200);
    const agreement = acceptQuoteResponse.json().data.agreement;

    const signAgreementResponse = await app.inject({
      headers: authHeaders(customer.accessToken),
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
    expect(signAgreementResponse.statusCode).toBe(200);
    const signedAgreement = signAgreementResponse.json().data;
    expect(signedAgreement.platformFee).toMatchObject({
      feeAmountCents: 13_875,
      feePercentageBasisPoints: 750,
      status: "pending_invoice",
    });
    expect(signedAgreement.nextPaymentAction).toMatchObject({
      amountCents: 50_000,
      type: "deposit_required",
    });

    const platformBillingResponse = await app.inject({
      headers: authHeaders(admin.accessToken),
      method: "GET",
      url: `/api/v1/admin/platform-billing?vendorId=${vendorId}`,
    });
    expect(platformBillingResponse.statusCode).toBe(200);
    expect(platformBillingResponse.json().data.pendingFees).toHaveLength(1);

    const invoiceResponse = await app.inject({
      headers: authHeaders(admin.accessToken),
      method: "POST",
      payload: {
        billingPeriodEnd: dateString(),
        billingPeriodStart: dateString(),
        vendorId,
      },
      url: "/api/v1/admin/vendor-invoices",
    });
    expect(invoiceResponse.statusCode).toBe(201);
    expect(invoiceResponse.json().data.totalCents).toBe(13_875);

    const accountReadyWebhookResponse = await app.inject({
      headers: { "stripe-signature": "test-signature" },
      method: "POST",
      payload: {
        data: {
          object: {
            charges_enabled: true,
            details_submitted: true,
            id: stripeAccountId,
            payouts_enabled: true,
            requirements: { disabled_reason: null },
          },
        },
        id: `evt_account_ready_${crypto.randomUUID()}`,
        type: "account.updated",
      },
      url: "/api/v1/webhooks/stripe",
    });
    expect(accountReadyWebhookResponse.statusCode).toBe(200);

    const checkoutResponse = await app.inject({
      headers: {
        ...authHeaders(customer.accessToken),
        "idempotency-key": "mvp-deposit-checkout",
      },
      method: "POST",
      payload: {
        agreementId: signedAgreement.agreement.id,
        paymentScheduleItemId: signedAgreement.nextPaymentAction.paymentScheduleItemId,
      },
      url: "/api/v1/payments/deposits/checkout-session",
    });
    expect(checkoutResponse.statusCode).toBe(201);
    const checkout = checkoutResponse.json().data;
    expect(stripeClient.checkoutSessions[0]).not.toHaveProperty("applicationFeeAmount");

    const depositWebhookResponse = await app.inject({
      headers: { "stripe-signature": "test-signature" },
      method: "POST",
      payload: {
        data: {
          object: {
            id: checkout.payment.stripeCheckoutSessionId,
            payment_intent: checkout.payment.stripePaymentIntentId,
          },
        },
        id: `evt_checkout_complete_${crypto.randomUUID()}`,
        type: "checkout.session.completed",
      },
      url: "/api/v1/webhooks/stripe",
    });
    expect(depositWebhookResponse.statusCode).toBe(200);

    const customerRfqResponse = await app.inject({
      headers: authHeaders(customer.accessToken),
      method: "GET",
      url: `/api/v1/rfqs/${rfq.rfqId}`,
    });
    expect(customerRfqResponse.statusCode).toBe(200);
    expect(customerRfqResponse.json().data.status).toBe("confirmed");

    const calendarResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "GET",
      url: `/api/v1/vendors/${vendorId}/calendar-events?startsFrom=${encodeURIComponent(
        futureIso(13),
      )}&startsTo=${encodeURIComponent(futureIso(15))}&view=agenda`,
    });
    expect(calendarResponse.statusCode).toBe(200);
    expect(calendarResponse.json().data.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "confirmed" })]),
    );
    const calendarEventId = calendarResponse.json().data.events[0].id as string;

    const operationsResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "GET",
      url: `/api/v1/vendors/${vendorId}/calendar-events/${calendarEventId}/operations`,
    });
    expect(operationsResponse.statusCode).toBe(200);
    expect(operationsResponse.json().data).toMatchObject({
      contacts: {
        onsite: {
          name: "Sam Site",
          phone: "4045553434",
        },
      },
      paymentStatus: {
        paidCents: 50_000,
      },
      runSheetStatus: "confirmed_catering",
    });
    expect(operationsResponse.json().data.equipmentChecklist).toEqual(
      expect.arrayContaining([expect.objectContaining({ item: "plates", required: true })]),
    );

    const vendorPaymentsResponse = await app.inject({
      headers: authHeaders(vendorUser.accessToken),
      method: "GET",
      url: `/api/v1/vendors/${vendorId}/payments`,
    });
    expect(vendorPaymentsResponse.statusCode).toBe(200);
    expect(vendorPaymentsResponse.json().data.payments).toHaveLength(1);

    const adminVendorResponse = await app.inject({
      headers: authHeaders(admin.accessToken),
      method: "GET",
      url: `/api/v1/admin/vendors/${vendorId}`,
    });
    const adminRfqResponse = await app.inject({
      headers: authHeaders(admin.accessToken),
      method: "GET",
      url: `/api/v1/admin/rfqs/${rfq.rfqId}`,
    });
    const adminPaymentResponse = await app.inject({
      headers: authHeaders(admin.accessToken),
      method: "GET",
      url: "/api/v1/admin/payments?status=succeeded",
    });
    expect(adminVendorResponse.statusCode).toBe(200);
    expect(adminRfqResponse.statusCode).toBe(200);
    expect(adminRfqResponse.json().data.rfq.status).toBe("confirmed");
    expect(adminPaymentResponse.statusCode).toBe(200);
    expect(adminPaymentResponse.json().data).toHaveLength(1);
  });
});
