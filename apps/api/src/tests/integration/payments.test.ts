import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { ApiEnv } from "../../config/env.js";
import type {
  CreateConnectedAccountInput,
  CreateDepositCheckoutSessionInput,
  CreateOnboardingLinkInput,
  StripeAccountReadiness,
  StripeCheckoutSessionResult,
  StripeClient,
  StripeWebhookEvent,
} from "../../shared/stripe/stripe-client.js";
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

class FakeStripeClient implements StripeClient {
  readonly checkoutSessions: CreateDepositCheckoutSessionInput[] = [];
  private accountCounter = 0;
  private checkoutCounter = 0;

  constructWebhookEvent(rawBody: string | Buffer): StripeWebhookEvent {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
    return JSON.parse(text) as StripeWebhookEvent;
  }

  async createConnectedAccount(
    _input: CreateConnectedAccountInput,
  ): Promise<StripeAccountReadiness> {
    this.accountCounter += 1;
    return {
      accountId: `acct_test_${this.accountCounter}`,
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
      paymentIntentId: `pi_test_${this.checkoutCounter}`,
      sessionId: `cs_test_${this.checkoutCounter}`,
    };
  }
}

async function buildPaymentTestApp(envOverrides: Partial<ApiEnv> = {}) {
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
  const stripeClient = new FakeStripeClient();
  const app = await buildApp({
    agreementRepository,
    authRepository,
    billingRepository,
    database: {
      close: vi.fn(async () => undefined),
      ping: vi.fn(async () => undefined),
    },
    env: createTestEnv(envOverrides),
    marketplaceRepository,
    paymentRepository,
    quoteRepository,
    rfqRepository,
    schedulingRepository,
    stripeClient,
    vendorRepository,
  });

  return {
    agreementRepository,
    app,
    authRepository,
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

async function seedVendor(vendorRepository: InMemoryVendorRepository) {
  const cuisine = await vendorRepository.createCuisine({
    isActive: true,
    name: "Tacos",
    slug: `payment-tacos-${crypto.randomUUID()}`,
  });
  const vendor = await vendorRepository.createVendor({
    businessName: "Payment Taco Truck",
    cateringMinimumCents: 75_000,
    description: "Payment Taco Truck description.",
    pricingSummary: "Catering packages available.",
    slug: `payment-taco-truck-${crypto.randomUUID()}`,
    status: "active",
  });

  vendorRepository.vendors.set(vendor.id, {
    ...vendor,
    approvalStatus: "approved",
    isPublished: true,
  });
  await vendorRepository.upsertProfile(vendor.id, {
    headline: "Payment Taco Truck catering",
    publicDescription: "Payment Taco Truck caters local events.",
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
      eventName: "Payment Launch Lunch",
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
    assumptions: ["Pricing assumes 100 guests."],
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

async function createSignedAgreementFixture(envOverrides: Partial<ApiEnv> = {}) {
  const fixture = await buildPaymentTestApp(envOverrides);
  const customer = await registerUser(fixture.app, {
    email: `payment-customer-${crypto.randomUUID()}@example.com`,
  });
  const vendorUser = await registerUser(fixture.app, {
    email: `payment-vendor-${crypto.randomUUID()}@example.com`,
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
  const agreement = acceptQuoteResponse.json().data.agreement;

  const signResponse = await fixture.app.inject({
    headers: { authorization: `Bearer ${customer.accessToken}` },
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
  const signedAgreement = signResponse.json().data;

  return {
    ...fixture,
    customer,
    signedAgreement,
    vendor,
    vendorUser,
  };
}

function markVendorStripeReady(fixture: Awaited<ReturnType<typeof createSignedAgreementFixture>>) {
  const current = fixture.vendorRepository.vendors.get(fixture.vendor.id)!;
  fixture.vendorRepository.vendors.set(fixture.vendor.id, {
    ...current,
    stripeChargesEnabled: true,
    stripeConnectAccountId: "acct_ready",
    stripeDetailsSubmitted: true,
    stripeDisabledReason: null,
    stripePayoutsEnabled: true,
  });
}

async function createCheckout(fixture: Awaited<ReturnType<typeof createSignedAgreementFixture>>) {
  markVendorStripeReady(fixture);
  const response = await fixture.app.inject({
    headers: {
      authorization: `Bearer ${fixture.customer.accessToken}`,
      "idempotency-key": "deposit-checkout-key",
    },
    method: "POST",
    payload: {
      agreementId: fixture.signedAgreement.agreement.id,
      paymentScheduleItemId: fixture.signedAgreement.nextPaymentAction.paymentScheduleItemId,
    },
    url: "/api/v1/payments/deposits/checkout-session",
  });

  expect(response.statusCode).toBe(201);
  return response.json().data;
}

describe("payment routes", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("creates Stripe Connect onboarding links and tracks readiness on the vendor", async () => {
    const fixture = await createSignedAgreementFixture();
    apps.push(fixture.app);

    const response = await fixture.app.inject({
      headers: { authorization: `Bearer ${fixture.vendorUser.accessToken}` },
      method: "POST",
      payload: {
        refreshUrl: "http://localhost:3000/vendor/payments?stripe=refresh",
        returnUrl: "http://localhost:3000/vendor/payments?stripe=return",
      },
      url: `/api/v1/vendors/${fixture.vendor.id}/stripe-connect/onboarding-link`,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      onboardingUrl: "https://connect.stripe.test/setup/acct_test_1",
      stripeAccount: {
        accountId: "acct_test_1",
        chargesEnabled: false,
        detailsSubmitted: false,
        readyForPayments: false,
      },
    });
    expect(fixture.vendorRepository.vendors.get(fixture.vendor.id)).toMatchObject({
      stripeConnectAccountId: "acct_test_1",
      stripeDetailsSubmitted: false,
    });
  });

  it("creates an idempotent deposit checkout session without platform fee deductions", async () => {
    const fixture = await createSignedAgreementFixture();
    apps.push(fixture.app);

    const checkout = await createCheckout(fixture);
    const repeatResponse = await fixture.app.inject({
      headers: {
        authorization: `Bearer ${fixture.customer.accessToken}`,
        "idempotency-key": "deposit-checkout-key",
      },
      method: "POST",
      payload: {
        agreementId: fixture.signedAgreement.agreement.id,
        paymentScheduleItemId: fixture.signedAgreement.nextPaymentAction.paymentScheduleItemId,
      },
      url: "/api/v1/payments/deposits/checkout-session",
    });

    expect(repeatResponse.statusCode).toBe(201);
    expect(repeatResponse.json().data.payment.id).toBe(checkout.payment.id);
    expect(fixture.stripeClient.checkoutSessions).toHaveLength(1);
    expect(fixture.stripeClient.checkoutSessions[0]).toMatchObject({
      amountCents: 50_000,
      connectedAccountId: "acct_ready",
      idempotencyKey: "deposit-checkout-key",
    });
    expect(fixture.stripeClient.checkoutSessions[0]).not.toHaveProperty("applicationFeeAmount");
    expect([...fixture.paymentRepository.payments.values()]).toHaveLength(1);
    expect([...fixture.paymentRepository.attempts.values()]).toHaveLength(1);
  });

  it("rate limits new deposit checkout session creation attempts", async () => {
    const fixture = await createSignedAgreementFixture({
      rateLimitPaymentCreationMax: 1,
      rateLimitPaymentCreationWindowMs: 60_000,
    });
    apps.push(fixture.app);
    markVendorStripeReady(fixture);

    const firstResponse = await fixture.app.inject({
      headers: {
        authorization: `Bearer ${fixture.customer.accessToken}`,
        "idempotency-key": "deposit-rate-limit-key-1",
      },
      method: "POST",
      payload: {
        agreementId: fixture.signedAgreement.agreement.id,
        paymentScheduleItemId: fixture.signedAgreement.nextPaymentAction.paymentScheduleItemId,
      },
      url: "/api/v1/payments/deposits/checkout-session",
    });
    const secondResponse = await fixture.app.inject({
      headers: {
        authorization: `Bearer ${fixture.customer.accessToken}`,
        "idempotency-key": "deposit-rate-limit-key-2",
      },
      method: "POST",
      payload: {
        agreementId: fixture.signedAgreement.agreement.id,
        paymentScheduleItemId: fixture.signedAgreement.nextPaymentAction.paymentScheduleItemId,
      },
      url: "/api/v1/payments/deposits/checkout-session",
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(429);
    expect(secondResponse.json()).toMatchObject({
      error: {
        code: "RATE_LIMITED",
        details: { limit: 1 },
      },
    });
    expect(fixture.stripeClient.checkoutSessions).toHaveLength(1);
  });

  it("processes successful Stripe webhooks idempotently and creates a confirmed event", async () => {
    const fixture = await createSignedAgreementFixture();
    apps.push(fixture.app);
    const checkout = await createCheckout(fixture);
    const event = {
      data: {
        object: {
          id: checkout.payment.stripeCheckoutSessionId,
          payment_intent: checkout.payment.stripePaymentIntentId,
        },
      },
      id: "evt_checkout_completed",
      type: "checkout.session.completed",
    };

    const webhookResponse = await fixture.app.inject({
      headers: { "stripe-signature": "test-signature" },
      method: "POST",
      payload: event,
      url: "/api/v1/webhooks/stripe",
    });
    const duplicateResponse = await fixture.app.inject({
      headers: { "stripe-signature": "test-signature" },
      method: "POST",
      payload: event,
      url: "/api/v1/webhooks/stripe",
    });
    const paymentIntentReplayResponse = await fixture.app.inject({
      headers: { "stripe-signature": "test-signature" },
      method: "POST",
      payload: {
        data: {
          object: {
            id: checkout.payment.stripePaymentIntentId,
          },
        },
        id: "evt_payment_intent_succeeded_after_checkout",
        type: "payment_intent.succeeded",
      },
      url: "/api/v1/webhooks/stripe",
    });

    expect(webhookResponse.statusCode).toBe(200);
    expect(duplicateResponse.statusCode).toBe(200);
    expect(paymentIntentReplayResponse.statusCode).toBe(200);
    expect(fixture.paymentRepository.webhookEvents.size).toBe(2);
    expect(fixture.paymentRepository.payments.get(checkout.payment.id)).toMatchObject({
      status: "succeeded",
    });
    expect(
      fixture.quoteRepository.paymentScheduleItems.get(
        fixture.signedAgreement.nextPaymentAction.paymentScheduleItemId,
      ),
    ).toMatchObject({ status: "paid" });
    expect(fixture.rfqRepository.rfqs.get(fixture.signedAgreement.rfq.id)?.status).toBe(
      "confirmed",
    );
    expect(
      [...fixture.rfqRepository.statusHistory.values()].filter(
        (history) => history.toStatus === "deposit_paid",
      ),
    ).toHaveLength(1);
    expect(
      [...fixture.rfqRepository.statusHistory.values()].filter(
        (history) => history.toStatus === "confirmed",
      ),
    ).toHaveLength(1);
    expect([...fixture.schedulingRepository.cateringEvents.values()]).toHaveLength(1);
    expect([...fixture.schedulingRepository.calendarEvents.values()]).toMatchObject([
      {
        isBlocking: true,
        status: "confirmed",
        type: "confirmed_catering",
      },
    ]);
  });

  it("records failed payments and handles duplicate failed webhook events safely", async () => {
    const fixture = await createSignedAgreementFixture();
    apps.push(fixture.app);
    const checkout = await createCheckout(fixture);
    const event = {
      data: {
        object: {
          id: checkout.payment.stripePaymentIntentId,
          last_payment_error: {
            code: "card_declined",
            message: "The card was declined.",
          },
        },
      },
      id: "evt_payment_failed",
      type: "payment_intent.payment_failed",
    };

    const webhookResponse = await fixture.app.inject({
      headers: { "stripe-signature": "test-signature" },
      method: "POST",
      payload: event,
      url: "/api/v1/webhooks/stripe",
    });
    const duplicateResponse = await fixture.app.inject({
      headers: { "stripe-signature": "test-signature" },
      method: "POST",
      payload: event,
      url: "/api/v1/webhooks/stripe",
    });

    expect(webhookResponse.statusCode).toBe(200);
    expect(duplicateResponse.statusCode).toBe(200);
    expect(fixture.paymentRepository.webhookEvents.size).toBe(1);
    expect(fixture.paymentRepository.payments.get(checkout.payment.id)).toMatchObject({
      status: "failed",
    });
    expect([...fixture.paymentRepository.attempts.values()][0]).toMatchObject({
      failureCode: "card_declined",
      failureMessage: "The card was declined.",
      status: "failed",
    });
    expect(
      fixture.quoteRepository.paymentScheduleItems.get(
        fixture.signedAgreement.nextPaymentAction.paymentScheduleItemId,
      ),
    ).toMatchObject({ status: "failed" });
    expect(fixture.rfqRepository.rfqs.get(fixture.signedAgreement.rfq.id)?.status).toBe(
      "agreement_signed",
    );
  });
});
